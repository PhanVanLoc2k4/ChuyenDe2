const { getPool, sql } = require("../config/database");
const { validatePhone, calculateAge } = require("../utils/helpers");

// 1. Lấy thông tin chi tiết user
const getProfile = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT id, full_name, email, phone, dob, gender, bio, avatar, hobbies, training_points 
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
};

// 2. Cập nhật thông tin user
const updateProfile = async (req, res) => {
    const { id, full_name, phone, dob, gender, bio, avatar, hobbies } = req.body;
    const pool = getPool();
    try {
        if (!full_name || full_name.trim().length < 2) {
            return res.status(400).json({ success: false, message: "Họ và tên không hợp lệ!" });
        }

        if (dob) {
            const age = calculateAge(dob);
            if (age < 16 || age > 100) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Tuổi không hợp lệ (${age} tuổi). Bạn phải từ 16 đến 100 tuổi!` 
                });
            }
        }

        if (phone && !validatePhone(phone)) {
            return res.status(400).json({ success: false, message: "Số điện thoại không đúng định dạng (10-11 số)!" });
        }

        const birthDate = (dob && dob.trim() !== "") ? dob : null;

        await pool.request()
            .input("id", sql.Int, id)
            .input("full_name", sql.NVarChar, full_name)
            .input("phone", sql.NVarChar, phone) 
            .input("dob", sql.Date, birthDate) 
            .input("gender", sql.NVarChar, gender)
            .input("bio", sql.NVarChar, bio)
            .input("hobbies", sql.NVarChar, hobbies)
            .input("avatar", sql.NVarChar(sql.MAX), avatar) 
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
        console.error("❌ Lỗi Update User Profile:", err.message);
        res.status(500).json({ success: false, message: "Lỗi khi lưu vào Database: " + err.message });
    }
};

// 3. Lấy danh sách CLB của User
const getUserClubs = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("userId", sql.Int, req.params.userId)
            .query(`
                SELECT id, club_name as name FROM clubs WHERE created_by = @userId
                UNION
                SELECT c.id, c.club_name as name 
                FROM clubs c
                INNER JOIN club_members cm ON c.id = cm.club_id
                WHERE cm.user_id = @userId AND cm.status = 'active'
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy danh sách CLB" });
    }
};

// 4. Lấy danh sách yêu cầu tham gia đang chờ của User
const getUserRequests = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("userId", sql.Int, req.params.userId)
            .query(`
                SELECT club_id FROM join_requests 
                WHERE user_id = @userId AND status = 'pending'
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy danh sách yêu cầu của người dùng" });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    getUserClubs,
    getUserRequests
};
