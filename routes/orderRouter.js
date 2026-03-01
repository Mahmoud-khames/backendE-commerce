// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const OrderController = require("../controllers/order.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// ==================== Public Routes ====================

// تتبع الطلب (بدون تسجيل دخول)
router.get("/track/:orderNumber", OrderController.trackOrder);

// ==================== User Routes ====================

// الحصول على طلبات المستخدم
router.get("/user", authMiddleware, OrderController.getUserOrders);

// إنشاء طلب جديد
router.post("/", authMiddleware, OrderController.createOrder);

// الحصول على طلب بالـ ID
router.get("/:id", authMiddleware, OrderController.getOrderById);

// الحصول على طلب برقم الطلب
router.get("/number/:orderNumber", authMiddleware, OrderController.getOrderByNumber);

// إلغاء الطلب
router.post("/:id/cancel", authMiddleware, OrderController.cancelOrder);

// طلب إرجاع
router.post("/:id/return", authMiddleware, OrderController.requestReturn);

// ==================== Admin Routes ====================

// الحصول على جميع الطلبات
router.get("/", authMiddleware, isAdmin, OrderController.getAllOrders);

// عدد الطلبات
router.get("/dashboard/count", authMiddleware, isAdmin, OrderController.getOrdersCount);

// إحصائيات الطلبات
router.get("/dashboard/stats", authMiddleware, isAdmin, OrderController.getOrderStats);

// الإيرادات
router.get("/dashboard/revenue", authMiddleware, isAdmin, OrderController.getRevenue);

// أفضل المنتجات مبيعاً
router.get("/dashboard/top-products", authMiddleware, isAdmin, OrderController.getTopSellingProducts);

// تحديث حالة الطلب
router.patch("/:id/status", authMiddleware, isAdmin, OrderController.updateOrderStatus);

// تحديث معلومات الشحن
router.patch("/:id/shipping", authMiddleware, isAdmin, OrderController.updateShippingInfo);

// تحديث حالة الدفع
router.patch("/:id/payment", authMiddleware, isAdmin, OrderController.updatePaymentStatus);

// حذف الطلب
router.delete("/:id", authMiddleware, isAdmin, OrderController.deleteOrder);

module.exports = router;