const express = require("express");
const router = express.Router();
const customizeController = require("../controllers/customize.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// تكوين تخزين الصور
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../public/uploads/customize");
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

// مسارات التخصيص
router.get("/", customizeController.getImages);
router.post(
  "/",
  authMiddleware,
  isAdmin,
  upload.array("slideImage", 10),
  customizeController.createCustomize
);
router.post(
  "/uploadSlideImage",
  authMiddleware,
  isAdmin,
  upload.single("slideImage"),
  customizeController.uploadSlideImage
);
router.delete(
  "/deleteSlideImage",
  authMiddleware,
  isAdmin,
  customizeController.deleteSlideImage
);
router.put(
  "/:id",
  authMiddleware,
  isAdmin,
  upload.array("slideImage", 10),
  customizeController.updateCustomize
);
router.delete(
  "/:id",
  authMiddleware,
  isAdmin,
  customizeController.deleteCustomize
);

module.exports = router;