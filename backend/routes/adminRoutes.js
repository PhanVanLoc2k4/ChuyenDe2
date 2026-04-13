const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Bảo vệ tất cả các route admin: Chỉ dành cho role 'admin'
router.get("/stats", verifyToken, checkRole(['admin']), adminController.getAdminStats);
router.get("/reports/monthly", verifyToken, checkRole(['admin']), adminController.getMonthlyReports);
router.get("/users", verifyToken, checkRole(['admin']), adminController.getAllUsers);
router.put("/users/:id/status", verifyToken, checkRole(['admin']), adminController.updateUserStatus);

module.exports = router;
