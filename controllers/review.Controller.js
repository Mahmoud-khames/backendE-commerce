const reviewModel = require("../models/reviewsModel");
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/cloudinaryUpload");

class ReviewController {
  async getAllReviews(req, res, next) {
    try {
      const reviews = await reviewModel.find({});
      return res.json({ success: true, reviews });
    } catch (error) {
      return next(new AppError("Failed to get reviews", 500));
    }
  }

  async getReviewsByProductId(req, res, next) {
    const { productId } = req.params;
    if (!productId) return next(new AppError("Product ID is required", 400));
    try {
      const reviews = await reviewModel
        .find({ product: productId })
        .populate("user", "firstName lastName email");
      return res.json({ success: true, reviews });
    } catch (error) {
      return next(new AppError("Failed to get reviews", 500));
    }
  }

  async createReview(req, res, next) {
    const { productId, rating, comment } = req.body;
    try {
      const existingReview = await reviewModel.findOne({
        user: req.user._id,
        product: productId,
      });
      if (existingReview) {
        return next(
          new AppError("You have already reviewed this product", 400)
        );
      }

      const review = await reviewModel.create({
        user: req.user._id,
        product: productId,
        rating,
        comment,
      });

      return res.json({
        success: true,
        message: "Review created successfully",
        review,
      });
    } catch (error) {
      console.error(error);
      return next(new AppError("Failed to create review", 500));
    }
  }

  async updateReviewById(req, res, next) {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    try {
      const review = await reviewModel.findByIdAndUpdate(
        reviewId,
        { rating, comment },
        { new: true, runValidators: true }
      );

      if (!review) {
        return next(new AppError("Review not found", 404));
      }

      return res.json({ success: true, message: "Review updated", review });
    } catch (error) {
      console.error(error);
      return next(new AppError("Failed to update review", 500));
    }
  }

  async deleteReview(req, res, next) {
    const { id } = req.params;
    try {
      const review = await reviewModel.findById(id);
      if (!review) return next(new AppError("Review not found", 404));

      const productId = review.product;
      await reviewModel.findByIdAndDelete(id);

      const Product = mongoose.model("Product");
      await Product.findByIdAndUpdate(productId, {
        $pull: { productReviews: id },
      });

      const remainingReviews = await reviewModel.find({ product: productId });
      const totalRating = remainingReviews.reduce(
        (sum, rev) => sum + rev.rating,
        0
      );
      const averageRating =
        remainingReviews.length > 0 ? totalRating / remainingReviews.length : 0;

      await Product.findByIdAndUpdate(productId, {
        productRating: averageRating,
      });

      return res.json({
        success: true,
        message: "Review deleted successfully",
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to delete review", 500));
    }
  }

  async uploadReviewImage(req, res, next) {
    try {
      const { reviewId } = req.body;
      if (!req.file) {
        return next(new AppError("No image uploaded", 400));
      }

      // رفع الصورة على Cloudinary
      const result = await uploadToCloudinary(req.file.buffer, "reviews");

      const review = await reviewModel.findByIdAndUpdate(
        reviewId,
        { $push: { images: result.url } },
        { new: true }
      );

      if (!review) {
        return next(new AppError("Review not found", 404));
      }

      return res.status(200).json({
        success: true,
        message: "Review image uploaded successfully",
        image: result.url,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return next(
        new AppError(`Failed to upload image: ${error.message}`, 500)
      );
    }
  }

  async deleteReviewImage(req, res, next) {
    try {
      const { reviewId, imageIndex } = req.body;
      const review = await reviewModel.findById(reviewId);
      if (!review) return next(new AppError("Review not found", 404));

      const imageUrl = review.images[imageIndex];
      if (!imageUrl) {
        return next(new AppError("Image not found at this index", 404));
      }

      const publicId = imageUrl.split("/").pop().split(".")[0];
      await deleteFromCloudinary(publicId, "reviews");

      review.images.splice(imageIndex, 1);
      await review.save();

      return res.status(200).json({
        success: true,
        message: "Review image deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      return next(new AppError("Failed to delete image", 500));
    }
  }
}

module.exports = new ReviewController();
