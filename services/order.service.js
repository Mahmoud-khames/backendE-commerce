// services/orderService.js
const MongooseFeatures = require('./mongodb/features/index');
const OrderModel = require('../models/orderModel');
const CartModel = require('../models/cartModel');
const ProductModel = require('../models/productModel');
const { pick } = require('lodash');
const AppError = require('../utils/AppError');

class OrderService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = [
      'items',
      'user',
      'subtotal',
      'shippingCost',
      'taxAmount',
      'discountAmount',
      'totalAmount',
      'shippingAddress',
      'coupon',
      'paymentMethod',
      'paymentDetails',
      'paymentStatus',
      'status',
      'shippingMethod',
      'trackingNumber',
      'customerNote',
      'adminNote'
    ];
    
    this.populateOptions = [
      { 
        path: 'user', 
        select: 'firstName lastName email phone' 
      },
      { 
        path: 'items.product', 
        select: 'productNameEn productNameAr productImage productPrice productSlug productQuantity' 
      },
      {
        path: 'statusHistory.changedBy',
        select: 'firstName lastName'
      }
    ];

    // ترجمة الحالات
    this.statusTranslations = {
      'pending': { en: 'Pending', ar: 'قيد الانتظار' },
      'confirmed': { en: 'Confirmed', ar: 'مؤكد' },
      'processing': { en: 'Processing', ar: 'قيد المعالجة' },
      'shipped': { en: 'Shipped', ar: 'تم الشحن' },
      'out_for_delivery': { en: 'Out for Delivery', ar: 'في الطريق للتوصيل' },
      'delivered': { en: 'Delivered', ar: 'تم التوصيل' },
      'cancelled': { en: 'Cancelled', ar: 'ملغي' },
      'returned': { en: 'Returned', ar: 'مرتجع' },
      'refunded': { en: 'Refunded', ar: 'مسترد' }
    };

    this.paymentStatusTranslations = {
      'pending': { en: 'Pending', ar: 'قيد الانتظار' },
      'paid': { en: 'Paid', ar: 'مدفوع' },
      'failed': { en: 'Failed', ar: 'فشل' },
      'refunded': { en: 'Refunded', ar: 'مسترد' },
      'partially_refunded': { en: 'Partially Refunded', ar: 'مسترد جزئياً' }
    };

    this.paymentMethodTranslations = {
      'cod': { en: 'Cash on Delivery', ar: 'الدفع عند الاستلام' },
      'paypal': { en: 'PayPal', ar: 'باي بال' },
      'stripe': { en: 'Credit Card', ar: 'بطاقة ائتمان' },
      'bank_transfer': { en: 'Bank Transfer', ar: 'تحويل بنكي' }
    };
  }

  // ==================== Helper Methods ====================

  getLangMessage(lang, enMsg, arMsg) {
    return lang === 'ar' ? arMsg : enMsg;
  }

  getStatusTranslation(status, lang) {
    return this.statusTranslations[status]?.[lang] || status;
  }

  getPaymentStatusTranslation(status, lang) {
    return this.paymentStatusTranslations[status]?.[lang] || status;
  }

  getPaymentMethodTranslation(method, lang) {
    return this.paymentMethodTranslations[method]?.[lang] || method;
  }

  // تنسيق الطلب للاستجابة
  formatOrderResponse(order, lang = 'en') {
    const obj = order.toObject ? order.toObject() : order;
    
    return {
      ...obj,
      statusText: this.getStatusTranslation(obj.status, lang),
      paymentStatusText: this.getPaymentStatusTranslation(obj.paymentStatus, lang),
      paymentMethodText: this.getPaymentMethodTranslation(obj.paymentMethod, lang),
      items: obj.items?.map(item => ({
        ...item,
        productName: lang === 'ar' 
          ? (item.productNameAr || item.product?.productNameAr) 
          : (item.productNameEn || item.product?.productNameEn)
      }))
    };
  }

  // حساب المجموع
  calculateTotals(items, shippingCost = 0, discountAmount = 0, taxRate = 0.15) {
    const subtotal = items.reduce((sum, item) => {
      const price = item.discountedPrice || item.price;
      return sum + (price * item.quantity);
    }, 0);
    
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + shippingCost + taxAmount - discountAmount;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      shippingCost: Math.round(shippingCost * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100
    };
  }

  // التحقق من توفر المخزون
  async checkProductsAvailability(items, lang = 'en') {
    const unavailableProducts = [];
    
    for (const item of items) {
      const product = await ProductModel.findById(item.product || item.productId);
      
      if (!product) {
        unavailableProducts.push({
          productId: item.product || item.productId,
          reason: this.getLangMessage(lang, 'Product not found', 'المنتج غير موجود')
        });
        continue;
      }
      
      if (!product.productStatus) {
        unavailableProducts.push({
          productId: product._id,
          productName: lang === 'ar' ? product.productNameAr : product.productNameEn,
          reason: this.getLangMessage(lang, 'Product is not available', 'المنتج غير متاح')
        });
        continue;
      }
      
      if (product.productQuantity < item.quantity) {
        unavailableProducts.push({
          productId: product._id,
          productName: lang === 'ar' ? product.productNameAr : product.productNameEn,
          requested: item.quantity,
          available: product.productQuantity,
          reason: this.getLangMessage(lang, 'Insufficient stock', 'الكمية غير متوفرة')
        });
      }
    }
    
    return unavailableProducts;
  }

  // تحديث المخزون
  async updateProductStock(items, operation = 'decrease') {
    for (const item of items) {
      const update = operation === 'decrease' 
        ? { $inc: { productQuantity: -item.quantity } }
        : { $inc: { productQuantity: item.quantity } };
      
      await ProductModel.findByIdAndUpdate(item.product, update);
    }
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع الطلبات
  async getOrders(query = {}, lang = 'en') {
    const { 
      perPage = 15, 
      page = 1, 
      sorts = [], 
      queries = [],
      status,
      paymentStatus,
      paymentMethod,
      startDate,
      endDate,
      search
    } = pick(query, [
      'perPage', 'page', 'sorts', 'queries',
      'status', 'paymentStatus', 'paymentMethod',
      'startDate', 'endDate', 'search'
    ]);

    // بناء الفلتر
    let filter = { isDeleted: false };
    
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phoneNumber': { $regex: search, $options: 'i' } }
      ];
    }

    const result = await this.PaginateHandler(
      OrderModel, 
      Number(perPage), 
      Number(page), 
      sorts.length ? sorts : [['createdAt', 'desc']], 
      queries
    );

    if (result.data && result.data.length > 0) {
      await OrderModel.populate(result.data, this.populateOptions);
      
      // تنسيق الطلبات
      result.data = result.data.map(order => this.formatOrderResponse(order, lang));
    }

    return { result, keys: this.allowedKeys };
  }

  // الحصول على طلبات المستخدم
  async getUserOrders(userId, query = {}, lang = 'en') {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    let filter = { user: userId, isDeleted: false };
    if (status) filter.status = status;

    const total = await OrderModel.countDocuments(filter);
    
    const orders = await OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('items.product', 'productNameEn productNameAr productImage productSlug');

    return {
      orders: orders.map(order => this.formatOrderResponse(order, lang)),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // الحصول على طلب واحد بالـ ID
  async getOrderById(id, lang = 'en') {
    const order = await OrderModel.findById(id).populate(this.populateOptions);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }
    
    return this.formatOrderResponse(order, lang);
  }

  // الحصول على طلب برقم الطلب
  async getOrderByNumber(orderNumber, lang = 'en') {
    const order = await OrderModel.findOne({ orderNumber }).populate(this.populateOptions);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }
    
    return this.formatOrderResponse(order, lang);
  }

  // إنشاء طلب جديد
  async createOrder(userId, body, lang = 'en') {
    const {
      shippingAddress,
      paymentMethod = 'cod',
      shippingMethod = 'standard',
      customerNote,
      coupon,
      useCart = true,
      items: directItems
    } = body;

    // التحقق من عنوان الشحن
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.addressLine1 || 
        !shippingAddress.city || !shippingAddress.phoneNumber) {
      throw new AppError(
        this.getLangMessage(lang, 'Complete shipping address is required', 'عنوان الشحن الكامل مطلوب'),
        400
      );
    }

    let orderItems = [];
    
    if (useCart) {
      // الحصول على سلة المستخدم
      const cart = await CartModel.findOne({ user: userId }).populate('items.product');
      
      if (!cart || cart.items.length === 0) {
        throw new AppError(
          this.getLangMessage(lang, 'Cart is empty', 'السلة فارغة'),
          400
        );
      }
      
      // التحقق من توفر المنتجات
      const unavailable = await this.checkProductsAvailability(cart.items, lang);
      if (unavailable.length > 0) {
        throw new AppError(
          this.getLangMessage(lang, 'Some products are not available', 'بعض المنتجات غير متاحة'),
          400,
          { unavailableProducts: unavailable }
        );
      }
      
      // تحويل عناصر السلة إلى عناصر الطلب
      orderItems = cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.productPrice,
        discountedPrice: item.product.hasActiveDiscount ? item.product.productDiscountPrice : 0,
        size: item.size || null,
        color: item.color || null,
        productNameEn: item.product.productNameEn,
        productNameAr: item.product.productNameAr,
        productImage: item.product.productImage
      }));
    } else if (directItems && directItems.length > 0) {
      // التحقق من توفر المنتجات
      const unavailable = await this.checkProductsAvailability(directItems, lang);
      if (unavailable.length > 0) {
        throw new AppError(
          this.getLangMessage(lang, 'Some products are not available', 'بعض المنتجات غير متاحة'),
          400,
          { unavailableProducts: unavailable }
        );
      }
      
      // الحصول على بيانات المنتجات
      for (const item of directItems) {
        const product = await ProductModel.findById(item.productId);
        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          price: product.productPrice,
          discountedPrice: product.hasActiveDiscount ? product.productDiscountPrice : 0,
          size: item.size || null,
          color: item.color || null,
          productNameEn: product.productNameEn,
          productNameAr: product.productNameAr,
          productImage: product.productImage
        });
      }
    } else {
      throw new AppError(
        this.getLangMessage(lang, 'No items to order', 'لا توجد منتجات للطلب'),
        400
      );
    }

    // حساب تكلفة الشحن
    let shippingCost = 0;
    switch (shippingMethod) {
      case 'express': shippingCost = 50; break;
      case 'same_day': shippingCost = 100; break;
      default: shippingCost = 25; break;
    }

    // حساب الخصم من الكوبون
    let discountAmount = 0;
    let couponData = null;
    if (coupon) {
      // يمكنك إضافة منطق التحقق من الكوبون هنا
      // couponData = await CouponService.validateCoupon(coupon, subtotal);
      // discountAmount = couponData.discountAmount;
    }

    // حساب المجاميع
    const totals = this.calculateTotals(orderItems, shippingCost, discountAmount);

    // إنشاء الطلب
    const order = await OrderModel.create({
      items: orderItems,
      user: userId,
      ...totals,
      shippingAddress,
      coupon: couponData,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      status: 'pending',
      shippingMethod,
      customerNote,
      estimatedDeliveryDate: this.calculateEstimatedDelivery(shippingMethod)
    });

    // تحديث المخزون
    await this.updateProductStock(orderItems, 'decrease');

    // مسح السلة إذا تم استخدامها
    if (useCart) {
      await CartModel.findOneAndUpdate(
        { user: userId },
        { $set: { items: [], totalPrice: 0, totalDiscount: 0 } }
      );
    }

    await order.populate(this.populateOptions);

    return this.formatOrderResponse(order, lang);
  }

  // حساب تاريخ التوصيل المتوقع
  calculateEstimatedDelivery(shippingMethod) {
    const now = new Date();
    let days = 5; // الافتراضي للشحن العادي
    
    switch (shippingMethod) {
      case 'express': days = 2; break;
      case 'same_day': days = 0; break;
      default: days = 5;
    }
    
    now.setDate(now.getDate() + days);
    return now;
  }

  // تحديث حالة الطلب
  async updateOrderStatus(orderId, status, note = null, changedBy = null, lang = 'en') {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }

    // التحقق من صحة التحويل
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['out_for_delivery', 'delivered'],
      'out_for_delivery': ['delivered'],
      'delivered': ['returned'],
      'returned': ['refunded'],
      'cancelled': [],
      'refunded': []
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new AppError(
        this.getLangMessage(
          lang, 
          `Cannot change status from ${order.status} to ${status}`, 
          `لا يمكن تغيير الحالة من ${this.getStatusTranslation(order.status, 'ar')} إلى ${this.getStatusTranslation(status, 'ar')}`
        ),
        400
      );
    }

    // تحديث الحالة
    order.addStatusHistory(status, note, changedBy);
    
    // تحديثات إضافية حسب الحالة
    if (status === 'delivered') {
      order.actualDeliveryDate = new Date();
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'paid';
        order.paymentDetails = {
          ...order.paymentDetails,
          paidAt: new Date()
        };
      }
    }
    
    if (status === 'cancelled') {
      // إرجاع المخزون
      await this.updateProductStock(order.items, 'increase');
    }
    
    if (status === 'refunded') {
      order.paymentStatus = 'refunded';
    }

    await order.save();
    await order.populate(this.populateOptions);

    return this.formatOrderResponse(order, lang);
  }

  // تحديث معلومات الشحن
  async updateShippingInfo(orderId, shippingInfo, lang = 'en') {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }

    const { trackingNumber, trackingUrl, estimatedDeliveryDate } = shippingInfo;
    
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (trackingUrl) order.trackingUrl = trackingUrl;
    if (estimatedDeliveryDate) order.estimatedDeliveryDate = new Date(estimatedDeliveryDate);

    await order.save();
    await order.populate(this.populateOptions);

    return this.formatOrderResponse(order, lang);
  }

  // تحديث حالة الدفع
  async updatePaymentStatus(orderId, paymentStatus, paymentDetails = {}, lang = 'en') {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }

    order.paymentStatus = paymentStatus;
    
    if (paymentStatus === 'paid') {
      order.paymentDetails = {
        ...order.paymentDetails,
        ...paymentDetails,
        paidAt: new Date()
      };
    }

    await order.save();
    await order.populate(this.populateOptions);

    return this.formatOrderResponse(order, lang);
  }

  // إلغاء الطلب
  async cancelOrder(orderId, userId, reason, isAdmin = false, lang = 'en') {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }

    // التحقق من الصلاحيات
    if (!isAdmin && order.user.toString() !== userId.toString()) {
      throw new AppError(
        this.getLangMessage(lang, 'You can only cancel your own orders', 'يمكنك إلغاء طلباتك فقط'),
        403
      );
    }

    // التحقق من إمكانية الإلغاء
    if (!order.canBeCancelled()) {
      throw new AppError(
        this.getLangMessage(lang, 'This order cannot be cancelled', 'لا يمكن إلغاء هذا الطلب'),
        400
      );
    }

    order.cancellationReason = reason;
    order.addStatusHistory('cancelled', reason, userId);
    
    // إرجاع المخزون
    await this.updateProductStock(order.items, 'increase');

    await order.save();
    await order.populate(this.populateOptions);

    return this.formatOrderResponse(order, lang);
  }

  // طلب إرجاع
  async requestReturn(orderId, userId, reason, lang = 'en') {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }

    if (order.user.toString() !== userId.toString()) {
      throw new AppError(
        this.getLangMessage(lang, 'You can only return your own orders', 'يمكنك إرجاع طلباتك فقط'),
        403
      );
    }

    if (!order.canBeReturned()) {
      throw new AppError(
        this.getLangMessage(lang, 'This order cannot be returned', 'لا يمكن إرجاع هذا الطلب'),
        400
      );
    }

    order.returnReason = reason;
    order.addStatusHistory('returned', reason, userId);

    await order.save();
    await order.populate(this.populateOptions);

    return this.formatOrderResponse(order, lang);
  }

  // حذف الطلب (Soft Delete)
  async deleteOrder(orderId, userId, isAdmin = false, lang = 'en') {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      throw new AppError(
        this.getLangMessage(lang, 'Order not found', 'الطلب غير موجود'),
        404
      );
    }

    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = userId;

    await order.save();

    return {
      message: this.getLangMessage(lang, 'Order deleted successfully', 'تم حذف الطلب بنجاح')
    };
  }

  // ==================== Statistics ====================

  // إحصائيات الطلبات
  async getOrderStats(query = {}, lang = 'en') {
    const { startDate, endDate } = query;
    const stats = await OrderModel.getOrderStats(startDate, endDate);
    
    // ترجمة الحالات
    stats.byStatus = stats.byStatus.map(s => ({
      status: s._id,
      statusText: this.getStatusTranslation(s._id, lang),
      count: s.count
    }));
    
    stats.byPaymentMethod = stats.byPaymentMethod.map(p => ({
      method: p._id,
      methodText: this.getPaymentMethodTranslation(p._id, lang),
      count: p.count,
      total: p.total
    }));
    
    return stats;
  }

  // عدد الطلبات
  async getOrdersCount(filter = {}) {
    const baseFilter = { isDeleted: false, ...filter };
    
    const [total, pending, processing, shipped, delivered, cancelled] = await Promise.all([
      OrderModel.countDocuments(baseFilter),
      OrderModel.countDocuments({ ...baseFilter, status: 'pending' }),
      OrderModel.countDocuments({ ...baseFilter, status: 'processing' }),
      OrderModel.countDocuments({ ...baseFilter, status: 'shipped' }),
      OrderModel.countDocuments({ ...baseFilter, status: 'delivered' }),
      OrderModel.countDocuments({ ...baseFilter, status: 'cancelled' })
    ]);

    return { total, pending, processing, shipped, delivered, cancelled };
  }

  // الإيرادات
  async getRevenue(query = {}) {
    const { startDate, endDate, groupBy = 'day' } = query;
    
    const matchStage = { 
      isDeleted: false,
      paymentStatus: 'paid'
    };
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    let dateFormat;
    switch (groupBy) {
      case 'month': dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } }; break;
      case 'year': dateFormat = { $dateToString: { format: '%Y', date: '$createdAt' } }; break;
      default: dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    const revenue = await OrderModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: dateFormat,
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const total = revenue.reduce((sum, r) => sum + r.revenue, 0);

    return { revenue, total };
  }

  // أفضل المنتجات مبيعاً
  async getTopSellingProducts(limit = 10) {
    const products = await OrderModel.aggregate([
      { $match: { isDeleted: false, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 1,
          totalQuantity: 1,
          totalRevenue: 1,
          productNameEn: '$product.productNameEn',
          productNameAr: '$product.productNameAr',
          productImage: '$product.productImage',
          productSlug: '$product.productSlug'
        }
      }
    ]);

    return products;
  }
}

module.exports = new OrderService();