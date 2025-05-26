const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      maxlength: 32,
    },
    productDescription: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    productPrice: {
      type: Number,
      required: true,
    },
    oldProductPrice: {
      type: Number,
      default: 0,
      required: true,
    },
    productImage: {
      type: String,
      default: "",
    },
    productSlug: {
      type: String,
      required: [true, 'حقل slug مطلوب'],
      unique: true,
      index: true,
      validate: {
        validator: function(v) {
          return /^[a-z0-9\-]+$/.test(v);
        },
        message: 'صيغة slug غير صالحة'
      },
      immutable: true
    },
    productImages: [
      {
        type: String,
        required: true,
      },
    ],
    productColors: [
      {
        type: String,
        required: true,
      },
    ],
    productSizes: [
      {
        type: String,
        required: true,
      },
    ],
    productCategory: {
      type: ObjectId,
      ref: "Categories",
      required: true,
    },
    productQuantity: {
      type: Number,
      required: true,
    },
    productStatus: {
      type: Boolean,
      default: true,
    },
    productRating: {
      type: Number,
      default: 0,
      max: 5,
      min: 0,
    },
    productReviews: [
      {
        type: ObjectId,
        ref: "Review", // Ensure the correct model name is used here
      },
      { timestamps: true },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    }, 
    productDiscount: {
      type: Number,
      default: 0,
    },
    productDiscountPrice: {
      type: Number,
      default: 0,
    },
    productDiscountPercentage: {
      type: Number,
      default: 0,
    },
    productDiscountStartDate: {
      type: Date,
      default: null,
    },
    productDiscountEndDate: {
      type: Date,
      default: null,
    },
    NEW: {
      type: Boolean,
      default: false,
    },
    newUntil: {
      type: Date,
      default: function() {
        // إذا كان المنتج جديدًا، يتم تعيين تاريخ انتهاء الجدة بعد 24 ساعة من الإنشاء
        if (this.NEW) {
          const date = new Date();
          date.setHours(date.getHours() + 24);
          return date;
        }
        return null;
      }
    },
    hasActiveDiscount: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

// إضافة فهرس نصي للبحث
productSchema.index({ 
  productName: 'text', 
  productDescription: 'text' 
}, {
  weights: {
    productName: 10,
    productDescription: 5
  },
  name: "ProductTextIndex"
});

// إضافة middleware لتحديث حالة المنتج الجديد والخصم تلقائيًا
productSchema.pre('find', function(next) {
  this.where({
    $or: [
      { isDeleted: false },
      { isDeleted: { $exists: false } }
    ]
  });
  next();
});

// middleware لتحديث حالة المنتج الجديد والخصم قبل الحفظ
productSchema.pre('save', function(next) {
  const now = new Date();
  
  // تحديث حالة المنتج الجديد
  if (this.NEW && this.newUntil && now > this.newUntil) {
    this.NEW = false;
  }
  
  // تحديث حالة الخصم
  if (this.productDiscountStartDate && this.productDiscountEndDate) {
    this.hasActiveDiscount = (
      now >= this.productDiscountStartDate && 
      now <= this.productDiscountEndDate
    );
    
    // حساب سعر الخصم إذا كان الخصم نشطًا
    if (this.hasActiveDiscount && this.productDiscountPercentage > 0) {
      this.productDiscountPrice = this.productPrice - (this.productPrice * (this.productDiscountPercentage / 100));
    } else {
      this.productDiscountPrice = 0;
    }
  } else {
    this.hasActiveDiscount = false;
  }
  
  next();
});

// إضافة middleware لتحديث حالة المنتجات الجديدة والخصومات عند الاستعلام
productSchema.statics.updateNewAndDiscountStatus = async function() {
  const now = new Date();
  
  // تحديث حالة المنتجات الجديدة
  await this.updateMany(
    { NEW: true, newUntil: { $lt: now } },
    { $set: { NEW: false } }
  );
  
  // تحديث حالة الخصومات النشطة
  await this.updateMany(
    { 
      productDiscountStartDate: { $lte: now },
      productDiscountEndDate: { $gte: now }
    },
    { $set: { hasActiveDiscount: true } }
  );
  
  // تحديث حالة الخصومات غير النشطة
  await this.updateMany(
    { 
      $or: [
        { productDiscountStartDate: { $gt: now } },
        { productDiscountEndDate: { $lt: now } }
      ]
    },
    { $set: { hasActiveDiscount: false, productDiscountPrice: 0 } }
  );
};

const productModel = mongoose.model("Product", productSchema);
module.exports = productModel;
