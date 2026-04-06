const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const sql = require("mssql");
const path = require("path");
const jwt = require("jsonwebtoken"); // <--- Thêm thư viện JWT ở đây

const app = express();

// ================= CONFIG EJS & STATIC FILES =================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../frontend")); 
app.use(express.static(path.join(__dirname, "../frontend")));

app.use(cors({ origin: "*" }));
// Cho phép nhận dữ liệu JSON lên đến 50MB (thoải mái cho ảnh Base64)
app.use(express.json({ limit: '50mb' })); // Cho phép nhận tối đa 50MB
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// ================= CONFIG SQL SERVER =================
const config = {
    user: "sa",
    password: "123",
    // Đối với SQL Express, dùng 'localhost\\SQLEXPRESS' hoặc '127.0.0.1\\SQLEXPRESS'
    server: "localhost", 
    database: "NentangCLB",
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

let pool;
// Khóa bí mật dùng để tạo JWT
const JWT_SECRET = "CLB_CONNECT_SECRET_KEY_2026"; 

// ================= CONNECT DB =================
async function connectDB() {
    try {
        pool = await sql.connect(config);
        console.log("✅ Connected SQL Server (SQLEXPRESS)");
        await checkSchema(); // Tự động kiểm tra và sửa DB
    } catch (err) {
        console.error("❌ DB Error: ", err.message);
        console.log("👉 Mẹo: Hãy chắc chắn bạn đã Restart SQL Service và bật TCP/IP port 1433.");
    }
}

async function checkSchema() {
    try {
        console.log("🔍 Checking Database Schema...");
        // 1. Kiểm tra và sửa cột image (Cần NVARCHAR(MAX) để lưu Base64)
        await pool.request().query("ALTER TABLE posts ALTER COLUMN image NVARCHAR(MAX)");
        
        // 2. Kiểm tra và sửa cột logo_url & cover_url trong clubs
        await pool.request().query("ALTER TABLE clubs ALTER COLUMN logo_url NVARCHAR(MAX)");
        await pool.request().query("ALTER TABLE clubs ALTER COLUMN cover_url NVARCHAR(MAX)");

        // 3. Kiểm tra và thêm cột user_id (Nếu chưa có)
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'user_id')
            BEGIN
                ALTER TABLE posts ADD user_id INT FOREIGN KEY REFERENCES users(id);
            END
        `);
        console.log("  + Checked post table for user_id");
        
        // 4. Tạo bảng comments nếu chưa có
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'comments')
            BEGIN
                CREATE TABLE comments (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE CASCADE,
                    user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
                    content NVARCHAR(MAX) NOT NULL,
                    created_at DATETIME DEFAULT GETDATE()
                )
            END
        `);
        console.log("  + Checked comments table");

        // 5. Tạo bảng post_likes nếu chưa có
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'post_likes')
            BEGIN
                CREATE TABLE post_likes (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE CASCADE,
                    user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
                    created_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uq_post_like UNIQUE (post_id, user_id)
                )
            END
        `);
        console.log("  + Checked post_likes table");
        
        // 6. Kiểm tra và thêm cột image cho bảng events
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'image')
            BEGIN
                ALTER TABLE events ADD image NVARCHAR(MAX);
            END
            ELSE
            BEGIN
                ALTER TABLE events ALTER COLUMN image NVARCHAR(MAX);
            END
        `);
        console.log("  + Checked event table for image column");

        // 7. Kiểm tra và thêm cột joined_at cho bảng club_members
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('club_members') AND name = 'joined_at')
            BEGIN
                ALTER TABLE club_members ADD joined_at DATETIME DEFAULT GETDATE();
            END
        `);
        console.log("  + Checked club_members table for joined_at column");

        console.log("✅ Schema check completed.");
        console.log("✅ Schema check completed.");
    } catch (err) {
        console.warn("⚠️ Schema check warning (This is normal if columns already exist):", err.message);
    }
}

connectDB();

// ================= UTILS =================
function generateUserCode() {
    return "SV" + Date.now();
}

// ================= MIDDLEWARE CHECK DB =================
function ensureDB(req, res, next) {
    if (!pool) {
        return res.status(500).json({ message: "Database not ready" });
    }
    next();
}

// ================= VIEW ROUTES (Giao diện) =================
// Đảm bảo bạn có file ./routes/viewRoutes.js, nếu không thì tạm thời comment 2 dòng này lại
const viewRoutes = require("./routes/viewRoutes");
app.use("/", viewRoutes); 

// ================= AUTH API (ĐĂNG KÝ / ĐĂNG NHẬP) =================

// 1. API Đăng ký
app.post("/api/register", ensureDB, async (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ message: "Thiếu thông tin" });
    }
    
    try {
        // Kiểm tra xem email đã tồn tại chưa
        const check = await pool.request()
            .input("email", sql.VarChar, email)
            .query("SELECT id FROM users WHERE email = @email");

        if (check.recordset.length > 0) {
            return res.status(400).json({ message: "Email đã tồn tại trong hệ thống" });
        }
        
        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Lưu vào database
        await pool.request()
            .input("code", sql.VarChar, generateUserCode())
            .input("name", sql.NVarChar, name)
            .input("email", sql.VarChar, email)
            .input("password", sql.VarChar, hashedPassword)
            .query(`
                INSERT INTO users (user_code, full_name, email, password)
                VALUES (@code, @name, @email, @password)
            `);
            
        res.json({ message: "Đăng ký thành công" });
    } catch (err) {
        console.error("Lỗi đăng ký:", err);
        res.status(500).json({ message: "Lỗi server" });
    }
});

// 2. API Đăng nhập
app.post("/api/login", ensureDB, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Vui lòng nhập đủ thông tin!" });

    try {
        // 1. Tìm user và join với bảng roles để lấy role_name
        const result = await pool.request()
            .input("email", sql.VarChar, email) 
            .query(`
                SELECT u.*, r.role_name 
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE u.email = @email
            `);
            
        const user = result.recordset[0];
        if (!user) return res.status(404).json({ message: "Email không tồn tại!" });

        // 2. Kiểm tra mật khẩu
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Mật khẩu không chính xác!" });

        // 3. Tạo Token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role_name },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        // 4. Trả kết quả (gửi kèm role_name)
        res.json({
            message: "Đăng nhập thành công!",
            token: token,
            user_id: user.id,
            user_code: user.user_code,
            name: user.full_name,
            avatar: user.avatar || null,
            role: user.role_name || 'student' // Mặc định là student nếu không có role
        });

    } catch (err) {
        console.error("Lỗi API Đăng nhập:", err);
        res.status(500).json({ message: "Lỗi máy chủ!" });
    }
});

// ================= CLUBS API =================

// 1. API Tạo câu lạc bộ mới
app.post("/api/clubs", ensureDB, async (req, res) => {
    const { club_name, category_name, description, created_by, logo_url, cover_url } = req.body;

    if (!club_name || !category_name || !created_by) {
        return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
    }

    try {
        const normalizedCatName = category_name.trim();
        const club_code = "CLB" + Date.now();

        // 1. Tìm hoặc tạo Category (Giữ nguyên logic của bạn)
        let catResult = await pool.request()
            .input("catName", sql.NVarChar, normalizedCatName)
            .query("SELECT id FROM categories WHERE LTRIM(RTRIM(category_name)) = @catName");

        let categoryId;
        if (catResult.recordset.length > 0) {
            categoryId = catResult.recordset[0].id;
        } else {
            let newCat = await pool.request()
                .input("catName", sql.NVarChar, normalizedCatName)
                .query("INSERT INTO categories (category_name) OUTPUT INSERTED.id VALUES (@catName)");
            categoryId = newCat.recordset[0].id;
        }

        // 2. Insert vào bảng clubs (Bổ sung logo_url và cover_url)
        await pool.request()
            .input("name", sql.NVarChar, club_name)
            .input("code", sql.VarChar, club_code)
            .input("desc", sql.NVarChar, description || "")
            .input("catId", sql.Int, categoryId) 
            .input("userId", sql.Int, created_by)
            .input("logo", sql.NVarChar, logo_url || "")
            .input("cover", sql.NVarChar, cover_url || "")
            .query(`
                INSERT INTO clubs (club_name, club_code, description, category_id, created_by, logo_url, cover_url)
                VALUES (@name, @code, @desc, @catId, @userId, @logo, @cover)
            `);

        res.json({ message: "Tạo câu lạc bộ thành công!" });
    } catch (err) {
        console.error("Lỗi tạo CLB:", err);
        res.status(500).json({ message: "Lỗi hệ thống: " + err.message });
    }
});

// 1.5 API Cập nhật câu lạc bộ
app.put("/api/clubs/:id", ensureDB, async (req, res) => {
    const clubId = req.params.id;
    const { club_name, category_name, description, logo_url, cover_url } = req.body;

    if (!club_name || !category_name) {
        return res.status(400).json({ message: "Vui lòng nhập tên và chuyên mục!" });
    }

    try {
        const normalizedCatName = category_name.trim();

        // 1. Tìm hoặc tạo Category
        let catResult = await pool.request()
            .input("catName", sql.NVarChar, normalizedCatName)
            .query("SELECT id FROM categories WHERE LTRIM(RTRIM(category_name)) = @catName");

        let categoryId;
        if (catResult.recordset.length > 0) {
            categoryId = catResult.recordset[0].id;
        } else {
            let newCat = await pool.request()
                .input("catName", sql.NVarChar, normalizedCatName)
                .query("INSERT INTO categories (category_name) OUTPUT INSERTED.id VALUES (@catName)");
            categoryId = newCat.recordset[0].id;
        }

        // 2. Cập nhật bảng clubs (sử dụng NVARCHAR(MAX) đã cấu hình)
        await pool.request()
            .input("id", sql.Int, clubId)
            .input("name", sql.NVarChar, club_name)
            .input("desc", sql.NVarChar, description || "")
            .input("catId", sql.Int, categoryId) 
            .input("logo", sql.NVarChar(sql.MAX), logo_url || "")
            .input("cover", sql.NVarChar(sql.MAX), cover_url || "")
            .query(`
                UPDATE clubs 
                SET club_name = @name, description = @desc, category_id = @catId, 
                    logo_url = @logo, cover_url = @cover
                WHERE id = @id
            `);

        res.json({ message: "Cập nhật câu lạc bộ thành công!" });
    } catch (err) {
        console.error("Lỗi cập nhật CLB:", err);
        res.status(500).json({ message: "Lỗi hệ thống: " + err.message });
    }
});

// 2. API Lấy danh sách CLB (Giữ nguyên - Đã tốt)
app.get("/api/clubs", ensureDB, async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT c.id, c.club_name, c.club_code, c.description, c.created_at,
                   c.created_by, -- QUAN TRỌNG: Phải có cột này để so sánh ID
                   u.full_name AS creator,
                   cat.category_name,
                   c.logo_url, 
                   c.cover_url,
                   (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id) AS member_count
            FROM clubs c 
            LEFT JOIN users u ON c.created_by = u.id
            LEFT JOIN categories cat ON c.category_id = cat.id
            ORDER BY c.created_at DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Lỗi load CLB:", err);
        res.status(500).send(err.message);
    }
});

// 3. API Tham gia CLB (Chờ Duyệt)
app.post("/api/clubs/join", ensureDB, async (req, res) => {
    const { club_id, user_id } = req.body;
    try {
        // Kiểm tra xem đã là thành viên chưa
        const checkMember = await pool.request()
            .input("c", sql.Int, club_id)
            .input("u", sql.Int, user_id)
            .query("SELECT * FROM club_members WHERE club_id = @c AND user_id = @u");

        if (checkMember.recordset.length > 0) {
            return res.status(400).json({ message: " Bạn đã là thành viên CLB này rồi!" });
        }

        // Kiểm tra xem đã gửi yêu cầu chưa
        const checkRequest = await pool.request()
            .input("c", sql.Int, club_id)
            .input("u", sql.Int, user_id)
            .query("SELECT * FROM join_requests WHERE club_id = @c AND user_id = @u AND status = 'pending'");

        if (checkRequest.recordset.length > 0) {
            return res.status(400).json({ message: " Đơn xin gia nhập của bạn đang chờ duyệt!" });
        }

        await pool.request()
            .input("c", sql.Int, club_id)
            .input("u", sql.Int, user_id)
            .query("INSERT INTO join_requests (club_id, user_id, status, requested_at) VALUES (@c, @u, 'pending', GETDATE())");
        
        res.json({ message: "Đã gửi đơn xin tham gia! Vui lòng chờ Ban Quản trị duyệt." });
    } catch (err) {
        res.status(500).json({ message: "Lỗi khi gửi yêu cầu tham gia" });
    }
});

// 3.5. API Lấy các CLB mà user đang chờ duyệt
app.get("/api/user/requests/:userId", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("uid", sql.Int, req.params.userId)
            .query("SELECT club_id FROM join_requests WHERE user_id = @uid AND status = 'pending'");
        res.json(result.recordset);
    } catch (err) { res.status(500).json([]); }
});

// ================= CLUB MANAGEMENT API =================

// 1. API Lấy thông tin chi tiết một câu lạc bộ
app.get("/api/clubs/:id", ensureDB, async (req, res) => {
    const clubId = req.params.id;
    console.log(`[GET] /api/clubs/${clubId}`);
    try {
        const result = await pool.request()
            .input("id", sql.Int, clubId)
            .query(`
                SELECT c.*, u.full_name as creator_name, cat.category_name 
                FROM clubs c
                LEFT JOIN users u ON c.created_by = u.id
                LEFT JOIN categories cat ON c.category_id = cat.id
                WHERE c.id = @id
            `);
        if (result.recordset.length > 0) {
            console.log(`  -> Found: ${result.recordset[0].club_name}`);
            res.json(result.recordset[0]);
        } else {
            console.warn(`  -> NOT FOUND ID: ${clubId}`);
            res.status(404).json({ message: "Không tìm thấy câu lạc bộ" });
        }
    } catch (err) { 
        console.error(`  -> ERROR for ID ${clubId}:`, err.message);
        res.status(500).json({ message: "Lỗi lấy thông tin CLB" }); 
    }
});

// 2. API Lấy danh sách thành viên (Để Phân quyền)
app.get("/api/clubs/:id/members", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT cm.id as member_record_id, cm.role, cm.status, u.id as user_id, u.full_name as name, u.email, u.avatar
                FROM club_members cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.club_id = @id
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "Lỗi lấy danh sách thành viên" }); }
});

// 2.5 API Thống kê & Xếp hạng trong CLB
app.get("/api/clubs/:id/rankings", ensureDB, async (req, res) => {
    const clubId = req.params.id;
    const period = req.query.period || 'month'; 
    console.log(`[Rankings] ClubID: ${clubId}, Period: ${period}`);
    
    try {
        const poolReq = pool.request().input("clubId", sql.Int, clubId);
        
        let dateFilter = "";
        if (period === 'month') {
            dateFilter = "AND MONTH(created_at) = MONTH(GETDATE()) AND YEAR(created_at) = YEAR(GETDATE())";
        } else if (period === 'year') {
            dateFilter = "AND YEAR(created_at) = YEAR(GETDATE())";
        } else {
            dateFilter = ""; // Tất cả thời gian
        }

        // 1. Xếp hạng Bài đăng (Post rankings)
        const postRankQuery = `
            SELECT TOP 5 u.id, u.full_name, u.avatar, COUNT(p.id) as count
            FROM users u
            JOIN posts p ON u.id = p.user_id
            WHERE p.club_id = @clubId
              ${dateFilter.replace(/created_at/g, "p.created_at")}
            GROUP BY u.id, u.full_name, u.avatar
            ORDER BY count DESC
        `;
        const postRankResult = await pool.request().input("clubId", sql.Int, clubId).query(postRankQuery);

        // 2. Xếp hạng Tham gia Sự kiện (Event rankings)
        const eventDateFilter = period === 'month' 
            ? "AND MONTH(er.registered_at) = MONTH(GETDATE()) AND YEAR(er.registered_at) = YEAR(GETDATE())"
            : "AND YEAR(er.registered_at) = YEAR(GETDATE())";

        const eventRankQuery = `
            SELECT TOP 5 u.id, u.full_name, u.avatar, COUNT(er.id) as count
            FROM users u
            JOIN event_registrations er ON u.id = er.user_id
            JOIN events e ON er.event_id = e.id
            WHERE e.club_id = @clubId
              ${eventDateFilter}
            GROUP BY u.id, u.full_name, u.avatar
            ORDER BY count DESC
        `;
        const eventRankResult = await pool.request().input("clubId", sql.Int, clubId).query(eventRankQuery);
        console.log(`   -> Found ${postRankResult.recordset.length} post rankings, ${eventRankResult.recordset.length} event rankings`);


        // 3. Tổng quan
        const memberDateFilter = period === 'month' 
            ? "AND MONTH(joined_at) = MONTH(GETDATE()) AND YEAR(joined_at) = YEAR(GETDATE())"
            : (period === 'year' ? "AND YEAR(joined_at) = YEAR(GETDATE())" : "AND 1=1");

        const overviewQuery = `
            SELECT 
                (SELECT COUNT(*) FROM events WHERE club_id = @clubId) as totalEvents,
                (SELECT COUNT(*) FROM posts WHERE club_id = @clubId) as totalPosts,
                (SELECT COUNT(*) FROM club_members WHERE club_id = @clubId AND status = 'active') as totalMembers,
                (SELECT COUNT(*) FROM club_members WHERE club_id = @clubId AND status = 'active' ${memberDateFilter}) as newMembers
        `;
        const overviewResult = await pool.request().input("clubId", sql.Int, clubId).query(overviewQuery);
        console.log("   -> Overview stats:", overviewResult.recordset[0]);

        res.json({
            postRankings: postRankResult.recordset,
            eventRankings: eventRankResult.recordset,
            overview: overviewResult.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi API Rank:", err);
        res.status(500).json({ message: "Lỗi tính toán xếp hạng" });
    }
});

// 3. API Lấy danh sách yêu cầu tham gia đang chờ duyệt
app.get("/api/clubs/:id/requests", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT jr.id as request_id, jr.status, jr.requested_at, u.id as user_id, u.full_name as name, u.email, u.avatar
                FROM join_requests jr
                JOIN users u ON jr.user_id = u.id
                WHERE jr.club_id = @id AND jr.status = 'pending'
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "Lỗi lấy yêu cầu tham gia" }); }
});

// 4. API Duyệt hoặc Từ chối yêu cầu tham gia
app.post("/api/clubs/requests/action", ensureDB, async (req, res) => {
    const { request_id, action } = req.body; 
    try {
        const reqData = await pool.request().input("id", sql.Int, request_id).query("SELECT * FROM join_requests WHERE id = @id");
        if (reqData.recordset.length === 0) return res.status(404).json({ message: "Yêu cầu không tồn tại" });
        
        const { club_id, user_id } = reqData.recordset[0];
        if (action === 'approve') {
            await pool.request().input("id", sql.Int, request_id).query("UPDATE join_requests SET status = 'approved' WHERE id = @id");
            await pool.request()
                .input("c", sql.Int, club_id)
                .input("u", sql.Int, user_id)
                .query("INSERT INTO club_members (club_id, user_id, status, role) VALUES (@c, @u, 'active', 'member')");
            res.json({ message: "Đã duyệt thành viên thành công!" });
        } else {
            await pool.request().input("id", sql.Int, request_id).query("UPDATE join_requests SET status = 'rejected' WHERE id = @id");
            res.json({ message: "Đã từ chối yêu cầu gia nhập." });
        }
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Lỗi xử lý yêu cầu" }); 
    }
});

// 5. API Phân quyền (Thăng chức)
app.post("/api/clubs/members/promote", ensureDB, async (req, res) => {
    const { member_record_id, new_role } = req.body; 
    try {
        await pool.request()
            .input("id", sql.Int, member_record_id)
            .input("role", sql.NVarChar, new_role)
            .query("UPDATE club_members SET role = @role WHERE id = @id");
        res.json({ message: `Đã cập nhật vai trò thành: ${new_role}` });
    } catch (err) { res.status(500).json({ message: "Lỗi phân quyền" }); }
});

// 6. API Lấy thống kê CLB
app.get("/api/clubs/:id/stats", ensureDB, async (req, res) => {
    try {
        const result = await pool.request().input("id", sql.Int, req.params.id)
            .query("SELECT * FROM club_stats WHERE club_id = @id");
        res.json(result.recordset[0] || { total_score: 0, current_rank: 0, trend: 'stable' });
    } catch (err) { res.status(500).json({ message: "Lỗi lấy thống kê" }); }
});

// 4. API Rời CLB
app.post("/api/clubs/leave", ensureDB, async (req, res) => {
    const { club_id, user_id } = req.body;
    try {
        const result = await pool.request()
            .input("c", sql.Int, club_id)
            .input("u", sql.Int, user_id)
            .query("DELETE FROM club_members WHERE club_id = @c AND user_id = @u");
        
        console.log(`[Leave Club] ClubID: ${club_id}, UserID: ${user_id}. Rows affected: ${result.rowsAffected[0]}`);
        res.json({ message: "Đã rời câu lạc bộ!" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi khi rời CLB" });
    }
});

// 5. API Xóa CLB (Dành cho chủ CLB)
app.delete("/api/clubs/:id", ensureDB, async (req, res) => {
    const clubId = req.params.id;
    const userId = req.query.user_id; 

    try {
        // Kiểm tra quyền
        const check = await pool.request()
            .input("c", sql.Int, clubId)
            .input("u", sql.Int, userId)
            .query("SELECT * FROM clubs WHERE id = @c AND created_by = @u");

        if (check.recordset.length === 0) {
            return res.status(403).json({ message: "Bạn không có quyền xóa CLB này!" });
        }

        // Xóa các bảng liên quan (Tránh lỗi FK)
        // 1. Các bảng phụ trước
        await pool.request().input("c", sql.Int, clubId).query("DELETE FROM club_stats WHERE club_id = @c");
        await pool.request().input("c", sql.Int, clubId).query("DELETE FROM join_requests WHERE club_id = @c");
        await pool.request().input("c", sql.Int, clubId).query("DELETE FROM club_members WHERE club_id = @c");
        await pool.request().input("c", sql.Int, clubId).query("DELETE FROM events WHERE club_id = @c");
        await pool.request().input("c", sql.Int, clubId).query("DELETE FROM posts WHERE club_id = @c");
        
        // 2. Cuối cùng mới xóa club
        const result = await pool.request().input("c", sql.Int, clubId).query("DELETE FROM clubs WHERE id = @c");

        console.log(`[Delete Club] ClubID: ${clubId} deleted by UserID: ${userId}. Rows affected: ${result.rowsAffected[0]}`);
        res.json({ message: "Đã xóa câu lạc bộ thành công!" });
    } catch (err) {
        console.error("Lỗi xóa CLB:", err);
        res.status(500).json({ message: "Lỗi khi xóa câu lạc bộ" });
    }
});


// ================= EVENTS API =================
app.get("/api/events", ensureDB, async (req, res) => {
    const clubId = req.query.club_id;
    const userId = req.query.user_id;
    try {
        const request = pool.request();
        let query = `
            SELECT e.id, e.event_name, e.description, e.location, e.start_time, e.end_time, e.image, c.club_name, c.id as club_id
        `;
        if (userId) {
            query += `, (CASE WHEN EXISTS (SELECT 1 FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = @uid) THEN 1 ELSE 0 END) as is_registered `;
            request.input("uid", sql.Int, userId);
        } else {
            query += `, 0 as is_registered `;
        }
        
        query += ` FROM events e JOIN clubs c ON e.club_id = c.id `;
        
        if (clubId) {
            query += ` WHERE e.club_id = @cid`;
            request.input("cid", sql.Int, clubId);
        }
        query += ` ORDER BY e.start_time ASC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 7. API Tạo sự kiện mới
