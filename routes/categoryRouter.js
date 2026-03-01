// routes/categoryRoutes.js
const express = require("express");
const router = express.Router();
const CategoryController = require("../controllers/category.Controller");
const multer = require("multer");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// تكوين تخزين الصور
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ==================== Public Routes ====================

// الحصول على جميع الفئات
router.get("/", CategoryController.getAllCategories);

// الحصول على الفئات النشطة
router.get("/active", CategoryController.getActiveCategories);

// الحصول على الفئات الرئيسية مع الفرعية
router.get("/main-with-subs", CategoryController.getMainCategoriesWithSubs);

// البحث عن الفئات
router.get("/search", CategoryController.searchCategories);

// الحصول على فئة بالـ Slug
router.get("/slug/:slug", CategoryController.getCategoryBySlug);

// الحصول على فئة بالـ ID
router.get("/:id", CategoryController.getCategoryById);

// ==================== Protected Routes (Admin Only) ====================

// الحصول على الفئات مع Pagination
router.get(
  "/admin/paginated",
  authMiddleware,
  isAdmin,
  CategoryController.getCategories
);

// عدد الفئات
router.get(
  "/admin/count",
  authMiddleware,
  isAdmin,
  CategoryController.getCategoriesCount
);

// إنشاء فئة جديدة
router.post(
  "/",
  authMiddleware,
  isAdmin,
  upload.single("categoryImage"),
  CategoryController.createCategory
);

// تحديث فئة
router.put(
  "/:id",
  authMiddleware,
  isAdmin,
  upload.single("categoryImage"),
  CategoryController.updateCategory
);

// حذف فئة (Soft Delete)
router.delete(
  "/:id",
  authMiddleware,
  isAdmin,
  CategoryController.deleteCategory
);

// حذف فئة نهائياً (Hard Delete)
router.delete(
  "/hard/:id",
  authMiddleware,
  isAdmin,
  CategoryController.hardDeleteCategory
);

// رفع صورة الفئة
router.post(
  "/:id/image",
  authMiddleware,
  isAdmin,
  upload.single("categoryImage"),
  CategoryController.uploadCategoryImage
);

// حذف صورة الفئة
router.delete(
  "/:id/image",
  authMiddleware,
  isAdmin,
  CategoryController.deleteCategoryImage
);

// إعادة ترتيب الفئات
router.post(
  "/reorder",
  authMiddleware,
  isAdmin,
  CategoryController.reorderCategories
);

// تغيير حالة الفئة
router.patch(
  "/:id/toggle-status",
  authMiddleware,
  isAdmin,
  CategoryController.toggleCategoryStatus
);

module.exports = router;