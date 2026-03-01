// models/orderModel.js
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

// مخطط عنصر الطلب
const orderItemSchema = new mongoose.Schema({
  product: {
    type: ObjectId,
    ref: "Product",
    required: [true, 'Product is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountedPrice: {
    type: Number,
    default: 0
  },
  size: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: null
  },
  // اسم المنتج وقت الطلب (للحفاظ على السجل حتى لو تم حذف المنتج)
  productNameEn: String,
  productNameAr: String,
  productImage: String
});

// مخطط عنوان الشحن
const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required']
  },
  addressLine1: {
    type: String,
    required: [true, 'Address is required']
  },
  addressLine2: String,
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: String,
  country: {
    type: String,
    required: [true, 'Country is required'],
    default: 'Saudi Arabia'
  },
  postalCode: String,
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },
  alternatePhone: String,
  isDefault: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// مخطط سجل حالة الطلب
const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  note: String,
  changedBy: {
    type: ObjectId,
    ref: 'User'
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// مخطط الطلب الرئيسي
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true
    },
    items: [orderItemSchema],
    user: {
      type: ObjectId,
      ref: "User",
      required: [true, 'User is required'],
      index: true
    },
    
    // المبالغ
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: 0
    },
    
    // عنوان الشحن
    shippingAddress: shippingAddressSchema,
    
    // الكوبون
    coupon: {
      code: String,
      discountType: {
        type: String,
        enum: ['percentage', 'fixed']
      },
      discountValue: Number
    },
    
    // طريقة الدفع
    paymentMethod: {
      type: String,
      enum: ["cod", "paypal", "stripe", "bank_transfer"],
      default: "cod"
    },
    paymentDetails: {
      transactionId: String,
      paymentIntentId: String,
      paidAt: Date,
      paymentGateway: String
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
      default: "pending",
      index: true
    },
    
    // حالة الطلب
    status: {
      type: String,
      default: "pending",
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
        "refunded"
      ],
      index: true
    },
    statusHistory: [statusHistorySchema],
    
    // معلومات الشحن
    shippingMethod: {
      type: String,
      enum: ["standard", "express", "same_day"],
      default: "standard"
    },
    trackingNumber: String,
    trackingUrl: String,
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    
    // ملاحظات
    customerNote: String,
    adminNote: String,
    
    // سبب الإلغاء/الإرجاع
    cancellationReason: String,
    returnReason: String,
    
    // الفواتير
    invoiceNumber: String,
    invoiceUrl: String,
    
    // الحذف الناعم
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date,
    deletedBy: {
      type: ObjectId,
      ref: 'User'
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual لعدد المنتجات
orderSchema.virtual('itemsCount').get(function() {
  return this.items ? this.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
});

// Virtual للحالة بالعربي
orderSchema.virtual('statusAr').get(function() {
  const statusMap = {
    'pending': 'قيد الانتظار',
    'confirmed': 'مؤكد',
    'processing': 'قيد المعالجة',
    'shipped': 'تم الشحن',
    'out_for_delivery': 'في الطريق للتوصيل',
    'delivered': 'تم التوصيل',
    'cancelled': 'ملغي',
    'returned': 'مرتجع',
    'refunded': 'مسترد'
  };
  return statusMap[this.status] || this.status;
});

// Virtual لحالة الدفع بالعربي
orderSchema.virtual('paymentStatusAr').get(function() {
  const statusMap = {
    'pending': 'قيد الانتظار',
    'paid': 'مدفوع',
    'failed': 'فشل',
    'refunded': 'مسترد',
    'partially_refunded': 'مسترد جزئياً'
  };
  return statusMap[this.paymentStatus] || this.paymentStatus;
});

// Virtual لطريقة الدفع بالعربي
orderSchema.virtual('paymentMethodAr').get(function() {
  const methodMap = {
    'cod': 'الدفع عند الاستلام',
    'paypal': 'باي بال',
    'stripe': 'بطاقة ائتمان',
    'bank_transfer': 'تحويل بنكي'
  };
  return methodMap[this.paymentMethod] || this.paymentMethod;
});

// فهارس
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderNumber: 1 });

// Middleware لإنشاء رقم الطلب
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // الحصول على آخر طلب لليوم
    const lastOrder = await this.constructor.findOne({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    }).sort({ createdAt: -1 });
    
    let sequence = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `ORD${year}${month}${day}${sequence.toString().padStart(4, '0')}`;
  }
  
  // إضافة الحالة الأولى إلى سجل الحالات
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [{
      status: this.status,
      changedAt: new Date()
    }];
  }
  
  next();
});

// Middleware لفلترة الطلبات المحذوفة
orderSchema.pre('find', function(next) {
  if (!this.getQuery().hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

orderSchema.pre('findOne', function(next) {
  if (!this.getQuery().hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

// Method لإضافة حالة جديدة
orderSchema.methods.addStatusHistory = function(status, note = null, changedBy = null) {
  this.statusHistory.push({
    status,
    note,
    changedBy,
    changedAt: new Date()
  });
  this.status = status;
};

// Method للتحقق من إمكانية الإلغاء
orderSchema.methods.canBeCancelled = function() {
  const nonCancellableStatuses = ['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'];
  return !nonCancellableStatuses.includes(this.status);
};

// Method للتحقق من إمكانية الإرجاع
orderSchema.methods.canBeReturned = function() {
  if (this.status !== 'delivered') return false;
  
  // يمكن الإرجاع خلال 14 يوم من التوصيل
  const deliveryDate = this.actualDeliveryDate || this.updatedAt;
  const daysSinceDelivery = Math.floor((new Date() - deliveryDate) / (1000 * 60 * 60 * 24));
  
  return daysSinceDelivery <= 14;
};

// Method للحصول على بيانات الطلب حسب اللغة
orderSchema.methods.toLocalizedJSON = function(lang = 'en') {
  const obj = this.toObject();
  
  return {
    ...obj,
    status: lang === 'ar' ? this.statusAr : this.status,
    paymentStatus: lang === 'ar' ? this.paymentStatusAr : this.paymentStatus,
    paymentMethod: lang === 'ar' ? this.paymentMethodAr : this.paymentMethod,
    items: obj.items.map(item => ({
      ...item,
      productName: lang === 'ar' ? item.productNameAr : item.productNameEn
    }))
  };
};

// Static methods للإحصائيات
orderSchema.statics.getOrderStats = async function(startDate, endDate) {
  const matchStage = { isDeleted: false };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        totalItemsSold: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ]);
  
  const statusCounts = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const paymentMethodCounts = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        total: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  return {
    summary: stats[0] || { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0, totalItemsSold: 0 },
    byStatus: statusCounts,
    byPaymentMethod: paymentMethodCounts
  };
};

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;