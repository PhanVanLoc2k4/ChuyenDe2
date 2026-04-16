const { getPool, sql } = require("../config/database");

// 1. Lấy danh sách câu lạc bộ
const getAllClubs = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request().query(`
            SELECT c.id, c.club_name, c.club_code, c.description, c.created_at,
                   c.created_by,
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
};

// 2. Tạo câu lạc bộ mới
const createClub = async (req, res) => {
    const { club_name, category_name, description, created_by, logo_url, cover_url } = req.body;
    const pool = getPool();

    if (!club_name || !category_name || !created_by) {
        return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
    }

    try {
        const normalizedCatName = category_name.trim();
        const club_code = "CLB" + Date.now();

        // Tìm hoặc tạo Category
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

        await pool.request()
            .input("name", sql.NVarChar, club_name)
            .input("code", sql.VarChar, club_code)
            .input("desc", sql.NVarChar, description || "")
            .input("catId", sql.Int, categoryId) 
            .input("userId", sql.Int, created_by)
            .input("logo", sql.NVarChar, logo_url || "")
            .input("cover", sql.NVarChar, cover_url || "")
            .query(`
                INSERT INTO clubs (club_name, club_code, description, category_id, created_by, logo_url, cover_url, status)
                VALUES (@name, @code, @desc, @catId, @userId, @logo, @cover, 'active')
            `);

        // Tự động thêm người tạo vào danh sách thành viên với vai trò leader
        try {
            await pool.request()
                .input("code", sql.VarChar, club_code)
                .input("uid", sql.Int, created_by)
                .query(`
                    DECLARE @new_club_id INT = (SELECT id FROM clubs WHERE club_code = @code);
                    INSERT INTO club_members (club_id, user_id, status, role)
                    VALUES (@new_club_id, @uid, 'active', 'leader');

                    -- Cập nhật vai trò hệ thống thành 'leader' (ID: 2) nếu không phải là admin (3) hoặc leader (2)
                    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = @uid)
                    BEGIN
                        -- Chỉ cập nhật nếu vai trò hiện tại không phải là leader hoặc admin
                        UPDATE user_roles 
                        SET role_id = 2 
                        WHERE user_id = @uid AND role_id NOT IN (2, 3);
                    END
                    ELSE
                    BEGIN
                        -- Nếu chưa có vai trò nào thì thêm vai trò leader
                        INSERT INTO user_roles (user_id, role_id) VALUES (@uid, 2);
                    END
                `);
        } catch (err) {
            console.error("Lỗi thêm leader:", err);
        }

        res.json({ message: "Tạo câu lạc bộ thành công!" });
    } catch (err) {
        console.error("Lỗi tạo CLB:", err);
        res.status(500).json({ message: "Lỗi hệ thống: " + err.message });
    }
};

// 3. Cập nhật câu lạc bộ
const updateClub = async (req, res) => {
    const clubId = req.params.id;
    const { club_name, category_name, description, logo_url, cover_url } = req.body;
    const pool = getPool();

    if (!club_name || !category_name) {
        return res.status(400).json({ message: "Vui lòng nhập tên và chuyên mục!" });
    }

    try {
        const normalizedCatName = category_name.trim();

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
};

// 4. Lấy chi tiết CLB
const getClubDetail = async (req, res) => {
    const clubId = req.params.id;
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("id", sql.Int, clubId)
            .query(`
                SELECT c.*, u.full_name as creator_name, cat.category_name,
                       (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id) AS member_count
                FROM clubs c
                LEFT JOIN users u ON c.created_by = u.id
                LEFT JOIN categories cat ON c.category_id = cat.id
                WHERE c.id = @id
            `);
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ message: "Không tìm thấy câu lạc bộ" });
        }
    } catch (err) { 
        res.status(500).json({ message: "Lỗi lấy thông tin CLB" }); 
    }
};

// 5. Tham gia CLB
const joinClub = async (req, res) => {
    const { club_id, user_id, reason } = req.body;
    const pool = getPool();
    try {
        const checkMember = await pool.request()
            .input("c", sql.Int, club_id)
            .input("u", sql.Int, user_id)
            .query("SELECT * FROM club_members WHERE club_id = @c AND user_id = @u");

        if (checkMember.recordset.length > 0) {
            return res.status(400).json({ message: " Bạn đã là thành viên CLB này rồi!" });
        }

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
            .input("r", sql.NVarChar, reason || "")
            .query("INSERT INTO join_requests (club_id, user_id, status, reason, requested_at) VALUES (@c, @u, 'pending', @r, GETDATE())");
        
        // --- THÔNG BÁO CHO TRƯỞNG CLB ---
        const { createNotification } = require("../services/notificationService");
        const clubInfo = await pool.request().input("id", sql.Int, club_id).query("SELECT club_name, created_by FROM clubs WHERE id = @id");
        const userInfo = await pool.request().input("id", sql.Int, user_id).query("SELECT full_name FROM users WHERE id = @id");

        if (clubInfo.recordset.length > 0 && userInfo.recordset.length > 0) {
            const leaderId = clubInfo.recordset[0].created_by;
            const clubName = clubInfo.recordset[0].club_name;
            const studentName = userInfo.recordset[0].full_name;

            await createNotification(
                leaderId,
                "Có yêu cầu gia nhập mới",
                `Sinh viên ${studentName} vừa gửi yêu cầu tham gia CLB ${clubName}.`,
                "membership",
                `/DienDan?id=${club_id}`
            );
        }

        res.json({ message: "Đã gửi đơn xin tham gia! Vui lòng chờ Ban Quản trị duyệt." });
    } catch (err) {
        res.status(500).json({ message: "Lỗi khi gửi yêu cầu tham gia: " + err.message });
    }
};

// 5.3 Rời Câu lạc bộ
const leaveClub = async (req, res) => {
    const { club_id, user_id } = req.body;
    const pool = getPool();
    try {
        const checkOwner = await pool.request()
            .input("cid", sql.Int, club_id)
            .query("SELECT created_by FROM clubs WHERE id = @cid");
        
        if (checkOwner.recordset.length > 0 && Number(checkOwner.recordset[0].created_by) === Number(user_id)) {
            return res.status(400).json({ message: "Bạn là Chủ CLB, không thể rời đi. Vui lòng chuyển quyền hoặc giải tán CLB." });
        }

        await pool.request()
            .input("c", sql.Int, club_id)
            .input("u", sql.Int, user_id)
            .query("DELETE FROM club_members WHERE club_id = @c AND user_id = @u");
        
        res.json({ message: "Bạn đã rời khỏi câu lạc bộ thành công." });
    } catch (err) {
        res.status(500).json({ message: "Lỗi khi rời CLB: " + err.message });
    }
};

// 5.4 Giải tán (Xóa) Câu lạc bộ
const deleteClub = async (req, res) => {
    const clubId = req.params.id;
    const userId = req.query.user_id; // Pass creator ID to verify
    const pool = getPool();

    try {
        const checkOwner = await pool.request()
            .input("cid", sql.Int, clubId)
            .query("SELECT created_by FROM clubs WHERE id = @cid");

        if (checkOwner.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy CLB." });

        if (Number(checkOwner.recordset[0].created_by) !== Number(userId)) {
            return res.status(403).json({ message: "Chỉ người tạo CLB mới có quyền giải tán." });
        }

        // Xóa CLB (Cascade sẽ tự động xóa members, posts, events nếu có config)
        await pool.request().input("id", sql.Int, clubId).query("DELETE FROM clubs WHERE id = @id");
        
        res.json({ message: "Câu lạc bộ đã được giải tán thành công." });
    } catch (err) {
        res.status(500).json({ message: "Lỗi khi giải tán CLB: " + err.message });
    }
};

// 5.1 Lấy danh sách yêu cầu chờ duyệt của 1 CLB
const getClubRequests = async (req, res) => {
    const clubId = req.params.id;
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("id", sql.Int, clubId)
            .query(`
                SELECT jr.id as request_id, jr.user_id, jr.reason, jr.requested_at, u.full_name as name, u.email, u.avatar
                FROM join_requests jr
                JOIN users u ON jr.user_id = u.id
                WHERE jr.club_id = @id AND jr.status = 'pending'
                ORDER BY jr.requested_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy danh sách yêu cầu" });
    }
};

