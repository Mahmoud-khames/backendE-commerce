const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

router.post("/isAdmin", authMiddleware, isAdmin, authController.isAdmin);
router.post("/allUser", authMiddleware, isAdmin, authController.allUser);
router.post("/signup", authController.postSignup);
router.post("/signin", authController.postSignin);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerificationCode);

module.exports = router;
