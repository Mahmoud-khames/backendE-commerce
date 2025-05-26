const express = require("express");
const router = express.Router();
const couponController = require("../controllers/coupon.controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// Admin routes
router.get("/", couponController.getAllCoupons);
router.post("/", authMiddleware, isAdmin, couponController.createCoupon);
router.get("/:id", couponController.getCouponById);
router.put("/:id", authMiddleware, isAdmin, couponController.updateCoupon);
router.delete("/:id", authMiddleware, isAdmin, couponController.deleteCoupon);

// Public routes for coupon validation and calculation
router.get("/validate/:code", couponController.validateCoupon);
router.get("/calculate/:code", couponController.calculateDiscount);

module.exports = router;
