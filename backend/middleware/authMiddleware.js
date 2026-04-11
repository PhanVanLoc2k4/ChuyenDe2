const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/database");

const verifyToken = (req, res, next) => {
    // Lấy token từ header Authorization (Bearer <token>) hoặc từ query string
    const authHeader = req.headers["authorization"];
    const token = (authHeader && authHeader.split(" ")[1]) || req.query.token;

    if (!token) {
        return res.status(401).json({ message: "Không tìm thấy Token. Vui lòng đăng nhập lại!" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Lưu thông tin định danh vào request
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
};

// Middleware kiểm tra vai trò (Phân quyền)
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Vui lòng đăng nhập!" });
        }
        
        // roles có thể là 1 string hoặc 1 array các roles hợp lệ
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Bạn không có quyền thực hiện hành động này!" });
        }
        next();
    };
};

module.exports = { verifyToken, checkRole };
