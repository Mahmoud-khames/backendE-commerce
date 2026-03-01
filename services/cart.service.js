// services/cartService.js
const MongooseFeatures = require('./mongodb/features/index');
const CartModel = require('../models/cartModel');
const ProductModel = require('../models/productModel');
const CouponService = require('./coupon.service');
const { pick } = require('lodash');
const AppError = require('../utils/AppError');

class CartService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = [
      'user',
      'items',
      'subtotal',
      'totalDiscount',
      'totalPrice',
      'appliedCoupon',
      'status',
      'notes'
    ];
    
    this.populateOptions = [
      { 
        path: 'items.product', 
        select: 'productNameEn productNameAr productPrice productDiscountPrice hasActiveDiscount productImage productQuantity productStatus productSizesEn productSizesAr productColorsEn productColorsAr' 
      },
      {
        path: 'user',
        select: 'firstName lastName email'
      }
    ];
  }

  // ==================== Helper Methods ====================

  getLangMessage(lang, enMsg, arMsg) {
    return lang === 'ar' ? arMsg : enMsg;
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع السلات (للإدارة)
  async getAllCarts(query = {}, lang = 'en') {
    const { 
      perPage = 15, 
      page = 1, 
      sorts = [], 
      queries = [],
      status
    } = pick(query, ['perPage', 'page', 'sorts', 'queries', 'status']);

    let filter = {};
    if (status) filter.status = status;

    const result = await this.PaginateHandler(
      CartModel, 
      Number(perPage), 
      Number(page), 
      sorts.length ? sorts : [['lastActivityAt', 'desc']], 
      queries
    );

    if (result.data && result.data.length > 0) {
      await CartModel.populate(result.data, this.populateOptions);
    }

    return { result, keys: this.allowedKeys };
  }

  // الحصول على سلة المستخدم
  async getUserCart(userId, lang = 'en') {
    let cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      cart = await CartModel.create({
        user: userId,
        items: [],
        status: 'active'
      });
    }
    
    await cart.populate(this.populateOptions);
    
    // تحديث الأسعار من المنتجات
    await cart.updatePrices();
    
    // التحقق من التوفر
    await cart.checkAvailability();
    
    return cart;
  }

  // الحصول على سلة بالـ ID
  async getCartById(id, lang = 'en') {
    const cart = await CartModel.findById(id).populate(this.populateOptions);
    
    if (!cart) {
      throw new AppError(
        this.getLangMessage(lang, 'Cart not found', 'السلة غير موجودة'),
        404
      );
    }
    
    return cart;
  }

  // إضافة منتج إلى السلة
  async addToCart(userId, itemData, lang = 'en') {
    const { productId, quantity = 1, size, color } = itemData;

    // التحقق من المنتج
    const product = await ProductModel.findById(productId);
    
    if (!product) {
      throw new AppError(
        this.getLangMessage(lang, 'Product not found', 'المنتج غير موجود'),
        404
      );
    }

    if (!product.productStatus) {
      throw new AppError(
        this.getLangMessage(lang, 'Product is not available', 'المنتج غير متاح'),
        400
      );
    }

    if (product.productQuantity < quantity) {
      throw new AppError(
        this.getLangMessage(
          lang,
          `Only ${product.productQuantity} items available`,
          `يتوفر ${product.productQuantity} قطعة فقط`
        ),
        400
      );
    }

    // الحصول على السلة أو إنشاؤها
    let cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      cart = await CartModel.create({
        user: userId,
        items: [],
        status: 'active'
      });
    }

    // إضافة العنصر
    const item = {
      product: productId,
      quantity,
      size: size || null,
      color: color || null,
      price: product.productPrice,
      discountedPrice: product.hasActiveDiscount ? product.productDiscountPrice : 0,
      productNameEn: product.productNameEn,
      productNameAr: product.productNameAr,
      productImage: product.productImage,
      isAvailable: true,
      stockQuantity: product.productQuantity
    };

    cart.addItem(item);
    await cart.save();
    await cart.populate(this.populateOptions);

    return {
      cart,
      message: this.getLangMessage(lang, 'Product added to cart', 'تمت إضافة المنتج إلى السلة')
    };
  }

  // تحديث عنصر في السلة
  async updateCartItem(userId, productId, updates, lang = 'en') {
    const cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      throw new AppError(
        this.getLangMessage(lang, 'Cart not found', 'السلة غير موجودة'),
        404
      );
    }

    // التحقق من الكمية الجديدة
    if (updates.quantity) {
      const product = await ProductModel.findById(productId);
      
      if (!product) {
        throw new AppError(
          this.getLangMessage(lang, 'Product not found', 'المنتج غير موجود'),
          404
        );
      }

      if (product.productQuantity < updates.quantity) {
        throw new AppError(
          this.getLangMessage(
            lang,
            `Only ${product.productQuantity} items available`,
            `يتوفر ${product.productQuantity} قطعة فقط`
          ),
          400
        );
      }
    }

    const updated = cart.updateItem(productId, updates);
    
    if (!updated) {
      throw new AppError(
        this.getLangMessage(lang, 'Product not found in cart', 'المنتج غير موجود في السلة'),
        404
      );
    }

    await cart.save();
    await cart.populate(this.populateOptions);

    return {
      cart,
      message: this.getLangMessage(lang, 'Cart item updated', 'تم تحديث المنتج في السلة')
    };
  }

  // إزالة منتج من السلة
  async removeFromCart(userId, productId, lang = 'en') {
    const cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      throw new AppError(
        this.getLangMessage(lang, 'Cart not found', 'السلة غير موجودة'),
        404
      );
    }

    const removed = cart.removeItem(productId);
    
    if (!removed) {
      throw new AppError(
        this.getLangMessage(lang, 'Product not found in cart', 'المنتج غير موجود في السلة'),
        404
      );
    }

    await cart.save();
    await cart.populate(this.populateOptions);

    return {
      cart,
      message: this.getLangMessage(lang, 'Product removed from cart', 'تمت إزالة المنتج من السلة')
    };
  }

  // مسح السلة
  async clearCart(userId, lang = 'en') {
    const cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      return {
        cart: { items: [], subtotal: 0, totalDiscount: 0, totalPrice: 0 },
        message: this.getLangMessage(lang, 'Cart is already empty', 'السلة فارغة بالفعل')
      };
    }

    cart.clear();
    await cart.save();

    return {
      cart,
      message: this.getLangMessage(lang, 'Cart cleared', 'تم مسح السلة')
    };
  }

  // ==================== Coupon Operations ====================

  // تطبيق كوبون
  async applyCoupon(userId, couponCode, lang = 'en') {
    const cart = await CartModel.findOne({ user: userId }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      throw new AppError(
        this.getLangMessage(lang, 'Cart is empty', 'السلة فارغة'),
        400
      );
    }

    // التحقق من الكوبون
    const cartData = {
      subtotal: cart.subtotal,
      items: cart.items,
      paymentMethod: 'cod'
    };

    const validation = await CouponService.validateCoupon(couponCode, userId, cartData, lang);
    
    if (!validation.valid) {
      throw new AppError(validation.message, 400);
    }

    // تطبيق الكوبون
    cart.applyCoupon({
      code: couponCode,
      discountType: validation.coupon.discountType,
      discountValue: validation.coupon.discountValue,
      discountAmount: validation.discount
    });

    await cart.save();
    await cart.populate(this.populateOptions);

    return {
      cart,
      discount: validation.discount,
      message: this.getLangMessage(lang, 'Coupon applied successfully', 'تم تطبيق الكوبون بنجاح')
    };
  }

  // إزالة الكوبون
  async removeCoupon(userId, lang = 'en') {
    const cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      throw new AppError(
        this.getLangMessage(lang, 'Cart not found', 'السلة غير موجودة'),
        404
      );
    }

    cart.removeCoupon();
    await cart.save();
    await cart.populate(this.populateOptions);

    return {
      cart,
      message: this.getLangMessage(lang, 'Coupon removed', 'تم إزالة الكوبون')
    };
  }

  // ==================== Validation ====================

  // التحقق من صحة السلة
  async validateCart(userId, lang = 'en') {
    const cart = await CartModel.findOne({ user: userId }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      throw new AppError(
        this.getLangMessage(lang, 'Cart is empty', 'السلة فارغة'),
        400
      );
    }

    const unavailable = await cart.checkAvailability();
    
    if (unavailable.length > 0) {
      return {
        valid: false,
        unavailable,
        message: this.getLangMessage(
          lang,
          'Some items are not available',
          'بعض المنتجات غير متاحة'
        )
      };
    }

    return {
      valid: true,
      cart,
      message: this.getLangMessage(lang, 'Cart is valid', 'السلة صالحة')
    };
  }

  // ==================== Sync & Merge ====================

  // مزامنة السلة مع سلة الضيف
  async mergeGuestCart(userId, guestCartItems, lang = 'en') {
    let cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      cart = await CartModel.create({
        user: userId,
        items: [],
        status: 'active'
      });
    }

    // إضافة عناصر سلة الضيف
    for (const guestItem of guestCartItems) {
      const product = await ProductModel.findById(guestItem.productId);
      
      if (!product || !product.productStatus) continue;
      
      const item = {
        product: guestItem.productId,
        quantity: guestItem.quantity,
        size: guestItem.size || null,
        color: guestItem.color || null,
        price: product.productPrice,
        discountedPrice: product.hasActiveDiscount ? product.productDiscountPrice : 0,
        productNameEn: product.productNameEn,
        productNameAr: product.productNameAr,
        productImage: product.productImage,
        isAvailable: true,
        stockQuantity: product.productQuantity
      };
      
      cart.addItem(item);
    }

    await cart.save();
    await cart.populate(this.populateOptions);

    return {
      cart,
      message: this.getLangMessage(lang, 'Carts merged successfully', 'تم دمج السلات بنجاح')
    };
  }

  // ==================== Statistics ====================

  // إحصائيات السلة
  async getCartStats(userId) {
    const cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      return {
        itemsCount: 0,
        uniqueItemsCount: 0,
        subtotal: 0,
        totalDiscount: 0,
        total: 0
      };
    }

    return cart.getSummary();
  }

  // إحصائيات عامة (للإدارة)
  async getGlobalCartStats() {
    const [
      totalCarts,
      activeCarts,
      abandonedCarts,
      totalItems,
      totalValue
    ] = await Promise.all([
      CartModel.countDocuments(),
      CartModel.countDocuments({ status: 'active', 'items.0': { $exists: true } }),
      CartModel.countDocuments({ status: 'abandoned' }),
      CartModel.aggregate([
        { $match: { status: 'active' } },
        { $unwind: '$items' },
        { $group: { _id: null, total: { $sum: '$items.quantity' } } }
      ]),
      CartModel.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ])
    ]);

    return {
      totalCarts,
      activeCarts,
      abandonedCarts,
      totalItems: totalItems[0]?.total || 0,
      totalValue: totalValue[0]?.total || 0
    };
  }

  // الحصول على السلات المهجورة
  async getAbandonedCarts(hoursAgo = 24, lang = 'en') {
    return await CartModel.getAbandonedCarts(hoursAgo);
  }

  // تنظيف السلات القديمة
  async cleanupOldCarts(daysOld = 30) {
    return await CartModel.cleanupExpiredCarts(daysOld);
  }

  // تحديث حالة السلة
  async updateCartStatus(userId, status, lang = 'en') {
    const cart = await CartModel.findOne({ user: userId });
    
    if (!cart) {
      throw new AppError(
        this.getLangMessage(lang, 'Cart not found', 'السلة غير موجودة'),
        404
      );
    }

    cart.status = status;
    await cart.save();

    return {
      cart,
      message: this.getLangMessage(lang, 'Cart status updated', 'تم تحديث حالة السلة')
    };
  }
}

module.exports = new CartService();