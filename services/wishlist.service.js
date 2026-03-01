// services/wishlistService.js
const MongooseFeatures = require('./mongodb/features/index');
const WishlistModel = require('../models/wishlistModel');
const ProductModel = require('../models/productModel');
const { pick } = require('lodash');
const AppError = require('../utils/AppError');

class WishlistService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = ['user', 'products'];
    
    // الحقول المطلوبة للمنتجات
    this.productPopulateFields = `
      _id 
      productNameEn 
      productNameAr 
      productDescriptionEn
      productDescriptionAr
      productPrice 
      oldProductPrice
      productImage 
      productImages
      productCategory 
      productQuantity 
      productSizesEn
      productSizesAr
      productColorsEn
      productColorsAr
      productRating 
      productSlug
      productStatus
      hasActiveDiscount
      productDiscountPrice
      productDiscountPercentage
    `;
  }

  // ==================== Helper Methods ====================

  getLangMessage(lang, enMsg, arMsg) {
    return lang === 'ar' ? arMsg : enMsg;
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع الـ Wishlists (للإدارة)
  async getWishlists(query = {}, lang = 'en') {
    const { perPage = 15, page = 1, sorts = [], queries = [] } = pick(query, ['perPage', 'page', 'sorts', 'queries']);
    
    const result = await this.PaginateHandler(
      WishlistModel, 
      Number(perPage), 
      Number(page), 
      sorts, 
      queries
    );
    
    if (result.data && result.data.length > 0) {
      await WishlistModel.populate(result.data, [
        { path: 'products', select: this.productPopulateFields },
        { path: 'user', select: 'firstName lastName email' }
      ]);
    }
    
    return { result, keys: this.allowedKeys };
  }

  // الحصول على wishlist واحدة بالـ ID
  async getWishlistById(id, lang = 'en') {
    const wishlist = await WishlistModel.findById(id)
      .populate('products', this.productPopulateFields)
      .populate('user', 'firstName lastName email');
    
    if (!wishlist) {
      throw new AppError(
        this.getLangMessage(lang, 'Wishlist not found', 'قائمة الأمنيات غير موجودة'),
        404
      );
    }
    
    return wishlist;
  }

  // الحصول على wishlist المستخدم
  async getUserWishlist(userId, lang = 'en') {
    let wishlist = await WishlistModel.findOne({ user: userId });
    
    if (!wishlist) {
      wishlist = await WishlistModel.create({ user: userId, products: [] });
    }
    
    await wishlist.populate('products', this.productPopulateFields);
    
    return wishlist;
  }

  // إضافة منتج إلى الـ wishlist
  async addProductToWishlist(userId, productId, lang = 'en') {
    // التحقق من وجود المنتج
    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new AppError(
        this.getLangMessage(lang, 'Product not found', 'المنتج غير موجود'),
        404
      );
    }

    // الحصول على أو إنشاء wishlist
    let wishlist = await WishlistModel.findOne({ user: userId });
    
    if (!wishlist) {
      wishlist = await WishlistModel.create({ 
        user: userId, 
        products: [productId] 
      });
    } else {
      const added = wishlist.addProduct(productId);
      if (!added) {
        await wishlist.populate('products', this.productPopulateFields);
        return {
          wishlist,
          added: false,
          message: this.getLangMessage(lang, 'Product already in wishlist', 'المنتج موجود بالفعل في قائمة الأمنيات')
        };
      }
      await wishlist.save();
    }
    
    await wishlist.populate('products', this.productPopulateFields);
    
    return {
      wishlist,
      added: true,
      message: this.getLangMessage(lang, 'Product added to wishlist', 'تمت إضافة المنتج إلى قائمة الأمنيات')
    };
  }

  // إزالة منتج من الـ wishlist
  async removeProductFromWishlist(userId, productId, lang = 'en') {
    const wishlist = await WishlistModel.findOne({ user: userId });
    
    if (!wishlist) {
      throw new AppError(
        this.getLangMessage(lang, 'Wishlist not found', 'قائمة الأمنيات غير موجودة'),
        404
      );
    }
    
    const removed = wishlist.removeProduct(productId);
    
    if (!removed) {
      throw new AppError(
        this.getLangMessage(lang, 'Product not in wishlist', 'المنتج غير موجود في قائمة الأمنيات'),
        404
      );
    }
    
    await wishlist.save();
    await wishlist.populate('products', this.productPopulateFields);
    
    return {
      wishlist,
      message: this.getLangMessage(lang, 'Product removed from wishlist', 'تمت إزالة المنتج من قائمة الأمنيات')
    };
  }

  // مسح الـ wishlist
  async clearWishlist(userId, lang = 'en') {
    const wishlist = await WishlistModel.findOne({ user: userId });
    
    if (!wishlist) {
      return {
        wishlist: { products: [] },
        message: this.getLangMessage(lang, 'Wishlist is already empty', 'قائمة الأمنيات فارغة بالفعل')
      };
    }
    
    wishlist.clear();
    await wishlist.save();
    
    return {
      wishlist,
      message: this.getLangMessage(lang, 'Wishlist cleared', 'تم مسح قائمة الأمنيات')
    };
  }

  // التحقق من وجود منتج في الـ wishlist
  async isProductInWishlist(userId, productId, lang = 'en') {
    const wishlist = await WishlistModel.findOne({ user: userId });
    
    if (!wishlist) {
      return false;
    }
    
    return wishlist.hasProduct(productId);
  }

  // الحصول على عدد المنتجات في الـ wishlist
  async getWishlistCount(userId) {
    const wishlist = await WishlistModel.findOne({ user: userId });
    return wishlist ? wishlist.products.length : 0;
  }

  // نقل منتج من wishlist إلى السلة (إذا كان لديك نظام سلة)
  async moveToCart(userId, productId, cartService, lang = 'en') {
    // إزالة من wishlist
    await this.removeProductFromWishlist(userId, productId, lang);
    
    // إضافة إلى السلة (إذا كان CartService موجود)
    if (cartService && typeof cartService.addToCart === 'function') {
      await cartService.addToCart(userId, productId, 1);
    }
    
    return {
      message: this.getLangMessage(lang, 'Product moved to cart', 'تم نقل المنتج إلى السلة')
    };
  }

  // حذف wishlist (للإدارة)
  async deleteWishlist(id, lang = 'en') {
    const result = await WishlistModel.findByIdAndDelete(id);
    
    if (!result) {
      throw new AppError(
        this.getLangMessage(lang, 'Wishlist not found', 'قائمة الأمنيات غير موجودة'),
        404
      );
    }
    
    return {
      message: this.getLangMessage(lang, 'Wishlist deleted', 'تم حذف قائمة الأمنيات')
    };
  }
}

module.exports = new WishlistService();