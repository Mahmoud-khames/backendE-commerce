// controllers/reviewController.js
const ReviewService = require('../services/review.service');
const AppError = require('../utils/AppError');

class ReviewController {
  // Helper للحصول على اللغة
  static getLang(req) {
    return req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
           req.query.lang || 
           'en';
  }

  // Helper للاستجابة
  static successResponse(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...data
    });
  }

  // الحصول على جميع المراجعات
  async getAllReviews(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const { result } = await ReviewService.getReviews(req.query, lang);
      
      return ReviewController.successResponse(res, {
        reviews: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          perPage: result.perPage,
          totalPages: result.totalPages
        }
      }, lang === 'ar' ? 'تم جلب المراجعات بنجاح' : 'Reviews fetched successfully');
    } catch (error) {
      console.error('Error getting reviews:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get reviews', 500));
    }
  }

  // الحصول على مراجعات منتج معين
  async getReviewsByProductId(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const { productId } = req.params;

      if (!productId) {
        return next(new AppError(
          lang === 'ar' ? 'معرف المنتج مطلوب' : 'Product ID is required',
          400
        ));
      }

      const result = await ReviewService.getProductReviews(productId, req.query, lang);
      
      return ReviewController.successResponse(res, {
        reviews: result.reviews,
        pagination: result.pagination,
        stats: result.stats
      }, lang === 'ar' ? 'تم جلب المراجعات بنجاح' : 'Reviews fetched successfully');
    } catch (error) {
      console.error('Error getting product reviews:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get reviews', 500));
    }
  }

  // الحصول على مراجعات المستخدم
  async getUserReviews(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      
      const reviews = await ReviewService.getUserReviews(userId, lang);
      
      return ReviewController.successResponse(res, {
        reviews,
        count: reviews.length
      }, lang === 'ar' ? 'تم جلب مراجعاتك بنجاح' : 'Your reviews fetched successfully');
    } catch (error) {
      console.error('Error getting user reviews:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get reviews', 500));
    }
  }

  // إنشاء مراجعة جديدة
  async createReview(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      
      const review = await ReviewService.createReview(userId, req.body, req.files, lang);
      
      return ReviewController.successResponse(res, {
        review
      }, lang === 'ar' ? 'تم إنشاء المراجعة بنجاح' : 'Review created successfully', 201);
    } catch (error) {
      console.error('Error creating review:', error);
      next(error instanceof AppError ? error : new AppError('Failed to create review', 500));
    }
  }

  // تحديث مراجعة
  async updateReviewById(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      const { reviewId } = req.params;
      
      const review = await ReviewService.updateReview(reviewId, userId, req.body, req.files, lang);
      
      return ReviewController.successResponse(res, {
        review
      }, lang === 'ar' ? 'تم تحديث المراجعة بنجاح' : 'Review updated successfully');
    } catch (error) {
      console.error('Error updating review:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update review', 500));
    }
  }

  // حذف مراجعة
  async deleteReview(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin';
      
      const result = await ReviewService.deleteReview(id, userId, isAdmin, lang);
      
      return ReviewController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error('Error deleting review:', error);
      next(error instanceof AppError ? error : new AppError('Failed to delete review', 500));
    }
  }

  // رفع صورة للمراجعة
  async uploadReviewImage(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      const { reviewId } = req.body;
      
      if (!req.file) {
        return next(new AppError(
          lang === 'ar' ? 'لم يتم توفير صورة' : 'No image provided',
          400
        ));
      }
      
      const result = await ReviewService.uploadImage(reviewId, userId, req.file, lang);
      
      return ReviewController.successResponse(res, {
        image: result.image
      }, result.message);
    } catch (error) {
      console.error('Error uploading review image:', error);
      next(error instanceof AppError ? error : new AppError('Failed to upload image', 500));
    }
  }

  // حذف صورة من المراجعة
  async deleteReviewImage(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      const { reviewId, imageIndex } = req.body;
      
      const result = await ReviewService.deleteImage(reviewId, imageIndex, userId, lang);
      
      return ReviewController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error('Error deleting review image:', error);
      next(error instanceof AppError ? error : new AppError('Failed to delete image', 500));
    }
  }

  // الإبلاغ عن مراجعة
  async reportReview(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      const { reviewId } = req.params;
      const { reason } = req.body;
      
      const result = await ReviewService.reportReview(reviewId, userId, reason, lang);
      
      return ReviewController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error('Error reporting review:', error);
      next(error instanceof AppError ? error : new AppError('Failed to report review', 500));
    }
  }

  // تمييز مراجعة كمفيدة
  async markHelpful(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const userId = req.user._id;
      const { reviewId } = req.params;
      
      const result = await ReviewService.markHelpful(reviewId, userId, lang);
      
      return ReviewController.successResponse(res, {
        helpfulCount: result.helpfulCount
      }, result.message);
    } catch (error) {
      console.error('Error marking review as helpful:', error);
      next(error instanceof AppError ? error : new AppError('Failed to mark as helpful', 500));
    }
  }

  // إحصائيات المراجعات (للإدارة)
  async getReviewStats(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const stats = await ReviewService.getReviewStats();
      
      return ReviewController.successResponse(res, {
        stats
      }, lang === 'ar' ? 'تم جلب الإحصائيات بنجاح' : 'Stats fetched successfully');
    } catch (error) {
      console.error('Error getting review stats:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get stats', 500));
    }
  }

  // تغيير حالة المراجعة (للإدارة)
  async toggleReviewStatus(req, res, next) {
    try {
      const lang = ReviewController.getLang(req);
      const { reviewId } = req.params;
      
      const review = await ReviewService.toggleReviewStatus(reviewId, lang);
      
      return ReviewController.successResponse(res, {
        review
      }, lang === 'ar' ? 'تم تغيير حالة المراجعة' : 'Review status toggled');
    } catch (error) {
      console.error('Error toggling review status:', error);
      next(error instanceof AppError ? error : new AppError('Failed to toggle status', 500));
    }
  }
}

module.exports = new ReviewController();