// routes/reviewRoutes.js
const express = require("express");
const router = express.Router();
const ReviewController = require("../controllers/review.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const multer = require("multer");

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ==================== Public Routes ====================

// الحصول على جميع المراجعات
router.get("/", ReviewController.getAllReviews);

// الحصول على مراجعات منتج معين
router.get("/product/:productId", ReviewController.getReviewsByProductId);

// ==================== Protected Routes ====================

// الحصول على مراجعات المستخدم الحالي
router.get("/my-reviews", authMiddleware, ReviewController.getUserReviews);

// إنشاء مراجعة جديدة
router.post(
  "/",
  authMiddleware,
  upload.array("images", 5),
  ReviewController.createReview
);

// تحديث مراجعة
router.put(
  "/:reviewId",
  authMiddleware,
  upload.array("images", 5),
  ReviewController.updateReviewById
);

// حذف مراجعة
router.delete("/:id", authMiddleware, ReviewController.deleteReview);

// رفع صورة للمراجعة
router.post(
  "/upload-image",
  authMiddleware,
  upload.single("image"),
  ReviewController.uploadReviewImage
);

// حذف صورة من المراجعة
router.delete(
  "/delete-image",
  authMiddleware,
  ReviewController.deleteReviewImage
);

// الإبلاغ عن مراجعة
router.post(
  "/:reviewId/report",
  authMiddleware,
  ReviewController.reportReview
);

// تمييز مراجعة كمفيدة
router.post(
  "/:reviewId/helpful",
  authMiddleware,
  ReviewController.markHelpful
);

// ==================== Admin Routes ====================

// إحصائيات المراجعات
router.get(
  "/admin/stats",
  authMiddleware,
  isAdmin,
  ReviewController.getReviewStats
);

// تغيير حالة المراجعة
router.patch(
  "/:reviewId/toggle-status",
  authMiddleware,
  isAdmin,
  ReviewController.toggleReviewStatus
);

module.exports = router;