const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.Controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// تكوين تخزين الصور
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../public/uploads/users");
    fs.mkdirSync(uploadPath, { recursive: true }); // التأكد من وجود المجلد
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage });

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
