const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/reviews");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage: storage });

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

module.exports = router;
