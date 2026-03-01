// routes/customizeRoutes.js
const express = require("express");
const router = express.Router();
const CustomizeController = require("../controllers/customize.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const multer = require("multer");

// تكوين Multer
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

// الحصول على السلايدات النشطة
router.get("/active", CustomizeController.getActiveSlides);

// للتوافق مع الكود القديم
router.get("/", CustomizeController.getImages);

// ==================== Protected Routes (Admin Only) ====================

// الحصول على جميع السلايدات
router.get(
  "/admin/all",
  authMiddleware,
  isAdmin,
  CustomizeController.getAllSlides
);

// الحصول على سلايد بالـ ID
router.get(
  "/:id",
  authMiddleware,
  isAdmin,
  CustomizeController.getSlideById
);

// إنشاء سلايد جديد
router.post(
  "/",
  authMiddleware,
  isAdmin,
  upload.array("slideImages", 10),
  CustomizeController.createSlide
);

// تحديث سلايد
router.put(
  "/:id",
  authMiddleware,
  isAdmin,
  upload.array("slideImages", 10),
  CustomizeController.updateSlide
);

// حذف سلايد
router.delete(
  "/:id",
  authMiddleware,
  isAdmin,
  CustomizeController.deleteSlide
);

// إضافة صورة إلى سلايد
router.post(
  "/image/add",
  authMiddleware,
  isAdmin,
  upload.single("slideImage"),
  CustomizeController.addImage
);

// حذف صورة من سلايد
router.delete(
  "/image/delete",
  authMiddleware,
  isAdmin,
  CustomizeController.deleteImage
);

// إعادة ترتيب الصور
router.post(
  "/:id/images/reorder",
  authMiddleware,
  isAdmin,
  CustomizeController.reorderImages
);

// تبديل حالة التفعيل
router.patch(
  "/:id/toggle-status",
  authMiddleware,
  isAdmin,
  CustomizeController.toggleActiveStatus
);

// إعادة ترتيب السلايدات
router.post(
  "/reorder",
  authMiddleware,
  isAdmin,
  CustomizeController.reorderSlides
);

// نسخ سلايد
router.post(
  "/:id/duplicate",
  authMiddleware,
  isAdmin,
  CustomizeController.duplicateSlide
);

module.exports = router;