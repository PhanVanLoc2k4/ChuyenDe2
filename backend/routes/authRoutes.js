const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register/send-otp", authController.sendRegistrationOtp);
router.post("/register/verify", authController.verifyAndRegister);

router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/user/stats/:userId", authController.getUserStats);

module.exports = router;