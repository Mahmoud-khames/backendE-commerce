// routes/productRoutes.js
const express = require("express");
const router = express.Router();
const ProductController = require("../controllers/product.Controller");
const multer = require("multer");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// تكوين تخزين الصور
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ==================== Public Routes ====================

// البحث والفلترة (يجب أن تكون قبل الـ routes الأخرى)
router.get("/filter", ProductController.filterProducts);
router.get("/available-filters", ProductController.getAvailableFilters);
router.get("/search", ProductController.searchProducts);

// المنتجات المميزة
router.get("/discounted", ProductController.getDiscountedProducts);
router.get("/bestselling", ProductController.getBestSellingProducts);
router.get("/new", ProductController.getNewProducts);

// جميع المنتجات
router.get("/", ProductController.getAllProducts);

// الحصول على منتج بالـ Slug
router.get("/slug/:slug", ProductController.getProductBySlug);
router.get("/:slug", ProductController.getProductBySlug); // للتوافق مع الكود القديم

// ==================== Protected Routes ====================

// Dashboard
router.get(
  "/dashboard/count",
  authMiddleware,
  isAdmin,
  ProductController.getProductsCount
);

// تصدير المنتجات
router.get(
  "/export/all",
  authMiddleware,
  isAdmin,
  ProductController.exportProducts
);

// إنشاء منتج
router.post(
  "/",
  authMiddleware,
  isAdmin,
  upload.any(),
  ProductController.createProduct
);

// تحديث منتج بالـ Slug
router.put(
  "/:slug",
  authMiddleware,
  isAdmin,
  upload.any(),
  ProductController.editProduct
);

// حذف منتج بالـ Slug
router.delete(
  "/:slug",
  authMiddleware,
  isAdmin,
  ProductController.deleteProduct
);

// الحصول على المنتجات حسب التصنيف
router.get(
  "/category/:categoryId",
  ProductController.getProductsByCategory
);

// تحديث حالة المنتجات
router.post(
  "/update-statuses",
  authMiddleware,
  isAdmin,
  ProductController.updateProductStatuses
);

// إعادة تعيين الخصومات المنتهية
router.post(
  "/reset-discounts",
  authMiddleware,
  isAdmin,
  ProductController.resetExpiredDiscounts
);

module.exports = router;