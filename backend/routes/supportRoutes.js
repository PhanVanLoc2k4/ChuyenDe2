const express = require("express");
const router = express.Router();
const supportController = require("../controllers/supportController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Người dùng & Leader
router.post("/requests", verifyToken, supportController.createRequest);
router.get("/my-requests", verifyToken, supportController.getMyRequests);

// Admin nhà trường
router.get("/admin/all", verifyToken, checkRole(['admin']), supportController.getAllRequests);
router.put("/admin/reply/:id", verifyToken, checkRole(['admin']), supportController.replyRequest);

module.exports = router;
