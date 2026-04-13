const { getPool, sql } = require("../config/database");
const { createNotification } = require("../services/notificationService");

// 1. Cộng điểm rèn luyện (Manual or Event based)
const awardPoints = async (req, res) => {
    const { user_id, points, reason, created_by } = req.body;
    const pool = getPool();
    try {
        const uId = parseInt(user_id);
        const pts = parseInt(points);
        
        if (isNaN(uId) || isNaN(pts)) {
            return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
        }

        // Cập nhật tổng điểm trong bảng users
        await pool.request()
            .input("uid", sql.Int, uId)
            .input("pts", sql.Int, pts)
            .query("UPDATE users SET training_points = ISNULL(training_points, 0) + @pts WHERE id = @uid");

        // Lưu vết lịch sử
        await pool.request()
            .input("uid", sql.Int, uId)
            .input("pts", sql.Int, pts)
            .input("reason", sql.NVarChar, reason)
            .input("cb", sql.Int, created_by || null)
            .query(`INSERT INTO training_point_history (user_id, points, reason, created_by, created_at) 
                    VALUES (@uid, @pts, @reason, @cb, GETDATE())`);

        // Gửi thông báo cho sinh viên
        await createNotification(
            uId, 
            "Chúc mừng! Bạn được cộng điểm rèn luyện", 
            `Bạn vừa nhận được ${pts} điểm rèn luyện. Lý do: ${reason}`, 
            "system", 
            "/Profile"
        );

        res.json({ message: "Cộng điểm thành công!", currentPointsAwarded: pts });
    } catch (err) {
        console.error("Lỗi cộng điểm:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi cộng điểm" });
    }
};

// 2. Điểm danh sự kiện & Tự động cộng điểm (5 điểm)
const markAttendance = async (req, res) => {
    const { registration_id, status, admin_id } = req.body; // status: 'attended', 'absent'
    const pool = getPool();
    try {
        // Lấy thông tin đăng ký
        const regInfo = await pool.request()
            .input("rid", sql.Int, registration_id)
            .query("SELECT user_id, event_id, attendance FROM event_registrations WHERE id = @rid");
        
        if (regInfo.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy thông tin đăng ký" });
        
        const reg = regInfo.recordset[0];
        if (reg.attendance === 'attended' && status === 'attended') {
            return res.status(400).json({ message: "Sinh viên này đã được điểm danh trước đó." });
        }

        // Cập nhật trạng thái điểm danh
        await pool.request()
            .input("rid", sql.Int, registration_id)
            .input("st", sql.NVarChar, status)
            .query("UPDATE event_registrations SET attendance = @st WHERE id = @rid");

        // Nếu là 'attended' thì cộng 5 điểm
        if (status === 'attended') {
            const eventRes = await pool.request().input("eid", sql.Int, reg.event_id).query("SELECT event_name FROM events WHERE id = @eid");
            const eventName = eventRes.recordset[0]?.event_name || "Sự kiện";

            await awardPoints({
                body: {
                    user_id: reg.user_id,
                    points: 5,
                    reason: `Tham gia sự kiện: ${eventName}`,
                    created_by: admin_id
                }
            }, {
                json: () => {},
                status: () => ({ json: () => {} })
            });
        }

        res.json({ message: "Điểm danh thành công!" });
    } catch (err) {
        console.error("Lỗi điểm danh:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi điểm danh" });
    }
};

// 3. Lấy lịch sử điểm của một user
const getPointHistory = async (req, res) => {
    const { user_id } = req.params;
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("uid", sql.Int, user_id)
            .query("SELECT * FROM training_point_history WHERE user_id = @uid ORDER BY created_at DESC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải lịch sử điểm" });
    }
};

// 4. Lấy toàn bộ lịch sử điểm (Cho Admin Dashboard)
const getAllPointHistory = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .query(`
                SELECT 
                    h.id, h.points, h.reason, h.created_at,
                    u.full_name as user_name, u.email as user_email,
                    a.full_name as admin_name
                FROM training_point_history h
                JOIN users u ON h.user_id = u.id
                LEFT JOIN users a ON h.created_by = a.id
                ORDER BY h.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Lỗi lấy toàn bộ lịch sử điểm:", err);
        res.status(500).json({ message: "Lỗi tải toàn bộ lịch sử điểm" });
    }
};

module.exports = {
    awardPoints,
    markAttendance,
    getPointHistory,
    getAllPointHistory
};
