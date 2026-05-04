const { getPool, sql } = require("../config/database");

// 1. Lấy thống kê tổng quan (Dashboard) với bộ lọc thời gian
const getAdminStats = async (req, res) => {
    const month = req.query.month;
    const year = req.query.year;
    const pool = getPool();
    try {
        let statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM users #FILTER#) as totalUsers,
                (SELECT COUNT(*) FROM clubs WHERE status = 'active' #FILTER_AND#) as totalClubs,
                (SELECT COUNT(*) FROM events WHERE status = 'active' #FILTER_AND#) as totalEvents
        `;
        
        let dateFilter = "";
        let request = pool.request();

        if (month && year && month !== 'all' && year !== 'all') {
            dateFilter = " WHERE MONTH(created_at) = @m AND YEAR(created_at) = @y ";
            request.input("m", sql.Int, month).input("y", sql.Int, year);
        } else if (year && year !== 'all') {
            dateFilter = " WHERE YEAR(created_at) = @y ";
            request.input("y", sql.Int, year);
        }

        statsQuery = statsQuery.replace("#FILTER#", dateFilter);
        statsQuery = statsQuery.replace(/#FILTER_AND#/g, dateFilter ? dateFilter.replace('WHERE', 'AND') : '');

        const stats = await request.query(statsQuery);

        const topClubsQuery = `
            SELECT TOP 5 
                c.id, c.club_name, c.logo_url,
                (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count,
                (SELECT COUNT(*) FROM events WHERE club_id = c.id) as event_count,
                (SELECT COUNT(*) FROM posts WHERE club_id = c.id) as post_count
            FROM clubs c
            ORDER BY (
                (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) + 
                (SELECT COUNT(*) FROM events WHERE club_id = c.id) + 
                (SELECT COUNT(*) FROM posts WHERE club_id = c.id)
            ) DESC
        `;
        const topClubs = await pool.request().query(topClubsQuery);

        res.json({
            ...stats.recordset[0],
            topClubs: topClubs.recordset
        });
    } catch (err) {
        console.error("Stats Error:", err);
        res.status(500).json({ message: "Lỗi lấy thống kê Admin: " + err.message });
    }
};

// 2. Lấy báo cáo hàng tháng cho biểu đồ
const getMonthlyReports = async (req, res) => {
    const pool = getPool();
    try {
        const year = new Date().getFullYear();
        
        // Thống kê CLB mới theo tháng
        const clubsRes = await pool.request()
            .input("year", sql.Int, year)
            .query(`
                SELECT MONTH(created_at) as month, COUNT(*) as count 
                FROM clubs 
                WHERE YEAR(created_at) = @year AND status = 'active'
                GROUP BY MONTH(created_at)
            `);
            
        // Thống kê Sự kiện mới theo tháng
        const eventsRes = await pool.request()
            .input("year", sql.Int, year)
            .query(`
                SELECT MONTH(created_at) as month, COUNT(*) as count 
                FROM events 
                WHERE YEAR(created_at) = @year AND status = 'active'
                GROUP BY MONTH(created_at)
            `);

        const labels = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
        const reportData = labels.map((label, index) => {
            const month = index + 1;
            const clubCount = clubsRes.recordset.find(r => r.month === month)?.count || 0;
            const eventCount = eventsRes.recordset.find(r => r.month === month)?.count || 0;
            return {
                label,
                newClubs: clubCount,
                newEvents: eventCount
            };
        });

        res.json(reportData);
    } catch (err) {
        console.error("Monthly Report Error:", err);
        res.status(500).json({ message: "Lỗi lấy báo cáo hàng tháng" });
    }
};

// 3. Lấy danh sách người dùng (Hỗ trợ lọc thời gian, tìm kiếm và vai trò)
const getAllUsers = async (req, res) => {
    const { month, year, search, role } = req.query;
    const pool = getPool();
    try {
        let query = `
            SELECT 
                u.id, u.full_name, u.email, u.role, 
                ISNULL(u.created_at, GETDATE()) as created_at, u.avatar, u.status
            FROM users u
            WHERE 1=1
        `;
        let request = pool.request();

        // Lọc theo thời gian
        if (month && year && month !== 'all' && year !== 'all') {
            query += " AND MONTH(u.created_at) = @m AND YEAR(u.created_at) = @y ";
            request.input("m", sql.Int, month).input("y", sql.Int, year);
        } else if (year && year !== 'all') {
            query += " AND YEAR(u.created_at) = @y ";
            request.input("y", sql.Int, year);
        }

        // Lọc theo tìm kiếm (tên, email hoặc vai trò)
        if (search) {
            query += " AND (u.full_name LIKE @search OR u.email LIKE @search OR u.role LIKE @search) ";
            request.input("search", sql.NVarChar, `%${search}%`);
        }

        // Lọc theo vai trò
        if (role && role !== 'all') {
            query += " AND u.role = @role ";
            request.input("role", sql.NVarChar, role);
        }

        query += " ORDER BY u.created_at DESC ";
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Lỗi lấy danh sách người dùng:", err);
        res.status(500).json({ message: "Lỗi lấy danh sách người dùng" });
    }
};

// 4. Khóa/Mở khóa tài khoản người dùng
const updateUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const pool = getPool();
    try {
        await pool.request()
            .input("id", sql.Int, id)
            .input("status", sql.NVarChar, status)
            .query("UPDATE users SET status = @status WHERE id = @id");
        res.json({ message: `Đã cập nhật trạng thái người dùng thành ${status}` });
    } catch (err) {
        console.error("Lỗi cập nhật status user:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi cập nhật trạng thái" });
    }
};

module.exports = {
    getAdminStats,
    getMonthlyReports,
    getAllUsers,
    updateUserStatus
};
