const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.Controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

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

// مسارات المستخدمين
router.get("/", authMiddleware, isAdmin, userController.getAllUser);
router.get("/:uId", authMiddleware, isAdmin, userController.getSingleUser);
router.put(
  "/:uId",
  authMiddleware,
  isAdmin,
  upload.any(),
  userController.postEditUser
);
router.delete("/:uId", authMiddleware, isAdmin, userController.getDeleteUser);
router.get(
  "/dashboard/count",
  authMiddleware,
  isAdmin,
  userController.getUsersCount
);

// مسار جديد لإنشاء مستخدم جديد
router.post(
  "/",
  authMiddleware,
  isAdmin,
  upload.any(),
  userController.postAddUser
);

module.exports = router;