// 5.2 Xử lý Yêu cầu (Duyệt/Từ chối)
const handleJoinRequest = async (req, res) => {
    const { request_id, action, reason } = req.body; // action: 'approve' or 'reject', reason is for rejection
    const pool = getPool();
    const { createNotification } = require("../services/notificationService");

    try {
        // Lấy thông tin request trước
        const reqData = await pool.request()
            .input("id", sql.Int, request_id)
            .query("SELECT * FROM join_requests WHERE id = @id");
        
        if (reqData.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
        const request = reqData.recordset[0];

        if (action === 'approve') {
            // 1. Cập nhật trạng thái join_requests
            await pool.request().input("id", sql.Int, request_id).query("UPDATE join_requests SET status = 'approved' WHERE id = @id");
            
            // 2. Thêm vào club_members
            await pool.request()
                .input("cid", sql.Int, request.club_id)
                .input("uid", sql.Int, request.user_id)
                .query("INSERT INTO club_members (club_id, user_id, status, role) VALUES (@cid, @uid, 'active', 'member')");
            
            // 3. Thông báo
            await createNotification(
                request.user_id, 
                "Yêu cầu tham gia CLB", 
                "Chúc mừng! Yêu cầu gia nhập CLB của bạn đã được duyệt.", 
                "membership", 
                `/DienDan?id=${request.club_id}`
            );
            
            res.json({ message: "Đã duyệt thành viên thành công!" });
        } else {
            // Reject
            await pool.request()
                .input("id", sql.Int, request_id)
                .input("r", sql.NVarChar, reason || "")
                .query("UPDATE join_requests SET status = 'rejected', reason = @r WHERE id = @id");

            await createNotification(
                request.user_id, 
                "Yêu cầu tham gia CLB bị từ chối", 
                `Rất tiếc, yêu cầu của bạn đã bị từ chối. Lý do: ${reason || 'Không rõ'}`, 
                "membership"
            );
            res.json({ message: "Đã từ chối yêu cầu." });
        }
    } catch (err) {
        res.status(500).json({ message: "Lỗi xử lý yêu cầu: " + err.message });
    }
};

// 6. Lấy danh sách thành viên
const getClubMembers = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT cm.id as member_record_id, cm.role, cm.status, u.id as user_id, u.full_name as name, u.email, u.avatar, cm.joined_at
                FROM club_members cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.club_id = @id
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "Lỗi lấy danh sách thành viên" }); }
};

// 7. Thống kê & Xếp hạng trong CLB
const getClubRankings = async (req, res) => {
    const clubId = req.params.id;
    const period = req.query.period || 'month'; 
    const pool = getPool();
    
    try {
        let dateFilter = "";
        if (period === 'month') {
            dateFilter = "AND MONTH(created_at) = MONTH(GETDATE()) AND YEAR(created_at) = YEAR(GETDATE())";
        } else if (period === 'year') {
            dateFilter = "AND YEAR(created_at) = YEAR(GETDATE())";
        }

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

        res.json({
            postRankings: postRankResult.recordset,
            eventRankings: eventRankResult.recordset,
            overview: overviewResult.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi API Rank:", err);
        res.status(500).json({ message: "Lỗi tính toán xếp hạng" });
    }
};

module.exports = {
    getAllClubs,
    createClub,
    updateClub,
    getClubDetail,
    joinClub,
    getClubMembers,
    getClubRankings,
    getClubRequests,
    handleJoinRequest,
    leaveClub,
    deleteClub
};
