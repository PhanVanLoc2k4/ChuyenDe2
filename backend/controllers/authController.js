const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { getPool, JWT_SECRET, sql } = require("../config/database");
const { validateEmail, calculateAge, generateUserCode } = require("../utils/helpers");

// 📌 BIẾN LƯU TRỮ TẠM THỜI OTP (Lưu trên RAM)
// Trong thực tế khi đưa lên server thật, bạn nên lưu cái này vào Database hoặc Redis.
const tempStorage = {};

// ==========================================
// BƯỚC 1: NHẬN DỮ LIỆU, KIỂM TRA & GỬI OTP
// ==========================================
const sendRegistrationOtp = async (req, res) => {
    const { name, email, password, dob, gender } = req.body;
    const pool = getPool();

    // 1. Kiểm tra đầu vào (Validate y hệt code cũ của bạn)
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
        // 2. Kiểm tra xem Email đã tồn tại trong DB chưa
        const check = await pool.request()
            .input("email", sql.VarChar, email)
            .query("SELECT id FROM users WHERE email = @email");

        if (check.recordset.length > 0) {
            return res.status(400).json({ message: "Email đã tồn tại trong hệ thống" });
        }

        // 3. Tạo mã OTP ngẫu nhiên (6 chữ số)
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 4. Lưu tạm thông tin của user và mã OTP vào bộ nhớ tạm (Hết hạn sau 5 phút)
        tempStorage[email] = {
            name, password, dob, gender,
            otp: otpCode,
            expires: Date.now() + 5 * 60000
        };
        // 5. Cấu hình gửi mail (Dùng Gmail thật của bạn)
        let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "22050089@student.bdu.edu.vn",
                pass: "kmjxbdaltdibftwd"
            },
        });

        // 6. Gửi Email chứa OTP
        let info = await transporter.sendMail({
            from: '"CLB Connect Support" <22050089@student.bdu.edu.vn>',
            to: email,
            subject: "Mã xác nhận đăng ký tài khoản - CLB Connect",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #c53030;">CLB Connect</h2>
                    <h3>Chào ${name},</h3>
                    <p>Mã xác nhận (OTP) để đăng ký tài khoản của bạn là:</p>
                    <h1 style="color: #c53030; letter-spacing: 5px;">${otpCode}</h1>
                    <p>Mã này có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho người khác.</p>
                </div>
            `,
        });

        console.log("📧 Email OTP đã được gửi qua Gmail!");

        res.json({
            message: "Đã gửi mã OTP đến email của bạn. Vui lòng kiểm tra hộp thư (hoặc mục Spam)!"
            // Đã xóa previewUrl vì dùng mail thật không cần link ảo nữa
        });

    } catch (err) {
        console.error("Lỗi gửi OTP đăng ký:", err);
        res.status(500).json({ message: "Lỗi máy chủ khi thiết lập gửi email!" });
    }
};

// ==========================================
// BƯỚC 2: KIỂM TRA MÃ OTP VÀ LƯU VÀO DATABASE
// ==========================================
const verifyAndRegister = async (req, res) => {
    const { email, otp } = req.body;
    const pool = getPool();

    if (!email || !otp) {
        return res.status(400).json({ message: "Thiếu thông tin email hoặc mã OTP!" });
    }

    const record = tempStorage[email];

    // 1. Kiểm tra xem có dữ liệu lưu tạm cho email này không
    if (!record) {
        return res.status(400).json({ message: "Không tìm thấy yêu cầu đăng ký hoặc yêu cầu đã bị hủy!" });
    }

    // 2. Kiểm tra thời gian hết hạn
    if (Date.now() > record.expires) {
        delete tempStorage[email]; // Dọn dẹp rác
        return res.status(400).json({ message: "Mã OTP đã hết hạn! Vui lòng yêu cầu gửi lại mã." });
    }

    // 3. So khớp mã OTP
    if (record.otp !== otp) {
        return res.status(400).json({ message: "Mã OTP không chính xác!" });
    }

    // 4. THÀNH CÔNG -> Tiến hành lưu vào Database
    try {
        const hashedPassword = await bcrypt.hash(record.password, 10);

        await pool.request()
            .input("code", sql.VarChar, generateUserCode())
            .input("name", sql.NVarChar, record.name)
            .input("email", sql.VarChar, email)
            .input("password", sql.VarChar, hashedPassword)
            .input("dob", sql.Date, record.dob)
            .input("gender", sql.NVarChar, record.gender || "Khác")
            .query(`
                INSERT INTO users (user_code, full_name, email, password, dob, gender, role)
                VALUES (@code, @name, @email, @password, @dob, @gender, 'student')
            `);

        // 5. Xóa dữ liệu tạm để giải phóng RAM và tránh lỗi lặp
        delete tempStorage[email];

        res.json({ message: "Xác thực và đăng ký tài khoản thành công!" });
    } catch (err) {
        console.error("Lỗi khi lưu DB đăng ký:", err);
        res.status(500).json({ message: "Lỗi server khi lưu thông tin người dùng!" });
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
                SELECT * FROM users WHERE email = @email
            `);

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ message: "Email không tồn tại!" });

        if (user.status === 'locked') {
            return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ!" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Mật khẩu không chính xác!" });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role || 'student' },
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
            role: user.role || 'student'
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

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Vui lòng nhập email!" });

    try {
        const pool = getPool();
        const check = await pool.request()
            .input("email", sql.VarChar, email)
            .query("SELECT id, full_name FROM users WHERE email = @email");

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: "Email không tồn tại trong hệ thống!" });
        }

        const user = check.recordset[0];

        // Tạo tài khoản test Ethereal (Fake Email Service)
        let testAccount = await nodemailer.createTestAccount();

        let transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });

        // Tạo Token Đặt Lại Mật Khẩu (Hạn 15 phút)
        const resetToken = jwt.sign(
            { email: email, purpose: "reset_password" },
            JWT_SECRET,
            { expiresIn: "15m" }
        );

        // Tạo link trỏ tới giao diện Đặt lại mật khẩu với JWT token
        const resetLink = `http://localhost:5000/datlaimatkhau?token=${resetToken}`;

        let info = await transporter.sendMail({
            from: '"CLB Connect Support" <support@clbconnect.com>',
            to: email,
            subject: "Yêu cầu khôi phục mật khẩu - CLB Connect",
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #c53030;">CLB Connect</h2>
                    <h3>Chào ${user.full_name},</h3>
                    <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào nút bên dưới để tiến hành:</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 12px 25px; background: #c53030; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Đặt lại mật khẩu</a>
                    <p style="margin-top: 20px; color: #666; font-size: 13px;">Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
                   </div>`,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log("📧 Email khôi phục đã được gửi. Link xem trước (Ethereal):", previewUrl);

        res.json({
            message: "Thành công! Vui lòng kiểm tra hộp thư đến của bạn.",
            previewUrl: previewUrl // Trả về frontend để hiển thị (chỉ dùng cho môi trường Dev)
        });

    } catch (err) {
        console.error("Lỗi gửi email quên mật khẩu:", err);
        res.status(500).json({ message: "Lỗi máy chủ khi thiết lập email!" });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: "Thiếu thông tin xác thực hoặc mật khẩu mới!" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "Mật khẩu phải từ 6 ký tự trở lên!" });
    }

    try {
        // Xác thực Token
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.purpose !== "reset_password") {
            return res.status(400).json({ message: "Token không hợp lệ!" });
        }

        const email = decoded.email;
        const pool = getPool();

        // Băm mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Cập nhật Database
        const result = await pool.request()
            .input("password", sql.VarChar, hashedPassword)
            .input("email", sql.VarChar, email)
            .query("UPDATE users SET password = @password WHERE email = @email");

        if (result.rowsAffected[0] === 0) {
            return res.status(400).json({ message: "Không tìm thấy người dùng để cập nhật mật khẩu!" });
        }

        res.json({ message: "Mật khẩu của bạn đã được cập nhật thành công!" });

    } catch (err) {
        console.error("Lỗi đặt lại mật khẩu:", err);
        if (err.name === 'TokenExpiredError') {
            return res.status(400).json({ message: "Đường dẫn khôi phục đã hết hạn (quá 15 phút). Vui lòng yêu cầu lại!" });
        }
        res.status(400).json({ message: "Đường dẫn không hợp lệ hoặc đã bị lỗi!" });
    }
};

module.exports = {
    sendRegistrationOtp,
    verifyAndRegister,
    login,
    getUserStats,
    forgotPassword,
    resetPassword
};