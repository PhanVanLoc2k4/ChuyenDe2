const { getPool, sql } = require("../config/database");

// 1. Gửi yêu cầu hỗ trợ mới
const createRequest = async (req, res) => {
    const { category, subject, message } = req.body;
    const userId = req.user.id;
    const pool = getPool();

    if (!category || !subject || !message) {
        return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
    }

    try {
        await pool.request()
            .input("uid", sql.Int, userId)
            .input("cat", sql.NVarChar, category)
            .input("sub", sql.NVarChar, subject)
            .input("msg", sql.NVarChar, message)
            .query(`
                INSERT INTO support_requests (user_id, category, subject, message)
                VALUES (@uid, @cat, @sub, @msg)
            `);
        res.json({ message: "Gửi yêu cầu thành công! Nhà trường sẽ sớm phản hồi cho bạn." });
    } catch (err) {
        console.error("Support Request Error:", err);
        res.status(500).json({ message: "Lỗi gửi yêu cầu: " + err.message });
    }
};

// 2. Lấy danh sách yêu cầu cá nhân
const getMyRequests = async (req, res) => {
    const userId = req.user.id;
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("uid", sql.Int, userId)
            .query(`
                SELECT sr.*, u.full_name as replier_name
                FROM support_requests sr
                LEFT JOIN users u ON sr.replied_by = u.id
                WHERE sr.user_id = @uid
                ORDER BY sr.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải danh sách yêu cầu" });
    }
};

// 3. Admin: Lấy toàn bộ danh sách yêu cầu
const getAllRequests = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .query(`
                SELECT sr.*, u.full_name as sender_name, u.email as sender_email, 
                       r.full_name as replier_name
                FROM support_requests sr
                JOIN users u ON sr.user_id = u.id
                LEFT JOIN users r ON sr.replied_by = r.id
                ORDER BY sr.status ASC, sr.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải danh sách yêu cầu" });
    }
};

// 4. Admin: Phản hồi yêu cầu
const replyRequest = async (req, res) => {
    const { id } = req.params;
    const { reply_message, status } = req.body;
    const replierId = req.user.id;
    const pool = getPool();

    try {
        await pool.request()
            .input("id", sql.Int, id)
            .input("reply", sql.NVarChar, reply_message)
            .input("status", sql.NVarChar, status || 'resolved')
            .input("replier", sql.Int, replierId)
            .query(`
                UPDATE support_requests 
                SET reply_message = @reply, 
                    status = @status, 
                    replied_by = @replier, 
                    replied_at = GETDATE()
                WHERE id = @id
            `);
        res.json({ message: "Đã gửi phản hồi thành công!" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi gửi phản hồi" });
    }
};

module.exports = {
    createRequest,
    getMyRequests,
    getAllRequests,
    replyRequest
};
