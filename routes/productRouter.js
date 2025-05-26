const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.Controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../public/uploads/products");
    fs.mkdirSync(uploadPath, { recursive: true }); // Ensure folder exists
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage });

// Public routes (no authentication required)
router.get("/filter", productController.filterProducts);
router.get("/available-filters", productController.getAvailableFilters);
router.get("/search", productController.searchProduct); // Add dedicated search endpoint
router.get("/discounted", productController.getDiscountedProducts); // Make discounted products public
router.get("/bestselling", productController.getBestSellingProducts); // Make best selling products public

// Protected routes
router.get("/", authMiddleware, productController.getAllProduct);
router.get("/new", authMiddleware, productController.getNewProducts);
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
router.get("/search/:slug", authMiddleware, productController.searchProduct);
router.get(
  "/price/:price",
  authMiddleware,
  productController.getProductByPrice
);
router.post(
  "/reset-expired-discounts",
  authMiddleware,
  isAdmin,
  productController.resetExpiredDiscounts
);

module.exports = router;
