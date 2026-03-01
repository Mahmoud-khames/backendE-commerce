// services/reviewService.js
const MongooseFeatures = require('./mongodb/features/index');
const ReviewModel = require('../models/reviewsModel');
const ProductModel = require('../models/productModel');
const OrderModel = require('../models/orderModel'); // إذا كان موجود
const { pick } = require('lodash');
const AppError = require('../utils/AppError');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

class ReviewService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = ['user', 'product', 'rating', 'comment', 'images', 'status'];
    
    this.populateOptions = [
      { path: 'user', select: 'firstName lastName email avatar' },
      { 
        path: 'product', 
        select: 'productNameEn productNameAr productImage productSlug productPrice' 
      }
    ];
  }

  // ==================== Helper Methods ====================

  getLangMessage(lang, enMsg, arMsg) {
    return lang === 'ar' ? arMsg : enMsg;
  }

  // التحقق من شراء المنتج
  async hasUserPurchasedProduct(userId, productId) {
    try {
      // إذا كان لديك نظام طلبات
      if (OrderModel) {
        const order = await OrderModel.findOne({
          user: userId,
          'products.product': productId,
          status: { $in: ['delivered', 'completed'] }
        });
        return !!order;
      }
      return false;
    } catch (error) {
      console.error('Error checking purchase:', error);
      return false;
    }
  }

  // رفع صور المراجعة
  async uploadReviewImages(files) {
    if (!files || files.length === 0) return [];
    
    const uploadPromises = files.map(file => 
      uploadToCloudinary(file.buffer || file.path, 'reviews')
    );
    
    const results = await Promise.all(uploadPromises);
    return results.map(r => r.url);
  }

  // حذف صورة من المراجعة
  async deleteReviewImage(imageUrl) {
    if (!imageUrl) return;
    
    try {
      const publicId = imageUrl.split('/').pop().split('.')[0];
      await deleteFromCloudinary(publicId, 'reviews');
    } catch (error) {
      console.error('Failed to delete review image:', error);
    }
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع المراجعات
  async getReviews(query = {}, lang = 'en') {
    const { 
      perPage = 15, 
      page = 1, 
      sorts = [], 
      queries = [],
      status,
      rating 
    } = pick(query, ['perPage', 'page', 'sorts', 'queries', 'status', 'rating']);

    const result = await this.PaginateHandler(
      ReviewModel, 
      Number(perPage), 
      Number(page), 
      sorts, 
      queries
    );

    if (result.data && result.data.length > 0) {
      await ReviewModel.populate(result.data, this.populateOptions);
    }

    return { result, keys: this.allowedKeys };
  }

  // الحصول على مراجعات منتج معين
  async getProductReviews(productId, query = {}, lang = 'en') {
    const { page = 1, limit = 10, sort = 'newest' } = query;
    const skip = (page - 1) * limit;

    // التحقق من وجود المنتج
    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new AppError(
        this.getLangMessage(lang, 'Product not found', 'المنتج غير موجود'),
        404
      );
    }

    // تحديد الترتيب
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'oldest': sortOption = { createdAt: 1 }; break;
      case 'highest': sortOption = { rating: -1 }; break;
      case 'lowest': sortOption = { rating: 1 }; break;
      case 'helpful': sortOption = { helpfulCount: -1 }; break;
    }

    const total = await ReviewModel.countDocuments({ product: productId, status: true });
    
    const reviews = await ReviewModel.find({ product: productId, status: true })
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'firstName lastName avatar');

    // الحصول على إحصائيات التقييم
    const ratingStats = await ReviewModel.getRatingStats(productId);

    return {
      reviews,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      },
      stats: ratingStats
    };
  }

  // الحصول على مراجعة واحدة
  async getReviewById(id, lang = 'en') {
    const review = await ReviewModel.findById(id).populate(this.populateOptions);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }
    
    return review;
  }

  // الحصول على مراجعات المستخدم
  async getUserReviews(userId, lang = 'en') {
    const reviews = await ReviewModel.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('product', 'productNameEn productNameAr productImage productSlug');
    
    return reviews;
  }

  // إنشاء مراجعة جديدة
  async createReview(userId, body, files, lang = 'en') {
    const { productId, rating, comment } = body;

    // التحقق من الحقول المطلوبة
    if (!productId) {
      throw new AppError(
        this.getLangMessage(lang, 'Product ID is required', 'معرف المنتج مطلوب'),
        400
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      throw new AppError(
        this.getLangMessage(lang, 'Rating must be between 1 and 5', 'التقييم يجب أن يكون بين 1 و 5'),
        400
      );
    }

    if (!comment || comment.trim() === '') {
      throw new AppError(
        this.getLangMessage(lang, 'Comment is required', 'التعليق مطلوب'),
        400
      );
    }

    // التحقق من وجود المنتج
    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new AppError(
        this.getLangMessage(lang, 'Product not found', 'المنتج غير موجود'),
        404
      );
    }

    // التحقق من عدم وجود مراجعة سابقة
    const existingReview = await ReviewModel.findOne({ 
      user: userId, 
      product: productId 
    });
    
    if (existingReview) {
      throw new AppError(
        this.getLangMessage(lang, 'You have already reviewed this product', 'لقد قمت بمراجعة هذا المنتج مسبقاً'),
        400
      );
    }

    // التحقق من الشراء
    const isVerifiedPurchase = await this.hasUserPurchasedProduct(userId, productId);

    // رفع الصور
    let images = [];
    if (files && files.length > 0) {
      images = await this.uploadReviewImages(files);
    }

    // إنشاء المراجعة
    const review = await ReviewModel.create({
      user: userId,
      product: productId,
      rating: Number(rating),
      comment: comment.trim(),
      images,
      isVerifiedPurchase,
      status: true
    });

    await review.populate(this.populateOptions);

    return review;
  }

  // تحديث مراجعة
  async updateReview(reviewId, userId, body, files, lang = 'en') {
    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }

    // التحقق من ملكية المراجعة
    if (review.user.toString() !== userId.toString()) {
      throw new AppError(
        this.getLangMessage(lang, 'You can only edit your own reviews', 'يمكنك تعديل مراجعاتك فقط'),
        403
      );
    }

    // تحديث الحقول
    if (body.rating) {
      if (body.rating < 1 || body.rating > 5) {
        throw new AppError(
          this.getLangMessage(lang, 'Rating must be between 1 and 5', 'التقييم يجب أن يكون بين 1 و 5'),
          400
        );
      }
      review.rating = Number(body.rating);
    }

    if (body.comment) {
      review.comment = body.comment.trim();
    }

    // إضافة صور جديدة
    if (files && files.length > 0) {
      const newImages = await this.uploadReviewImages(files);
      review.images = [...(review.images || []), ...newImages];
    }

    // حذف صور محددة
    if (body.deleteImages) {
      const imagesToDelete = typeof body.deleteImages === 'string' 
        ? JSON.parse(body.deleteImages) 
        : body.deleteImages;
      
      for (const imageUrl of imagesToDelete) {
        await this.deleteReviewImage(imageUrl);
        review.images = review.images.filter(img => img !== imageUrl);
      }
    }

    await review.save();
    await review.populate(this.populateOptions);

    return review;
  }

  // حذف مراجعة
  async deleteReview(reviewId, userId, isAdmin = false, lang = 'en') {
    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }

    // التحقق من الصلاحيات
    if (!isAdmin && review.user.toString() !== userId.toString()) {
      throw new AppError(
        this.getLangMessage(lang, 'You can only delete your own reviews', 'يمكنك حذف مراجعاتك فقط'),
        403
      );
    }

    const productId = review.product;

    // حذف الصور
    if (review.images && review.images.length > 0) {
      for (const imageUrl of review.images) {
        await this.deleteReviewImage(imageUrl);
      }
    }

    await ReviewModel.findByIdAndDelete(reviewId);

    // تحديث تقييم المنتج
    await ReviewModel.updateProductRating(productId);

    return {
      message: this.getLangMessage(lang, 'Review deleted successfully', 'تم حذف المراجعة بنجاح')
    };
  }

  // ==================== Image Operations ====================

  // رفع صورة للمراجعة
  async uploadImage(reviewId, userId, file, lang = 'en') {
    if (!file) {
      throw new AppError(
        this.getLangMessage(lang, 'No image provided', 'لم يتم توفير صورة'),
        400
      );
    }

    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }

    if (review.user.toString() !== userId.toString()) {
      throw new AppError(
        this.getLangMessage(lang, 'You can only edit your own reviews', 'يمكنك تعديل مراجعاتك فقط'),
        403
      );
    }

    // التحقق من عدد الصور (حد أقصى 5 صور)
    if (review.images && review.images.length >= 5) {
      throw new AppError(
        this.getLangMessage(lang, 'Maximum 5 images allowed per review', 'الحد الأقصى 5 صور لكل مراجعة'),
        400
      );
    }

    const result = await uploadToCloudinary(file.buffer || file.path, 'reviews');
    
    review.images = [...(review.images || []), result.url];
    await review.save();

    return {
      image: result.url,
      message: this.getLangMessage(lang, 'Image uploaded successfully', 'تم رفع الصورة بنجاح')
    };
  }

  // حذف صورة من المراجعة
  async deleteImage(reviewId, imageIndex, userId, lang = 'en') {
    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }

    if (review.user.toString() !== userId.toString()) {
      throw new AppError(
        this.getLangMessage(lang, 'You can only edit your own reviews', 'يمكنك تعديل مراجعاتك فقط'),
        403
      );
    }

    if (!review.images || !review.images[imageIndex]) {
      throw new AppError(
        this.getLangMessage(lang, 'Image not found', 'الصورة غير موجودة'),
        404
      );
    }

    const imageUrl = review.images[imageIndex];
    await this.deleteReviewImage(imageUrl);
    
    review.images.splice(imageIndex, 1);
    await review.save();

    return {
      message: this.getLangMessage(lang, 'Image deleted successfully', 'تم حذف الصورة بنجاح')
    };
  }

  // ==================== Statistics & Actions ====================

  // الإبلاغ عن مراجعة
  async reportReview(reviewId, userId, reason, lang = 'en') {
    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }

    review.reportCount += 1;
    
    // إخفاء المراجعة تلقائياً إذا تجاوزت 5 بلاغات
    if (review.reportCount >= 5) {
      review.status = false;
    }
    
    await review.save();

    return {
      message: this.getLangMessage(lang, 'Review reported successfully', 'تم الإبلاغ عن المراجعة بنجاح')
    };
  }

  // تمييز مراجعة كمفيدة
  async markHelpful(reviewId, userId, lang = 'en') {
    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }

    review.helpfulCount += 1;
    await review.save();

    return {
      helpfulCount: review.helpfulCount,
      message: this.getLangMessage(lang, 'Marked as helpful', 'تم التمييز كمفيد')
    };
  }

  // إحصائيات المراجعات (للإدارة)
  async getReviewStats() {
    const stats = await ReviewModel.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          activeReviews: { $sum: { $cond: ['$status', 1, 0] } },
          inactiveReviews: { $sum: { $cond: ['$status', 0, 1] } },
          verifiedPurchases: { $sum: { $cond: ['$isVerifiedPurchase', 1, 0] } }
        }
      }
    ]);

    const ratingDistribution = await ReviewModel.aggregate([
      { $match: { status: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    return {
      ...(stats[0] || { totalReviews: 0, averageRating: 0, activeReviews: 0, inactiveReviews: 0, verifiedPurchases: 0 }),
      ratingDistribution
    };
  }

  // تغيير حالة المراجعة (للإدارة)
  async toggleReviewStatus(reviewId, lang = 'en') {
    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      throw new AppError(
        this.getLangMessage(lang, 'Review not found', 'المراجعة غير موجودة'),
        404
      );
    }

    review.status = !review.status;
    await review.save();

    // تحديث تقييم المنتج
    await ReviewModel.updateProductRating(review.product);

    return review;
  }
}

module.exports = new ReviewService();