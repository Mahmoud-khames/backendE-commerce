const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// تكوين تخزين الصور (مؤقتًا قبل الرفع إلى Cloudinary)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../public/uploads/temp");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  },
});

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
router.put(
  "/:productId",
  authMiddleware,
  reviewController.updateReviewByProductId
);
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

module.exports = router;
