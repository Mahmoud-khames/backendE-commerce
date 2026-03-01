const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authMiddleware, authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerificationCode);

// Protected routes
router.get("/me", authMiddleware, authController.getCurrentUser);
router.put("/profile", authMiddleware, authController.updateProfile);
router.put("/change-password", authMiddleware, authController.changePassword);

// Admin routes
router.get("/users", authMiddleware, isAdmin, authController.getAllUsers);
router.post("/isAdmin", authMiddleware, isAdmin, authController.isAdmin);

module.exports = router;