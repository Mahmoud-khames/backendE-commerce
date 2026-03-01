// controllers/cartController.js
const CartService = require('../services/cart.service');
const AppError = require('../utils/AppError');

class CartController {
  // Helper للحصول على اللغة
  static getLang(req) {
    return req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
           req.query.lang || 
           'en';
  }

  // Helper للاستجابة
  static successResponse(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      status: 'success',
      message,
      ...data
    });
  }

  // ==================== Query Methods ====================

  // الحصول على سلة المستخدم
  async getCart(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;
      
      const cart = await CartService.getUserCart(userId, lang);
      const summary = cart.getSummary(lang);
      
      return CartController.successResponse(res, {
        data: cart,
        summary
      }, lang === 'ar' ? 'تم جلب السلة بنجاح' : 'Cart fetched successfully');
    } catch (error) {
      console.error('Error fetching cart:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch cart', 500));
    }
  }

  // الحصول على ملخص السلة
  async getCartSummary(req, res, next) {
    try {
      const userId = req.user._id;
      const summary = await CartService.getCartStats(userId);
      
      return CartController.successResponse(res, {
        summary
      });
    } catch (error) {
      console.error('Error fetching cart summary:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch cart summary', 500));
    }
  }

  // ==================== CRUD Methods ====================

  // إضافة منتج إلى السلة
  async addToCart(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;
      const { productId, quantity = 1, size, color } = req.body;

      if (!productId) {
        return next(new AppError(
          lang === 'ar' ? 'معرف المنتج مطلوب' : 'Product ID is required',
          400
        ));
      }

      const result = await CartService.addToCart(
        userId, 
        { productId, quantity, size, color }, 
        lang
      );
      
      return CartController.successResponse(res, {
        data: result.cart,
        summary: result.cart.getSummary(lang)
      }, result.message);
    } catch (error) {
      console.error('Error adding to cart:', error);
      next(error instanceof AppError ? error : new AppError('Failed to add to cart', 500));
    }
  }

  // تحديث عنصر في السلة
  async updateCartItem(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;
      const productId = req.params.id;
      const { quantity, size, color } = req.body;

      const updates = {};
      if (quantity !== undefined) updates.quantity = parseInt(quantity);
      if (size !== undefined) updates.size = size;
      if (color !== undefined) updates.color = color;

      if (Object.keys(updates).length === 0) {
        return next(new AppError(
          lang === 'ar' ? 'لا توجد تحديثات' : 'No updates provided',
          400
        ));
      }

      const result = await CartService.updateCartItem(userId, productId, updates, lang);
      
      return CartController.successResponse(res, {
        data: result.cart,
        summary: result.cart.getSummary(lang)
      }, result.message);
    } catch (error) {
      console.error('Error updating cart item:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update cart item', 500));
    }
  }

  // إزالة منتج من السلة
  async removeFromCart(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;
      const productId = req.params.id;

      const result = await CartService.removeFromCart(userId, productId, lang);
      
      return CartController.successResponse(res, {
        data: result.cart,
        summary: result.cart.getSummary(lang)
      }, result.message);
    } catch (error) {
      console.error('Error removing from cart:', error);
      next(error instanceof AppError ? error : new AppError('Failed to remove from cart', 500));
    }
  }

  // مسح السلة
  async clearCart(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;

      const result = await CartService.clearCart(userId, lang);
      
      return CartController.successResponse(res, {
        data: result.cart,
        summary: result.cart?.getSummary ? result.cart.getSummary(lang) : { itemsCount: 0, total: 0 }
      }, result.message);
    } catch (error) {
      console.error('Error clearing cart:', error);
      next(error instanceof AppError ? error : new AppError('Failed to clear cart', 500));
    }
  }

  // ==================== Coupon Methods ====================

  // تطبيق كوبون
  async applyCoupon(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;
      const { code } = req.body;

      if (!code) {
        return next(new AppError(
          lang === 'ar' ? 'كود الكوبون مطلوب' : 'Coupon code is required',
          400
        ));
      }

      const result = await CartService.applyCoupon(userId, code, lang);
      
      return CartController.successResponse(res, {
        data: result.cart,
        summary: result.cart.getSummary(lang),
        discount: result.discount
      }, result.message);
    } catch (error) {
      console.error('Error applying coupon:', error);
      next(error instanceof AppError ? error : new AppError('Failed to apply coupon', 500));
    }
  }

  // إزالة الكوبون
  async removeCoupon(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;

      const result = await CartService.removeCoupon(userId, lang);
      
      return CartController.successResponse(res, {
        data: result.cart,
        summary: result.cart.getSummary(lang)
      }, result.message);
    } catch (error) {
      console.error('Error removing coupon:', error);
      next(error instanceof AppError ? error : new AppError('Failed to remove coupon', 500));
    }
  }

  // ==================== Validation ====================

  // التحقق من صحة السلة
  async validateCart(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;

      const validation = await CartService.validateCart(userId, lang);
      
      return CartController.successResponse(res, {
        valid: validation.valid,
        unavailable: validation.unavailable || [],
        cart: validation.cart
      }, validation.message);
    } catch (error) {
      console.error('Error validating cart:', error);
      next(error instanceof AppError ? error : new AppError('Failed to validate cart', 500));
    }
  }

  // ==================== Sync & Merge ====================

  // دمج سلة الضيف
  async mergeGuestCart(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const userId = req.user._id;
      const { guestCartItems } = req.body;

      if (!Array.isArray(guestCartItems) || guestCartItems.length === 0) {
        return next(new AppError(
          lang === 'ar' ? 'عناصر سلة الضيف مطلوبة' : 'Guest cart items are required',
          400
        ));
      }

      const result = await CartService.mergeGuestCart(userId, guestCartItems, lang);
      
      return CartController.successResponse(res, {
        data: result.cart,
        summary: result.cart.getSummary(lang)
      }, result.message);
    } catch (error) {
      console.error('Error merging guest cart:', error);
      next(error instanceof AppError ? error : new AppError('Failed to merge carts', 500));
    }
  }

  // ==================== Admin Methods ====================

  // الحصول على جميع السلات (للإدارة)
  async getAllCarts(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const { result } = await CartService.getAllCarts(req.query, lang);
      
      return CartController.successResponse(res, {
        data: result.data,
        pagination: result.pagination
      }, lang === 'ar' ? 'تم جلب السلات بنجاح' : 'Carts fetched successfully');
    } catch (error) {
      console.error('Error fetching carts:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch carts', 500));
    }
  }

  // إحصائيات السلات
  async getCartStats(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const stats = await CartService.getGlobalCartStats();
      
      return CartController.successResponse(res, {
        stats
      }, lang === 'ar' ? 'تم جلب الإحصائيات بنجاح' : 'Stats fetched successfully');
    } catch (error) {
      console.error('Error fetching cart stats:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch stats', 500));
    }
  }

  // الحصول على السلات المهجورة
  async getAbandonedCarts(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const hoursAgo = parseInt(req.query.hoursAgo) || 24;
      
      const carts = await CartService.getAbandonedCarts(hoursAgo, lang);
      
      return CartController.successResponse(res, {
        data: carts,
        count: carts.length
      }, lang === 'ar' ? 'تم جلب السلات المهجورة بنجاح' : 'Abandoned carts fetched successfully');
    } catch (error) {
      console.error('Error fetching abandoned carts:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch abandoned carts', 500));
    }
  }

  // تنظيف السلات القديمة
  async cleanupOldCarts(req, res, next) {
    try {
      const lang = CartController.getLang(req);
      const daysOld = parseInt(req.query.daysOld) || 30;
      
      const result = await CartService.cleanupOldCarts(daysOld);
      
      return CartController.successResponse(res, {
        deletedCount: result.deletedCount
      }, lang === 'ar' ? `تم حذف ${result.deletedCount} سلة` : `${result.deletedCount} carts deleted`);
    } catch (error) {
      console.error('Error cleaning up carts:', error);
      next(error instanceof AppError ? error : new AppError('Failed to cleanup carts', 500));
    }
  }
}

module.exports = new CartController();