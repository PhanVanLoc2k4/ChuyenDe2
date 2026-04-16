const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");

router.get("/", eventController.getAllEvents);
router.post("/", eventController.createEvent);
router.get("/:id", eventController.getEventDetail);
router.post("/register", eventController.registerEvent);
router.delete("/register", eventController.unregisterEvent);
router.post("/like/:id", eventController.likeEvent);
router.get("/:id/registrations", eventController.getEventRegistrations);
router.put("/:id", eventController.updateEvent); // Mới: Cập nhật sự kiện
router.delete("/:id", eventController.deleteEvent); // Mới: Xóa sự kiện
router.get("/:id/comments", eventController.getEventComments);
router.post("/:id/comments", eventController.createEventComment);

module.exports = router;
