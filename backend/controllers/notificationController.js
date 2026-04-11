const { getPool, sql } = require("../config/database");

// 1. Lấy thông báo theo User
const getNotifications = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("uid", sql.Int, req.params.userId)
            .query("SELECT * FROM notifications WHERE user_id = @uid ORDER BY created_at DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "Lỗi lấy thông báo" }); }
};

// 2. Đánh dấu đã đọc
const markAsRead = async (req, res) => {
    const pool = getPool();
    try {
        await pool.request().input("id", sql.Int, req.params.id).query("UPDATE notifications SET is_read = 1 WHERE id = @id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Lỗi cập nhật thông báo" }); }
};

// 3. Đánh dấu đọc tất cả
const markReadAll = async (req, res) => {
    const pool = getPool();
    try {
        await pool.request().input("uid", sql.Int, req.params.userId).query("UPDATE notifications SET is_read = 1 WHERE user_id = @uid");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Lỗi cập nhật thông báo" }); }
};

module.exports = {
    getNotifications,
    markAsRead,
    markReadAll
};