app.post("/api/events", ensureDB, async (req, res) => {
    const { event_name, description, location, start_time, end_time, club_id, created_by, image } = req.body;
    try {
        await pool.request()
            .input("name", sql.NVarChar, event_name)
            .input("desc", sql.NVarChar, description)
            .input("loc", sql.NVarChar, location)
            .input("st", sql.DateTime, start_time)
            .input("et", sql.DateTime, end_time)
            .input("cid", sql.Int, club_id)
            .input("uid", sql.Int, created_by)
            .input("img", sql.NVarChar(sql.MAX), image)
            .query(`INSERT INTO events (event_name, description, location, start_time, end_time, club_id, created_by, created_at, image) 
                    VALUES (@name, @desc, @loc, @st, @et, @cid, @uid, GETDATE(), @img)`);
        res.json({ message: "Tạo sự kiện thành công!" });
    } catch (err) { 
        console.error("Lỗi POST Event:", err);
        res.status(500).json({ message: "Lỗi tạo sự kiện" }); 
    }
});

// 8. API Đăng ký tham gia sự kiện
app.post("/api/events/register", ensureDB, async (req, res) => {
    const { event_id, user_id } = req.body;
    try {
        const check = await pool.request()
            .input("e", sql.Int, event_id)
            .input("u", sql.Int, user_id)
            .query("SELECT id FROM event_registrations WHERE event_id = @e AND user_id = @u");
        
        if (check.recordset.length > 0) return res.status(400).json({ message: "Bạn đã đăng ký sự kiện này rồi!" });
        
        await pool.request()
            .input("e", sql.Int, event_id)
            .input("u", sql.Int, user_id)
            .query("INSERT INTO event_registrations (event_id, user_id, status, registered_at) VALUES (@e, @u, 'pending', GETDATE())");
        res.json({ message: "Đăng ký sự kiện thành công! Vui lòng chờ duyệt." });
    } catch (err) { res.status(500).json({ message: "Lỗi đăng ký sự kiện" }); }
});

