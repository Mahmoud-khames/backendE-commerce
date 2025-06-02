const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// تكوين تخزين الصور (مؤقتًا قبل الرفع إلى Cloudinary)
const storage = multer.memoryStorage();

// فلتر للتأكد من أن الملف المرفوع هو صورة
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

router.get("/", reviewController.getAllReviews);
router.get("/:productId", reviewController.getReviewsByProductId);
router.post("/", authMiddleware, reviewController.createReview);
// router.put(
//   "/:productId",
//   authMiddleware,
//   reviewController.updateReviewByProductId
// );
router.delete("/:id", authMiddleware, reviewController.deleteReview);
router.post(
  "/uploadReviewImage",
  authMiddleware,
  upload.single("image"),
  reviewController.uploadReviewImage
);
// إضافة مسار لحذف صورة المراجعة
router.delete(
  "/deleteReviewImage",
  authMiddleware,
  reviewController.deleteReviewImage
);
router.put("/reviews/:reviewId", reviewController.updateReviewById);

module.exports = router;
