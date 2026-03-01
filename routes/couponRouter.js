// routes/couponRoutes.js
const express = require("express");
const router = express.Router();
const CouponController = require("../controllers/coupon.controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// ==================== Public Routes ====================

// الحصول على الكوبونات النشطة
router.get("/active", CouponController.getActiveCoupons);

// الحصول على كوبون بالكود (للتحقق العام)
router.get("/code/:code", CouponController.getCouponByCode);

// ==================== Protected Routes (User) ====================

// التحقق من صحة الكوبون
router.post(
  "/validate/:code",
  authMiddleware,
  CouponController.validateCoupon
);

// تطبيق الكوبون
router.post(
  "/apply/:code",
  authMiddleware,
  CouponController.applyCoupon
);

// حساب الخصم (للتوافق مع الكود القديم)
router.get(
  "/calculate/:code",
  CouponController.calculateDiscount
);

// ==================== Protected Routes (Admin) ====================

// الحصول على جميع الكوبونات
router.get(
  "/",
  authMiddleware,
  isAdmin,
  CouponController.getAllCoupons
);

// إحصائيات الكوبونات
router.get(
  "/admin/stats",
  authMiddleware,
  isAdmin,
  CouponController.getCouponStats
);

// الحصول على سجل استخدام كوبون
router.get(
  "/:id/usage-history",
  authMiddleware,
  isAdmin,
  CouponController.getCouponUsageHistory
);

// الحصول على كوبون بالـ ID
router.get(
  "/:id",
  authMiddleware,
  isAdmin,
  CouponController.getCouponById
);

// إنشاء كوبون جديد
router.post(
  "/",
  authMiddleware,
  isAdmin,
  CouponController.createCoupon
);

// تحديث كوبون
router.put(
  "/:id",
  authMiddleware,
  isAdmin,
  CouponController.updateCoupon
);

// حذف كوبون
router.delete(
  "/:id",
  authMiddleware,
  isAdmin,
  CouponController.deleteCoupon
);

// تبديل حالة التفعيل
router.patch(
  "/:id/toggle-status",
  authMiddleware,
  isAdmin,
  CouponController.toggleActiveStatus
);

// نسخ كوبون
router.post(
  "/:id/duplicate",
  authMiddleware,
  isAdmin,
  CouponController.duplicateCoupon
);

module.exports = router;