// API Hủy đăng ký tham gia sự kiện
app.delete("/api/events/register", ensureDB, async (req, res) => {
    const { event_id, user_id } = req.body;
    try {
        await pool.request()
            .input("e", sql.Int, event_id)
            .input("u", sql.Int, user_id)
            .query("DELETE FROM event_registrations WHERE event_id = @e AND user_id = @u");
        res.json({ message: "Đã hủy đăng ký tham gia sự kiện." });
    } catch (err) { res.status(500).json({ message: "Lỗi hủy đăng ký" }); }
});

app.put("/api/events/:id", ensureDB, async (req, res) => {
    const { event_name, description, location, start_time, end_time, image } = req.body;
    try {
        await pool.request()
            .input("name", sql.NVarChar, event_name)
            .input("desc", sql.NVarChar, description)
            .input("loc", sql.NVarChar, location)
            .input("st", sql.DateTime, start_time)
            .input("et", sql.DateTime, end_time)
            .input("img", sql.NVarChar(sql.MAX), image || "")
            .input("eid", sql.Int, req.params.id)
            .query(`UPDATE events SET event_name = @name, description = @desc, location = @loc, start_time = @st, end_time = @et, image = @img WHERE id = @eid`);
        res.json({ message: "Cập nhật sự kiện thành công!" });
    } catch (err) { 
        console.error("Lỗi PUT Event:", err);
        res.status(500).json({ message: "Lỗi cập nhật sự kiện" }); 
    }
});

