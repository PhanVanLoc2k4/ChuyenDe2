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

module.exports = router;
