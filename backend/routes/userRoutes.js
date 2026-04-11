const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/profile/:id", userController.getProfile);
router.post("/update", userController.updateProfile);
router.get("/clubs/:userId", userController.getUserClubs);
router.get("/requests/:userId", userController.getUserRequests); // Mới

module.exports = router;