// GET /api/events/:id/registrations
app.get("/api/events/:id/registrations", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("eid", sql.Int, req.params.id)
            .query(`
                SELECT u.id, u.full_name, u.email, er.registered_at, er.status
                FROM event_registrations er
                JOIN users u ON er.user_id = u.id
                WHERE er.event_id = @eid
                ORDER BY er.registered_at DESC
            `);
        res.json(result.recordset);
    } catch(err) {
        res.status(500).json({message: "Lỗi lấy danh sách đăng ký"});
    }
});

app.delete("/api/events/:id", ensureDB, async (req, res) => {
    try {
        const reqE = pool.request();
        reqE.input("eid", sql.Int, req.params.id);
        // Cascade delete registrations manually if FK doesn't have CASCADE
        await reqE.query("DELETE FROM event_registrations WHERE event_id = @eid");
        await reqE.query("DELETE FROM events WHERE id = @eid");
        res.json({ message: "Xóa sự kiện thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi xóa sự kiện" }); }
});

// ================= POSTS API =================
app.get("/api/posts", ensureDB, async (req, res) => {
    const club = req.query.club;
    const club_id = req.query.club_id;
    const search = req.query.search;
    const user_id = req.query.user_id;
    try {
        const request = pool.request();
        // Add current user_id checking logic for likes
        if (user_id) {
            request.input("current_uid", sql.Int, user_id);
        }

        let query = `
            SELECT p.id, p.title, p.content, p.image, p.likes, p.views, p.comments, p.type, p.created_at,
                   c.id AS club_id, c.club_name, c.club_code,
                   u.full_name as author_name, u.avatar as author_avatar
                   ${user_id ? ", CASE WHEN EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = @current_uid) THEN 1 ELSE 0 END as user_liked" : ""}
            FROM posts p 
            LEFT JOIN clubs c ON p.club_id = c.id
            LEFT JOIN users u ON p.user_id = u.id
        `;
        let conditions = [];
        if (club && club !== "all") {
            conditions.push(`c.club_code = @club`);
            request.input("club", sql.VarChar, club);
        }
        if (club_id) {
            conditions.push(`p.club_id = @cid`);
            request.input("cid", sql.Int, club_id);
        }
        if (search) {
            conditions.push(`(p.title LIKE @search OR p.content LIKE @search)`);
            request.input("search", sql.NVarChar, `%${search}%`);
        }
        
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        
        query += ` ORDER BY p.created_at DESC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi load posts" });
    }
});

// 9. API Đăng bài viết mới
app.post("/api/posts", ensureDB, async (req, res) => {
    const { title, content, type, club_id, user_id, image } = req.body;
    try {
        await pool.request()
            .input("t", sql.NVarChar, title)
            .input("c", sql.NVarChar, content)
            .input("ty", sql.NVarChar, type)
            .input("cid", sql.Int, club_id)
            .input("uid", sql.Int, user_id)
            .input("img", sql.NVarChar(sql.MAX), image)
            .query(`INSERT INTO posts (title, content, type, club_id, user_id, created_at, likes, views, comments, image) 
                    VALUES (@t, @c, @ty, @cid, @uid, GETDATE(), 0, 0, 0, @img)`);
        res.json({ message: "Đăng bài thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi đăng bài" }); }
});

app.put("/api/posts/:id", ensureDB, async (req, res) => {
    const { title, content, type, image } = req.body;
    try {
        await pool.request()
            .input("t", sql.NVarChar, title)
            .input("c", sql.NVarChar, content)
            .input("ty", sql.NVarChar, type)
            .input("img", sql.NVarChar(sql.MAX), image)
            .input("pid", sql.Int, req.params.id)
            .query(`UPDATE posts SET title = @t, content = @c, type = @ty, image = @img WHERE id = @pid`);
        res.json({ message: "Cập nhật bài viết thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi cập nhật bài viết" }); }
});

app.delete("/api/posts/:id", ensureDB, async (req, res) => {
    try {
        const request = pool.request();
        request.input("pid", sql.Int, req.params.id);
        // Delete related constraints if not using cascade
        await request.query("DELETE FROM comments WHERE post_id = @pid");
        await request.query("DELETE FROM post_likes WHERE post_id = @pid");
        await request.query("DELETE FROM saved_posts WHERE post_id = @pid");
        await request.query("DELETE FROM posts WHERE id = @pid");
        res.json({ message: "Xóa bài viết thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi xóa bài viết" }); }
});

// ================= LIKE/VIEW/SAVE API =================
app.post("/api/posts/like/:id", ensureDB, async (req, res) => {
    const { user_id } = req.body;
    const post_id = req.params.id;
    
    if (!user_id) return res.status(401).json({ message: "Vui lòng đăng nhập" });

    try {
        const check = await pool.request()
            .input("pid", sql.Int, post_id)
            .input("uid", sql.Int, user_id)
            .query("SELECT id FROM post_likes WHERE post_id = @pid AND user_id = @uid");

        if (check.recordset.length > 0) {
            // Already liked -> Unlike
            await pool.request()
                .input("pid", sql.Int, post_id)
                .input("uid", sql.Int, user_id)
                .query("DELETE FROM post_likes WHERE post_id = @pid AND user_id = @uid");
            await pool.request().input("id", sql.Int, post_id).query(`UPDATE posts SET likes = likes - 1 WHERE id = @id`);
            return res.json({ success: true, liked: false });
        } else {
            // Not liked -> Like
            await pool.request()
                .input("pid", sql.Int, post_id)
                .input("uid", sql.Int, user_id)
                .query("INSERT INTO post_likes (post_id, user_id) VALUES (@pid, @uid)");
            await pool.request().input("id", sql.Int, post_id).query(`UPDATE posts SET likes = likes + 1 WHERE id = @id`);
            return res.json({ success: true, liked: true });
        }
    } catch (err) { 
        console.error("Like error:", err);
        res.status(500).json({ message: "Like error" }); 
    }
});

app.post("/api/posts/view/:id", ensureDB, async (req, res) => {
    try {
        await pool.request().input("id", sql.Int, req.params.id).query(`UPDATE posts SET views = views + 1 WHERE id = @id`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "View error" }); }
});

app.post("/api/posts/save", ensureDB, async (req, res) => {
    const { user_id, post_id } = req.body;
    try {
        const check = await pool.request().input("user_id", sql.Int, user_id).input("post_id", sql.Int, post_id)
            .query(`SELECT id FROM saved_posts WHERE user_id = @user_id AND post_id = @post_id`);
        if (check.recordset.length > 0) return res.json({ message: "Đã lưu trước đó" });
        await pool.request().input("user_id", sql.Int, user_id).input("post_id", sql.Int, post_id)
            .query(`INSERT INTO saved_posts (user_id, post_id) VALUES (@user_id, @post_id)`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Save error" }); }
});

// ================= COMMENTS API =================
app.get("/api/posts/:postId/comments", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("pid", sql.Int, req.params.postId)
            .query(`
                SELECT c.id, c.content, c.created_at, u.full_name as author_name, u.avatar as author_avatar
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.post_id = @pid
                ORDER BY c.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi load comments" });
    }
});

