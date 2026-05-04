const express = require("express");
const router = express.Router();
const pointController = require("../controllers/pointController");

router.post("/award", pointController.awardPoints);
router.post("/attendance", pointController.markAttendance);
router.get("/history/:user_id", pointController.getPointHistory);

// Admin-facing
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
router.get("/all", verifyToken, checkRole(['admin', 'university']), pointController.getAllPointHistory);

module.exports = router;
