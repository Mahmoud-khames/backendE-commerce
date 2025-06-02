const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.Controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// تكوين تخزين الصور (مؤقتًا قبل الرفع إلى Cloudinary)
const storage = multer.memoryStorage();

// فلتر للتأكد من أن الملف المرفوع هو صورة
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError("Only images are allowed", 400), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// مسارات الفئات
router.get("/", categoryController.getAllCategories);
router.get("/:id", authMiddleware, categoryController.getCategoryById);
router.post(
  "/",
  authMiddleware,
  isAdmin,
  upload.single("categoryImage"),
  categoryController.createCategory
);
router.put(
  "/:id",
  authMiddleware,
  isAdmin,
  upload.single("categoryImage"),
  categoryController.updateCategory
);
router.delete(
  "/:id",
  authMiddleware,
  isAdmin,
  categoryController.deleteCategory
);
router.post(
  "/uploadCategoryImage/:id",
  authMiddleware,
  isAdmin,
  upload.single("categoryImage"),
  categoryController.uploadCategoryImage
);

module.exports = router;