app.post("/api/posts/:postId/comments", ensureDB, async (req, res) => {
    const { user_id, content } = req.body;
    const post_id = req.params.postId;
    try {
        await pool.request()
            .input("pid", sql.Int, post_id)
            .input("uid", sql.Int, user_id)
            .input("content", sql.NVarChar, content)
            .query(`INSERT INTO comments (post_id, user_id, content, created_at) VALUES (@pid, @uid, @content, GETDATE())`);
        
        // Tăng số lượng comment của post
        await pool.request()
            .input("pid", sql.Int, post_id)
            .query("UPDATE posts SET comments = comments + 1 WHERE id = @pid");
            
        res.json({ message: "Bình luận thành công!" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi đăng bình luận" });
    }
});


// profile
// 1. API Lấy thông tin chi tiết user
app.get("/api/user/profile/:id", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT id, full_name, email, phone, dob, gender, bio, avatar, hobbies 
                FROM users 
                WHERE id = @id
            `);
        
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ message: "Không tìm thấy người dùng" });
        }
    } catch (err) {
        res.status(500).json({ message: "Lỗi Server khi lấy profile" });
    }
});

// 2. API Cập nhật thông tin user
app.post("/api/user/update", ensureDB, async (req, res) => {
    const { id, full_name, phone, dob, gender, bio, avatar, hobbies } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, id)
            .input("full_name", sql.NVarChar, full_name)
            .input("phone", sql.VarChar, phone)
            .input("dob", sql.Date, dob)
            .input("gender", sql.NVarChar, gender)
            .input("bio", sql.NVarChar, bio)
            .input("hobbies", sql.NVarChar, hobbies)
            .input("avatar", sql.NVarChar, avatar) // Lưu Base64
            .query(`
                UPDATE users 
                SET full_name = @full_name, 
                    phone = @phone, 
                    dob = @dob, 
                    gender = @gender, 
                    bio = @bio, 
                    avatar = @avatar,
                    hobbies = @hobbies
                WHERE id = @id
            `);
        res.json({ success: true, message: "Cập nhật thành công!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi khi lưu vào Database" });
    }
});

// 3. Sửa lại route render trang Profile để không bị lỗi "user is not defined"
app.get("/profile", (req, res) => {
    res.render("Profile", { user: {} }); // Truyền object rỗng, JS sẽ fetch data sau
});

// API lấy danh sách CLB của một User cụ thể
app.get("/api/user/clubs/:userId", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("userId", sql.Int, req.params.userId)
            .query(`
                -- Những CLB do user tạo
                SELECT id, club_name as name FROM clubs WHERE created_by = @userId
                UNION
                -- Những CLB user là thành viên
                SELECT c.id, c.club_name as name 
                FROM clubs c
                INNER JOIN club_members cm ON c.id = cm.club_id
                WHERE cm.user_id = @userId AND cm.status = 'active'
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Lỗi API Clubs:", err);
        res.status(500).json({ message: "Lỗi lấy danh sách CLB" });
    }
});

// ================= START SERVER =================
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running: http://localhost:${PORT}`);
});