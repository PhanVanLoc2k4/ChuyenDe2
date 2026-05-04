const { getPool, sql } = require("../config/database");
const { createNotification } = require("../services/notificationService");

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
                INSERT INTO requests (user_id, type, category, subject, message)
                VALUES (@uid, 'support', @cat, @sub, @msg)
            `);
        res.json({ message: "Gửi yêu cầu thành công! Nhà trường sẽ sớm phản hồi cho bạn." });

        // Gửi thông báo cho Ban quản trị (University)
        try {
            const admins = await pool.request().query("SELECT id FROM users WHERE role IN ('university', 'admin')");
            for (const admin of admins.recordset) {
                await createNotification(
                    admin.id,
                    "Yêu cầu hỗ trợ mới",
                    `Người dùng ${req.user.name || userId} vừa gửi một yêu cầu hỗ trợ mới về: ${subject}`,
                    "system",
                    "/admin"
                );
            }
        } catch (notiErr) {
            console.error("Lỗi gửi thông báo cho Admin:", notiErr.message);
        }
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
                SELECT r.*, u.full_name as replier_name
                FROM requests r
                LEFT JOIN users u ON r.replied_by = u.id
                WHERE r.user_id = @uid AND r.type = 'support'
                ORDER BY r.created_at DESC
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
                SELECT r.*, u.full_name as sender_name, u.email as sender_email, 
                       rep.full_name as replier_name
                FROM requests r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN users rep ON r.replied_by = rep.id
                WHERE r.type = 'support'
                ORDER BY r.status ASC, r.created_at DESC
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
                UPDATE requests 
                SET reply_message = @reply, 
                    status = @status, 
                    replied_by = @replier, 
                    replied_at = GETDATE()
                WHERE id = @id AND type = 'support'
            `);
        res.json({ message: "Đã gửi phản hồi thành công!" });

        // Gửi thông báo cho người gửi yêu cầu
        try {
            const requestInfo = await pool.request()
                .input("rid", sql.Int, id)
                .query("SELECT user_id, subject FROM requests WHERE id = @rid");
            
            if (requestInfo.recordset.length > 0) {
                const targetUserId = requestInfo.recordset[0].user_id;
                const reqSubject = requestInfo.recordset[0].subject;
                await createNotification(
                    targetUserId,
                    "Phản hồi hỗ trợ",
                    `Nhà trường đã phản hồi yêu cầu của bạn: ${reqSubject}`,
                    "system",
                    "/KetNoi"
                );
            }
        } catch (notiErr) {
            console.error("Lỗi gửi thông báo cho User:", notiErr.message);
        }
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
