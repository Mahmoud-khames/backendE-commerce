// models/cartModel.js
const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: [true, 'Product is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  // اللون والمقاس
  size: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: null
  },
  // السعر وقت الإضافة
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountedPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  // اسم المنتج وصورته للحفظ
  productNameEn: String,
  productNameAr: String,
  productImage: String,
  // التوفر
  isAvailable: {
    type: Boolean,
    default: true
  },
  stockQuantity: Number
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, 'User is required'],
    unique: true,
    index: true
  },
  items: [cartItemSchema],
  
  // المجاميع
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // الكوبون المطبق
  appliedCoupon: {
    code: String,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: Number,
    discountAmount: Number
  },
  
  // حالة السلة
  status: {
    type: String,
    enum: ['active', 'abandoned', 'converted', 'expired'],
    default: 'active'
  },
  
  // تاريخ انتهاء الصلاحية (للسلات المتروكة)
  expiresAt: {
    type: Date,
    default: null
  },
  
  // ملاحظات
  notes: String,
  
  // معلومات إضافية
  deviceInfo: {
    type: String,
    default: null
  },
  ipAddress: String,
  
  // آخر نشاط
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual لعدد العناصر
cartSchema.virtual('itemsCount').get(function() {
  return this.items ? this.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
});

// Virtual لعدد المنتجات الفريدة
cartSchema.virtual('uniqueItemsCount').get(function() {
  return this.items ? this.items.length : 0;
});

// Virtual للمبلغ النهائي بعد الكوبون
cartSchema.virtual('finalTotal').get(function() {
  let total = this.totalPrice;
  if (this.appliedCoupon && this.appliedCoupon.discountAmount) {
    total -= this.appliedCoupon.discountAmount;
  }
  return Math.max(0, Math.round(total * 100) / 100);
});

// فهارس
cartSchema.index({ user: 1 });
cartSchema.index({ status: 1 });
cartSchema.index({ lastActivityAt: -1 });
cartSchema.index({ expiresAt: 1 }, { sparse: true });

// Middleware لحساب المجاميع تلقائياً
cartSchema.pre('save', async function(next) {
  this.lastActivityAt = new Date();
  
  let subtotal = 0;
  let totalDiscount = 0;
  
  // حساب المجاميع
  for (const item of this.items) {
    const itemPrice = item.discountedPrice > 0 ? item.discountedPrice : item.price;
    const itemDiscount = item.discountedPrice > 0 ? (item.price - item.discountedPrice) : 0;
    
    subtotal += itemPrice * item.quantity;
    totalDiscount += itemDiscount * item.quantity;
  }
  
  this.subtotal = Math.round(subtotal * 100) / 100;
  this.totalDiscount = Math.round(totalDiscount * 100) / 100;
  this.totalPrice = this.subtotal;
  
  next();
});

// Method للتحقق من توفر العناصر
cartSchema.methods.checkAvailability = async function() {
  const Product = mongoose.model('Product');
  const unavailableItems = [];
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    
    if (!product || !product.productStatus) {
      item.isAvailable = false;
      unavailableItems.push({
        productId: item.product,
        reason: 'Product not available'
      });
      continue;
    }
    
    if (product.productQuantity < item.quantity) {
      item.isAvailable = false;
      item.stockQuantity = product.productQuantity;
      unavailableItems.push({
        productId: item.product,
        productName: product.productNameEn,
        requested: item.quantity,
        available: product.productQuantity,
        reason: 'Insufficient stock'
      });
      continue;
    }
    
    item.isAvailable = true;
    item.stockQuantity = product.productQuantity;
  }
  
  return unavailableItems;
};

// Method لتحديث الأسعار من المنتجات
cartSchema.methods.updatePrices = async function() {
  const Product = mongoose.model('Product');
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    
    if (product) {
      item.price = product.productPrice;
      item.discountedPrice = product.hasActiveDiscount ? product.productDiscountPrice : 0;
      item.productNameEn = product.productNameEn;
      item.productNameAr = product.productNameAr;
      item.productImage = product.productImage;
    }
  }
  
  await this.save();
};

// Method لإضافة عنصر
cartSchema.methods.addItem = function(item) {
  const existingItemIndex = this.items.findIndex(
    i => i.product.toString() === item.product.toString() &&
         i.size === item.size &&
         i.color === item.color
  );
  
  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += item.quantity;
  } else {
    this.items.push(item);
  }
};

// Method لتحديث عنصر
cartSchema.methods.updateItem = function(productId, updates) {
  const itemIndex = this.items.findIndex(
    i => i.product.toString() === productId.toString()
  );
  
  if (itemIndex === -1) return false;
  
  if (updates.quantity !== undefined) {
    this.items[itemIndex].quantity = updates.quantity;
  }
  if (updates.size !== undefined) {
    this.items[itemIndex].size = updates.size;
  }
  if (updates.color !== undefined) {
    this.items[itemIndex].color = updates.color;
  }
  
  return true;
};

// Method لإزالة عنصر
cartSchema.methods.removeItem = function(productId) {
  const initialLength = this.items.length;
  this.items = this.items.filter(
    i => i.product.toString() !== productId.toString()
  );
  return this.items.length < initialLength;
};

// Method لمسح السلة
cartSchema.methods.clear = function() {
  this.items = [];
  this.appliedCoupon = null;
};

// Method لتطبيق كوبون
cartSchema.methods.applyCoupon = function(couponData) {
  this.appliedCoupon = {
    code: couponData.code,
    discountType: couponData.discountType,
    discountValue: couponData.discountValue,
    discountAmount: couponData.discountAmount
  };
};

// Method لإزالة الكوبون
cartSchema.methods.removeCoupon = function() {
  this.appliedCoupon = null;
};

// Method للحصول على ملخص السلة
cartSchema.methods.getSummary = function(lang = 'en') {
  return {
    itemsCount: this.itemsCount,
    uniqueItemsCount: this.uniqueItemsCount,
    subtotal: this.subtotal,
    totalDiscount: this.totalDiscount,
    couponDiscount: this.appliedCoupon?.discountAmount || 0,
    total: this.finalTotal,
    appliedCoupon: this.appliedCoupon?.code || null
  };
};

// Static method للحصول على السلات المهجورة
cartSchema.statics.getAbandonedCarts = async function(hoursAgo = 24) {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);
  
  return await this.find({
    status: 'active',
    lastActivityAt: { $lt: cutoffDate },
    'items.0': { $exists: true }
  }).populate('user', 'firstName lastName email');
};

// Static method لتنظيف السلات القديمة
cartSchema.statics.cleanupExpiredCarts = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return await this.deleteMany({
    lastActivityAt: { $lt: cutoffDate },
    status: { $in: ['abandoned', 'expired'] }
  });
};

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;