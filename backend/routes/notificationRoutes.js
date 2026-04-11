const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

router.get("/:userId", notificationController.getNotifications);
router.put("/read/:id", notificationController.markAsRead);
router.put("/read-all/:userId", notificationController.markReadAll);

module.exports = router;
