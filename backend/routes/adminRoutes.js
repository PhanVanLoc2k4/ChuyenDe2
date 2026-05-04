const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Bảo vệ tất cả các route admin: Chỉ dành cho role 'university'
router.get("/stats", verifyToken, checkRole(['admin', 'university']), adminController.getAdminStats);
router.get("/reports/monthly", verifyToken, checkRole(['admin', 'university']), adminController.getMonthlyReports);
router.get("/users", verifyToken, checkRole(['admin', 'university']), adminController.getAllUsers);
router.put("/users/:id/status", verifyToken, checkRole(['admin', 'university']), adminController.updateUserStatus);

module.exports = router;
