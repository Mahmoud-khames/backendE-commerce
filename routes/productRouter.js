const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.Controller");
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

// Public routes (no authentication required)
router.get("/filter", productController.filterProducts);
router.get("/available-filters", productController.getAvailableFilters);
router.get("/search", productController.searchProduct); // Add dedicated search endpoint
router.get("/discounted", productController.getDiscountedProducts); // Make discounted products public
router.get("/bestselling", productController.getBestSellingProducts); // Make best selling products public

// Protected routes
router.get("/", productController.getAllProduct);
router.get("/new",  productController.getNewProducts);
router.get("/dashboard/count", authMiddleware, isAdmin, productController.getProductsCount);
router.get("/:slug", productController.getProductBySlug);
router.post(
  "/",
  authMiddleware,
  isAdmin,
  upload.any(), // Supports both productImage and productImages
  productController.createProduct
);
router.put(
  "/:slug",
  authMiddleware,
  isAdmin,
  upload.any(),
  productController.editProduct
);
router.delete(
  "/:slug",
  authMiddleware,
  isAdmin,
  productController.deleteProduct
);
router.get(
  "/category/:slug",
  authMiddleware,
  productController.getProductByCategory
);

module.exports = router;
