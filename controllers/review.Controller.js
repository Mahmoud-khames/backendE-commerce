const reviewModel = require("../models/reviewsModel");
const AppError = require("../utils/AppError");
const mongoose = require('mongoose');
class ReviewController {
  async getAllReviews(req, res, next) {
    const reviews = await reviewModel.find({});
    if (reviews) {
      return res.json({ reviews });
    } else {
      return next(new AppError("Failed to get reviews", 500));
    }
  }

  async updateReviewByProductId(req, res) {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    try {
      const review = await reviewModel.findByIdAndUpdate(productId, {
        rating,
        comment,
      });
      if (review) {
        return res.json({ success: "Review updated successfully" });
      } else {
        return next(new AppError("Failed to update review", 500));
      }
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to update review", 500));
    }
  }

  async createReview(req, res, next) {
    const { productId, rating, comment } = req.body;
    try {
      const review = await reviewModel.create({
        user: req.user._id, // Get user from auth middleware
        product: productId,
        rating,
        comment,
      });
      if (review) {
        return res.json({ success: true, message: "Review created successfully", review });
      } else {
        return next(new AppError("Failed to create review", 500));
      }
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to create review", 500));
    }
  }
  async deleteReview(req, res, next) {
    const { id } = req.params;
    try {
      // First find the review to get the product ID
      const review = await reviewModel.findById(id);
      
      if (!review) {
        return next(new AppError("Review not found", 404));
      }
      
      // Get the product ID before deleting the review
      const productId = review.product;
      
      // Delete the review
      await reviewModel.findByIdAndDelete(id);
      
      // Update the product to remove this review from productReviews array
      const Product = mongoose.model('Product');
      await Product.findByIdAndUpdate(
        productId,
        { $pull: { productReviews: id } }
      );
      
      // Recalculate average rating
      const remainingReviews = await reviewModel.find({ product: productId });
      const totalRating = remainingReviews.reduce((sum, rev) => sum + rev.rating, 0);
      const averageRating = remainingReviews.length > 0 ? totalRating / remainingReviews.length : 0;
      
      await Product.findByIdAndUpdate(
        productId,
        { productRating: averageRating }
      );
      
      return res.json({ 
        success: true, 
        message: "Review deleted successfully" 
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to delete review", 500));
    }
  }
  async getReviewsByProductId(req, res, next) {
    const { productId } = req.params;
    try {
      // Check if productId is valid
      if (!productId) {
        return next(new AppError("Product ID is required", 400));
      }
      
      const reviews = await reviewModel.find({ product: productId })
        .populate('user', 'firstName lastName email'); // Populate user details
      
      // Return empty array if no reviews found instead of error
      return res.json({ 
        success: true, 
        reviews: reviews || [] 
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to get reviews", 500));
    }
  }
  async uploadReviewImage(req, res, next) {
    try {
      const { reviewId } = req.body;
      
      if (!req.file) {
        return next(new AppError("No image uploaded", 400));
      }
      
      const imagePath = `/backend/uploads/reviews/${req.file.filename}`;
      
      const review = await reviewModel.findByIdAndUpdate(
        reviewId,
        { $push: { images: imagePath } },
        { new: true }
      );
      
      if (review) {
        return res.json({ 
          success: true, 
          message: "Review image uploaded successfully",
          image: imagePath
        });
      } else {
        return next(new AppError("Failed to upload review image", 500));
      }
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to upload review image", 500));
    }
  }
}

const reviewController = new ReviewController();
module.exports = reviewController;
