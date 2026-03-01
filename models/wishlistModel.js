// models/wishlistModel.js
const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    unique: true // كل مستخدم له wishlist واحدة فقط
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual لعدد المنتجات
wishlistSchema.virtual('productsCount').get(function() {
  return this.products ? this.products.length : 0;
});

// فهارس
wishlistSchema.index({ user: 1 });

// Middleware لإزالة المنتجات المكررة
wishlistSchema.pre('save', function(next) {
  if (this.products && this.products.length > 0) {
    // إزالة المكررات
    const uniqueProducts = [...new Set(this.products.map(p => p.toString()))];
    this.products = uniqueProducts;
  }
  next();
});

// Static method للحصول على wishlist المستخدم
wishlistSchema.statics.getByUser = async function(userId) {
  let wishlist = await this.findOne({ user: userId });
  if (!wishlist) {
    wishlist = await this.create({ user: userId, products: [] });
  }
  return wishlist;
};

// Method لإضافة منتج
wishlistSchema.methods.addProduct = function(productId) {
  const productIdStr = productId.toString();
  const exists = this.products.some(p => p.toString() === productIdStr);
  if (!exists) {
    this.products.push(productId);
  }
  return !exists; // return true if added, false if already exists
};

// Method لإزالة منتج
wishlistSchema.methods.removeProduct = function(productId) {
  const productIdStr = productId.toString();
  const initialLength = this.products.length;
  this.products = this.products.filter(p => p.toString() !== productIdStr);
  return this.products.length < initialLength; // return true if removed
};

// Method للتحقق من وجود منتج
wishlistSchema.methods.hasProduct = function(productId) {
  return this.products.some(p => p.toString() === productId.toString());
};

// Method لمسح الـ wishlist
wishlistSchema.methods.clear = function() {
  this.products = [];
};

module.exports = mongoose.model('Wishlist', wishlistSchema);