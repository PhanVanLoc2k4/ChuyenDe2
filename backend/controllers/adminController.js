const { getPool, sql } = require("../config/database");

// 1. Lấy thống kê tổng quan (Dashboard)
const getAdminStats = async (req, res) => {
    const pool = getPool();
    try {
        const stats = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as totalUsers,
                (SELECT COUNT(*) FROM clubs WHERE status = 'active') as totalClubs,
                (SELECT COUNT(*) FROM events WHERE status = 'active') as totalEvents,
                (SELECT COUNT(*) FROM join_requests WHERE status = 'pending') as pendingRequests
        `);
        res.json(stats.recordset[0]);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy thống kê Admin" });
    }
};

// 2. Báo cáo theo tháng
const getMonthlyReports = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request().query(`
            WITH Months AS (
                SELECT TOP 12 
                    CAST(DATEADD(MONTH, - (ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1), GETDATE()) AS DATE) as MonthDate
                FROM sys.objects
            )
            SELECT 
                FORMAT(MonthDate, 'MM/yyyy') as label,
                (SELECT COUNT(*) FROM clubs WHERE FORMAT(created_at, 'MM/yyyy') = FORMAT(MonthDate, 'MM/yyyy')) as newClubs,
                (SELECT COUNT(*) FROM events WHERE FORMAT(created_at, 'MM/yyyy') = FORMAT(MonthDate, 'MM/yyyy')) as newEvents
            FROM Months
            ORDER BY MonthDate ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy báo cáo tháng" });
    }
};

// 3. Lấy danh sách người dùng
const getAllUsers = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request().query(`
            SELECT 
                u.id, u.full_name, u.email, ISNULL(r.role_name, 'user') as [role], 
                ISNULL(u.created_at, GETDATE()) as created_at, u.avatar
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            ORDER BY u.created_at DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy danh sách người dùng" });
    }
};

module.exports = {
    getAdminStats,
    getMonthlyReports,
    getAllUsers
};
