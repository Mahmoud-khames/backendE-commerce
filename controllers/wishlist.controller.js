// controllers/wishlistController.js
const WishlistService = require('../services/wishlist.service');
const AppError = require('../utils/AppError');
const StatusCodes = require('../utils/http-status-codes');

class WishlistController {
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

  // الحصول على wishlist المستخدم
  async getWishlist(req, res, next) {
    try {
      const lang = WishlistController.getLang(req);
      const userId = req.user._id;
      
      const wishlist = await WishlistService.getUserWishlist(userId, lang);
      
      return WishlistController.successResponse(res, {
        data: {
          wishlist: wishlist.products,
          count: wishlist.products.length
        }
      }, lang === 'ar' ? 'تم جلب قائمة الأمنيات بنجاح' : 'Wishlist fetched successfully');
    } catch (error) {
      console.error('Error getting wishlist:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get wishlist', 500));
    }
  }

  // إضافة منتج إلى الـ wishlist
  async addToWishlist(req, res, next) {
    try {
      const lang = WishlistController.getLang(req);
      const userId = req.user._id;
      const { productId } = req.body;

      if (!productId) {
        return next(new AppError(
          lang === 'ar' ? 'معرف المنتج مطلوب' : 'Product ID is required',
          400
        ));
      }

      const result = await WishlistService.addProductToWishlist(userId, productId, lang);

      return WishlistController.successResponse(res, {
        data: {
          wishlist: result.wishlist.products,
          count: result.wishlist.products.length,
          added: result.added
        }
      }, result.message);
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      next(error instanceof AppError ? error : new AppError('Failed to add to wishlist', 500));
    }
  }

  // إزالة منتج من الـ wishlist
  async removeFromWishlist(req, res, next) {
    try {
      const lang = WishlistController.getLang(req);
      const userId = req.user._id;
      const { productId } = req.params;

      if (!productId) {
        return next(new AppError(
          lang === 'ar' ? 'معرف المنتج مطلوب' : 'Product ID is required',
          400
        ));
      }

      const result = await WishlistService.removeProductFromWishlist(userId, productId, lang);

      return WishlistController.successResponse(res, {
        data: {
          wishlist: result.wishlist.products,
          count: result.wishlist.products.length
        }
      }, result.message);
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      next(error instanceof AppError ? error : new AppError('Failed to remove from wishlist', 500));
    }
  }

  // مسح الـ wishlist
  async clearWishlist(req, res, next) {
    try {
      const lang = WishlistController.getLang(req);
      const userId = req.user._id;

      const result = await WishlistService.clearWishlist(userId, lang);

      return WishlistController.successResponse(res, {
        data: {
          wishlist: [],
          count: 0
        }
      }, result.message);
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      next(error instanceof AppError ? error : new AppError('Failed to clear wishlist', 500));
    }
  }

  // التحقق من وجود منتج في الـ wishlist
  async checkProduct(req, res, next) {
    try {
      const lang = WishlistController.getLang(req);
      const userId = req.user._id;
      const { productId } = req.params;

      const isInWishlist = await WishlistService.isProductInWishlist(userId, productId, lang);

      return WishlistController.successResponse(res, {
        data: { isInWishlist }
      }, lang === 'ar' ? 'تم التحقق بنجاح' : 'Check completed successfully');
    } catch (error) {
      console.error('Error checking product:', error);
      next(error instanceof AppError ? error : new AppError('Failed to check product', 500));
    }
  }

  // الحصول على عدد المنتجات
  async getCount(req, res, next) {
    try {
      const userId = req.user._id;
      const count = await WishlistService.getWishlistCount(userId);

      return WishlistController.successResponse(res, {
        data: { count }
      });
    } catch (error) {
      console.error('Error getting count:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get count', 500));
    }
  }

  // Toggle منتج (إضافة أو إزالة)
  async toggleProduct(req, res, next) {
    try {
      const lang = WishlistController.getLang(req);
      const userId = req.user._id;
      const { productId } = req.body;

      if (!productId) {
        return next(new AppError(
          lang === 'ar' ? 'معرف المنتج مطلوب' : 'Product ID is required',
          400
        ));
      }

      const isInWishlist = await WishlistService.isProductInWishlist(userId, productId, lang);

      let result;
      if (isInWishlist) {
        result = await WishlistService.removeProductFromWishlist(userId, productId, lang);
        result.action = 'removed';
      } else {
        result = await WishlistService.addProductToWishlist(userId, productId, lang);
        result.action = 'added';
      }

      return WishlistController.successResponse(res, {
        data: {
          wishlist: result.wishlist.products,
          count: result.wishlist.products.length,
          action: result.action,
          isInWishlist: !isInWishlist
        }
      }, result.message);
    } catch (error) {
      console.error('Error toggling product:', error);
      next(error instanceof AppError ? error : new AppError('Failed to toggle product', 500));
    }
  }
}

module.exports = new WishlistController();