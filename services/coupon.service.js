// services/couponService.js
const MongooseFeatures = require('./mongodb/features/index');
const CouponModel = require('../models/couponModel');
const { pick } = require('lodash');
const AppError = require('../utils/AppError');

class CouponService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = [
      'code',
      'nameEn',
      'nameAr',
      'descriptionEn',
      'descriptionAr',
      'discountType',
      'discountValue',
      'minPurchaseAmount',
      'maxDiscountAmount',
      'startDate',
      'endDate',
      'isActive',
      'usageLimit',
      'usageLimitPerUser',
      'allowedUsers',
      'allowedCategories',
      'allowedProducts',
      'excludedProducts',
      'allowedPaymentMethods',
      'type',
      'applyToShipping',
      'stackable'
    ];
  }

  // ==================== Helper Methods ====================

  getLangMessage(lang, enMsg, arMsg) {
    return lang === 'ar' ? arMsg : enMsg;
  }

  // تنسيق البيانات
  formatCouponData(body) {
    const data = {};
    
    if (body.code) data.code = body.code.toUpperCase().trim();
    if (body.nameEn) data.nameEn = body.nameEn.trim();
    if (body.nameAr) data.nameAr = body.nameAr.trim();
    if (body.descriptionEn !== undefined) data.descriptionEn = body.descriptionEn.trim();
    if (body.descriptionAr !== undefined) data.descriptionAr = body.descriptionAr.trim();
    
    if (body.discountType) data.discountType = body.discountType;
    if (body.discountValue !== undefined) data.discountValue = parseFloat(body.discountValue);
    if (body.minPurchaseAmount !== undefined) data.minPurchaseAmount = parseFloat(body.minPurchaseAmount) || 0;
    if (body.maxDiscountAmount !== undefined) data.maxDiscountAmount = body.maxDiscountAmount ? parseFloat(body.maxDiscountAmount) : null;
    
    if (body.startDate) data.startDate = new Date(body.startDate);
    if (body.endDate) data.endDate = new Date(body.endDate);
    
    if (body.isActive !== undefined) data.isActive = body.isActive === 'true' || body.isActive === true;
    
    if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit ? parseInt(body.usageLimit) : null;
    if (body.usageLimitPerUser !== undefined) data.usageLimitPerUser = parseInt(body.usageLimitPerUser) || 1;
    
    if (body.type) data.type = body.type;
    if (body.applyToShipping !== undefined) data.applyToShipping = body.applyToShipping === 'true' || body.applyToShipping === true;
    if (body.stackable !== undefined) data.stackable = body.stackable === 'true' || body.stackable === true;
    
    // المصفوفات
    if (body.allowedUsers) {
      data.allowedUsers = typeof body.allowedUsers === 'string' 
        ? JSON.parse(body.allowedUsers) 
        : body.allowedUsers;
    }
    if (body.allowedCategories) {
      data.allowedCategories = typeof body.allowedCategories === 'string' 
        ? JSON.parse(body.allowedCategories) 
        : body.allowedCategories;
    }
    if (body.allowedProducts) {
      data.allowedProducts = typeof body.allowedProducts === 'string' 
        ? JSON.parse(body.allowedProducts) 
        : body.allowedProducts;
    }
    if (body.excludedProducts) {
      data.excludedProducts = typeof body.excludedProducts === 'string' 
        ? JSON.parse(body.excludedProducts) 
        : body.excludedProducts;
    }
    if (body.allowedPaymentMethods) {
      data.allowedPaymentMethods = typeof body.allowedPaymentMethods === 'string' 
        ? JSON.parse(body.allowedPaymentMethods) 
        : body.allowedPaymentMethods;
    }
    
    return data;
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع الكوبونات
  async getAllCoupons(query = {}, lang = 'en') {
    const { 
      perPage = 15, 
      page = 1, 
      sorts = [], 
      queries = [],
      isActive,
      type,
      onlyValid = false
    } = pick(query, ['perPage', 'page', 'sorts', 'queries', 'isActive', 'type', 'onlyValid']);

    let filter = {};
    
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
    if (type) filter.type = type;
    
    if (onlyValid) {
      const now = new Date();
      filter.isActive = true;
      filter.startDate = { $lte: now };
      filter.endDate = { $gte: now };
    }

    const result = await this.PaginateHandler(
      CouponModel, 
      Number(perPage), 
      Number(page), 
      sorts.length ? sorts : [['createdAt', 'desc']], 
      queries
    );

    if (result.data && result.data.length > 0) {
      result.data = result.data.map(coupon => coupon.toLocalizedJSON(lang));
    }

    return { result, keys: this.allowedKeys };
  }

  // الحصول على الكوبونات النشطة
  async getActiveCoupons(lang = 'en') {
    return await CouponModel.getActiveCoupons(lang);
  }

  // الحصول على كوبون بالـ ID
  async getCouponById(id, lang = 'en') {
    const coupon = await CouponModel.findById(id)
      .populate('allowedUsers', 'firstName lastName email')
      .populate('allowedCategories', 'nameEn nameAr')
      .populate('allowedProducts', 'productNameEn productNameAr')
      .populate('excludedProducts', 'productNameEn productNameAr');
    
    if (!coupon) {
      throw new AppError(
        this.getLangMessage(lang, 'Coupon not found', 'الكوبون غير موجود'),
        404
      );
    }
    
    return coupon.toLocalizedJSON(lang);
  }

  // الحصول على كوبون بالكود
  async getCouponByCode(code, lang = 'en') {
    const coupon = await CouponModel.findOne({ code: code.toUpperCase() })
      .populate('allowedCategories', 'nameEn nameAr')
      .populate('allowedProducts', 'productNameEn productNameAr')
      .populate('excludedProducts', 'productNameEn productNameAr');
    
    if (!coupon) {
      throw new AppError(
        this.getLangMessage(lang, 'Coupon not found', 'الكوبون غير موجود'),
        404
      );
    }
    
    return coupon;
  }

  // إنشاء كوبون جديد
  async createCoupon(body, lang = 'en') {
    // التحقق من الحقول المطلوبة
    const requiredFields = {
      code: this.getLangMessage(lang, 'Coupon code is required', 'كود الكوبون مطلوب'),
      nameEn: this.getLangMessage(lang, 'Coupon name in English is required', 'اسم الكوبون بالإنجليزي مطلوب'),
      nameAr: this.getLangMessage(lang, 'Coupon name in Arabic is required', 'اسم الكوبون بالعربي مطلوب'),
      discountValue: this.getLangMessage(lang, 'Discount value is required', 'قيمة الخصم مطلوبة'),
      startDate: this.getLangMessage(lang, 'Start date is required', 'تاريخ البداية مطلوب'),
      endDate: this.getLangMessage(lang, 'End date is required', 'تاريخ النهاية مطلوب')
    };

    for (const [field, message] of Object.entries(requiredFields)) {
      if (!body[field]) {
        throw new AppError(message, 400);
      }
    }

    // التحقق من عدم وجود كوبون بنفس الكود
    const existingCoupon = await CouponModel.findOne({ code: body.code.toUpperCase() });
    if (existingCoupon) {
      throw new AppError(
        this.getLangMessage(lang, 'Coupon code already exists', 'كود الكوبون موجود بالفعل'),
        400
      );
    }

    // تنسيق البيانات
    const couponData = this.formatCouponData(body);

    // إنشاء الكوبون
    const coupon = await CouponModel.create(couponData);

    return coupon.toLocalizedJSON(lang);
  }

  // تحديث كوبون
  async updateCoupon(id, body, lang = 'en') {
    const coupon = await CouponModel.findById(id);
    
    if (!coupon) {
      throw new AppError(
        this.getLangMessage(lang, 'Coupon not found', 'الكوبون غير موجود'),
        404
      );
    }

    // التحقق من عدم تكرار الكود
    if (body.code && body.code.toUpperCase() !== coupon.code) {
      const existingCoupon = await CouponModel.findOne({ 
        code: body.code.toUpperCase(),
        _id: { $ne: id }
      });
      
      if (existingCoupon) {
        throw new AppError(
          this.getLangMessage(lang, 'Coupon code already exists', 'كود الكوبون موجود بالفعل'),
          400
        );
      }
    }

    // تنسيق البيانات
    const updateData = this.formatCouponData(body);

    // تحديث الكوبون
    Object.assign(coupon, updateData);
    await coupon.save();

    return coupon.toLocalizedJSON(lang);
  }

  // حذف كوبون
  async deleteCoupon(id, lang = 'en') {
    const coupon = await CouponModel.findByIdAndDelete(id);
    
    if (!coupon) {
      throw new AppError(
        this.getLangMessage(lang, 'Coupon not found', 'الكوبون غير موجود'),
        404
      );
    }
    
    return {
      message: this.getLangMessage(lang, 'Coupon deleted successfully', 'تم حذف الكوبون بنجاح')
    };
  }

  // ==================== Validation & Usage ====================

  // التحقق من صحة الكوبون
  async validateCoupon(code, userId, cartData, lang = 'en') {
    const coupon = await this.getCouponByCode(code, lang);
    
    const validation = {
      valid: false,
      message: '',
      coupon: null,
      discount: 0
    };

    // التحقق من الصلاحية العامة
    if (!coupon.isValid) {
      validation.message = this.getLangMessage(lang, 'Coupon is not valid', 'الكوبون غير صالح');
      return validation;
    }

    // التحقق من إمكانية الاستخدام للمستخدم
    if (!coupon.canBeUsedBy(userId)) {
      validation.message = this.getLangMessage(lang, 'You cannot use this coupon', 'لا يمكنك استخدام هذا الكوبون');
      return validation;
    }

    // التحقق من الحد الأدنى للشراء
    if (cartData.subtotal < coupon.minPurchaseAmount) {
      validation.message = this.getLangMessage(
        lang,
        `Minimum purchase amount is ${coupon.minPurchaseAmount}`,
        `الحد الأدنى للشراء هو ${coupon.minPurchaseAmount}`
      );
      return validation;
    }

    // التحقق من الفئات المسموح بها
    if (coupon.allowedCategories && coupon.allowedCategories.length > 0) {
      const hasAllowedCategory = cartData.items.some(item => 
        coupon.allowedCategories.some(cat => cat._id.toString() === item.product.productCategory?.toString())
      );
      
      if (!hasAllowedCategory) {
        validation.message = this.getLangMessage(lang, 'Coupon not applicable to cart items', 'الكوبون غير قابل للتطبيق على عناصر السلة');
        return validation;
      }
    }

    // التحقق من المنتجات المستثناة
    if (coupon.excludedProducts && coupon.excludedProducts.length > 0) {
      const hasExcludedProduct = cartData.items.some(item => 
        coupon.excludedProducts.some(prod => prod._id.toString() === item.product._id.toString())
      );
      
      if (hasExcludedProduct) {
        validation.message = this.getLangMessage(lang, 'Some items in cart are excluded', 'بعض العناصر في السلة مستثناة');
        return validation;
      }
    }

    // التحقق من طريقة الدفع
    if (coupon.allowedPaymentMethods && coupon.allowedPaymentMethods.length > 0) {
      if (!coupon.allowedPaymentMethods.includes(cartData.paymentMethod)) {
        validation.message = this.getLangMessage(lang, 'Coupon not valid for selected payment method', 'الكوبون غير صالح لطريقة الدفع المختارة');
        return validation;
      }
    }

    // حساب الخصم
    const discount = coupon.calculateDiscount(cartData.subtotal);

    validation.valid = true;
    validation.message = this.getLangMessage(lang, 'Coupon is valid', 'الكوبون صالح');
    validation.coupon = coupon.toLocalizedJSON(lang);
    validation.discount = discount;

    return validation;
  }

  // تطبيق الكوبون على السلة
  async applyCoupon(code, userId, cartData, lang = 'en') {
    const validation = await this.validateCoupon(code, userId, cartData, lang);
    
    if (!validation.valid) {
      throw new AppError(validation.message, 400);
    }
    
    return {
      coupon: validation.coupon,
      discount: validation.discount,
      discountedTotal: Math.max(0, cartData.subtotal - validation.discount),
      message: this.getLangMessage(lang, 'Coupon applied successfully', 'تم تطبيق الكوبون بنجاح')
    };
  }

  // تسجيل استخدام الكوبون
  async recordCouponUsage(couponId, userId, lang = 'en') {
    const coupon = await CouponModel.findById(couponId);
    
    if (!coupon) {
      throw new AppError(
        this.getLangMessage(lang, 'Coupon not found', 'الكوبون غير موجود'),
        404
      );
    }

    coupon.recordUsage(userId);
    await coupon.save();

    return {
      message: this.getLangMessage(lang, 'Coupon usage recorded', 'تم تسجيل استخدام الكوبون')
    };
  }

  // ==================== Statistics ====================

  // إحصائيات الكوبونات
  async getCouponStats() {
    const [total, active, expired, used] = await Promise.all([
      CouponModel.countDocuments(),
      CouponModel.countDocuments({ 
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      }),
      CouponModel.countDocuments({ 
        endDate: { $lt: new Date() }
      }),
      CouponModel.countDocuments({ 
        usageCount: { $gt: 0 }
      })
    ]);

    const topCoupons = await CouponModel.find()
      .sort({ usageCount: -1 })
      .limit(5)
      .select('code nameEn nameAr usageCount discountValue discountType');

    return {
      total,
      active,
      expired,
      used,
      topCoupons
    };
  }

  // تبديل حالة التفعيل
  async toggleActiveStatus(id, lang = 'en') {
    const coupon = await CouponModel.findById(id);
    
    if (!coupon) {
      throw new AppError(
        this.getLangMessage(lang, 'Coupon not found', 'الكوبون غير موجود'),
        404
      );
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return coupon.toLocalizedJSON(lang);
  }
}

module.exports = new CouponService();