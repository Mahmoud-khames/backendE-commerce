// routes/cartRoutes.js
const express = require("express");
const router = express.Router();
const CartController = require("../controllers/cart.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// جميع المسارات تتطلب تسجيل الدخول
router.use(authMiddleware);

// ==================== User Routes ====================

// الحصول على السلة / إضافة منتج
router.route("/")
  .get(CartController.getCart)
  .post(CartController.addToCart);

// ملخص السلة
router.get("/summary", CartController.getCartSummary);

// التحقق من صحة السلة
router.post("/validate", CartController.validateCart);

// مسح السلة
router.delete("/clear", CartController.clearCart);

// دمج سلة الضيف
router.post("/merge-guest", CartController.mergeGuestCart);

// إدارة الكوبون
router.post("/coupon/apply", CartController.applyCoupon);
router.delete("/coupon/remove", CartController.removeCoupon);

// تحديث / حذف عنصر
router.route("/:id")
  .put(CartController.updateCartItem)
  .delete(CartController.removeFromCart);

// ==================== Admin Routes ====================

// الحصول على جميع السلات
router.get(
  "/admin/all",
  isAdmin,
  CartController.getAllCarts
);

// إحصائيات السلات
router.get(
  "/admin/stats",
  isAdmin,
  CartController.getCartStats
);

// السلات المهجورة
router.get(
  "/admin/abandoned",
  isAdmin,
  CartController.getAbandonedCarts
);

// تنظيف السلات القديمة
router.delete(
  "/admin/cleanup",
  isAdmin,
  CartController.cleanupOldCarts
);

module.exports = router;