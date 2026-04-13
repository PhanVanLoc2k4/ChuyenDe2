const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getPool, JWT_SECRET, sql } = require("../config/database");
const { validateEmail, calculateAge, generateUserCode } = require("../utils/helpers");

const register = async (req, res) => {
    const { name, email, password, dob, gender } = req.body;
    const pool = getPool();

    if (!name || !email || !password || !dob) {
        return res.status(400).json({ message: "Thiếu thông tin" });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({ message: "Email không đúng định dạng!" });
    }
    if (name.trim().length < 2) {
        return res.status(400).json({ message: "Họ và tên quá ngắn!" });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "Mật khẩu phải từ 6 ký tự trở lên!" });
    }

    const age = calculateAge(dob);
    if (age < 16 || age > 100) {
        return res.status(400).json({ message: `Độ tuổi không hợp lệ (${age} tuổi). Bạn phải từ 16 đến 100 tuổi!` });
    }

    try {
        const check = await pool.request()
            .input("email", sql.VarChar, email)
            .query("SELECT id FROM users WHERE email = @email");

        if (check.recordset.length > 0) {
            return res.status(400).json({ message: "Email đã tồn tại trong hệ thống" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input("code", sql.VarChar, generateUserCode())
            .input("name", sql.NVarChar, name)
            .input("email", sql.VarChar, email)
            .input("password", sql.VarChar, hashedPassword)
            .input("dob", sql.Date, dob)
            .input("gender", sql.NVarChar, gender || "Khác")
            .query(`
                INSERT INTO users (user_code, full_name, email, password, dob, gender)
                VALUES (@code, @name, @email, @password, @dob, @gender)
            `);

        res.json({ message: "Đăng ký thành công" });
    } catch (err) {
        console.error("Lỗi đăng ký:", err);
        res.status(500).json({ message: "Lỗi server" });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    const pool = getPool();

    if (!email || !password) return res.status(400).json({ message: "Vui lòng nhập đủ thông tin!" });

    try {
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

        if (user.status === 'locked') {
            return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ!" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Mật khẩu không chính xác!" });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role_name || 'student' },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({
            message: "Đăng nhập thành công!",
            token: token,
            user_id: user.id,
            user_code: user.user_code,
            name: user.full_name,
            avatar: user.avatar || null,
            role: user.role_name || 'student'
        });

    } catch (err) {
        console.error("Lỗi API Đăng nhập:", err);
        res.status(500).json({ message: "Lỗi máy chủ!" });
    }
};

const getUserStats = async (req, res) => {
    const userId = req.params.userId;
    const pool = getPool();
    try {
        const postCountRes = await pool.request()
            .input("uid", sql.Int, userId)
            .query("SELECT COUNT(*) as count FROM posts WHERE user_id = @uid");
            
        const clubCountRes = await pool.request()
            .input("uid", sql.Int, userId)
            .query("SELECT COUNT(*) as count FROM club_members WHERE user_id = @uid AND status = 'active'");
        
        res.json({
            postCount: postCountRes.recordset[0].count,
            clubCount: clubCountRes.recordset[0].count
        });
    } catch (err) {
        console.error("Lỗi lấy stats user:", err);
        res.status(500).json({ postCount: 0, clubCount: 0 });
    }
};

module.exports = {
    register,
    login,
    getUserStats
};
