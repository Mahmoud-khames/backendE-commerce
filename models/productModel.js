// models/productModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    productNameEn: {
      type: String,
      required: [true, "Product name in English is required"],
      trim: true,
    },
    productNameAr: {
      type: String,
      required: [true, "Product name in Arabic is required"],
      trim: true,
    },
    productDescriptionEn: {
      type: String,
      required: [true, "Product description in English is required"],
      trim: true,
    },
    productDescriptionAr: {
      type: String,
      required: [true, "Product description in Arabic is required"],
      trim: true,
    },
    productPrice: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    oldProductPrice: {
      type: Number,
      default: 0,
    },
    productDiscountPrice: {
      type: Number,
      default: 0,
    },
    productCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
      required: [true, "Product category is required"],
    },
    productImage: {
      type: String,
      required: [true, "Product image is required"],
    },
    productImages: [
      {
        type: String,
      },
    ],
    productColorsEn: [
      {
        type: String,
        trim: true,
      },
    ],
    productColorsAr: [
      {
        type: String,
        trim: true,
      },
    ],
    productSizesEn: [
      {
        type: String,
        trim: true,
      },
    ],
    productSizesAr: [
      {
        type: String,
        trim: true,
      },
    ],
    productStatus: {
      type: Boolean,
      default: true,
    },
    productQuantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity cannot be negative"],
    },
    productCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    productRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    productReviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    productDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    productDiscountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    productDiscountStartDate: {
      type: Date,
    },
    productDiscountEndDate: {
      type: Date,
    },
    hasActiveDiscount: {
      type: Boolean,
      default: false,
    },
    NEW: {
      type: Boolean,
      default: false,
    },
    newUntil: {
      type: Date,
    },
    productSlug: {
      type: String,
      unique: true,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // حقول البحث المحسّنة
    searchText: {
      type: String,
      // index: 'text'  <-- Removed to avoid conflict with existing compound text index
    },
    searchTags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    popularityScore: {
      type: Number,
      default: 0,
    },
    searchCount: {
      type: Number,
      default: 0,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    purchaseCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// إنشاء compound text index للبحث المحسّن
productSchema.index(
  {
    productNameEn: "text",
    productNameAr: "text",
    productDescriptionEn: "text",
    productDescriptionAr: "text",
    searchTags: "text",
  },
  {
    weights: {
      productNameEn: 10,
      productNameAr: 10,
      productDescriptionEn: 5,
      productDescriptionAr: 5,
      searchTags: 3,
    },
    name: "ProductSearchIndex",
    default_language: "none",
  }
);

// إضافة indexes للأداء
// productSchema.index({ productSlug: 1 }); // Removed duplicate index
productSchema.index({ productCategory: 1, productStatus: 1 });
productSchema.index({ productPrice: 1 });
productSchema.index({ popularityScore: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ searchCount: -1 });
productSchema.index({ isDeleted: 1, productStatus: 1 });

// Pre-save hook لتحديث searchText
productSchema.pre("save", function (next) {
  // بناء نص البحث الموحد
  this.searchText = [
    this.productNameEn,
    this.productNameAr,
    this.productDescriptionEn,
    this.productDescriptionAr,
    ...(this.searchTags || []),
  ]
    .filter(Boolean)
    .join(" ");

  next();
});

// Virtual للسعر النهائي
productSchema.virtual("finalPrice").get(function () {
  if (this.hasActiveDiscount && this.productDiscountPrice > 0) {
    return this.productDiscountPrice;
  }
  return this.productPrice;
});

// Method لتحديث شعبية المنتج
productSchema.methods.updatePopularity = async function () {
  const Review = mongoose.model("Review");
  const reviewCount = await Review.countDocuments({ product: this._id });
  const avgRating = this.productRating || 0;

  // حساب معامل الشعبية (يمكن تعديل الأوزان)
  this.popularityScore =
    reviewCount * 0.3 +
    avgRating * 10 +
    this.searchCount * 0.1 +
    this.clickCount * 0.2 +
    this.purchaseCount * 0.4;

  await this.save();
  return this.popularityScore;
};

// Static method لتحديث حالة NEW والخصومات
productSchema.statics.updateNewAndDiscountStatus = async function () {
  const now = new Date();

  // تحديث المنتجات الجديدة المنتهية
  await this.updateMany(
    { NEW: true, newUntil: { $lte: now } },
    { $set: { NEW: false, newUntil: null } }
  );

  // تحديث الخصومات المنتهية
  await this.updateMany(
    {
      hasActiveDiscount: true,
      productDiscountEndDate: { $lte: now },
    },
    {
      $set: {
        hasActiveDiscount: false,
        productDiscountPrice: 0,
      },
    }
  );

  // تفعيل الخصومات الجديدة
  await this.updateMany(
    {
      productDiscountPercentage: { $gt: 0 },
      productDiscountStartDate: { $lte: now },
      productDiscountEndDate: { $gte: now },
      hasActiveDiscount: false,
    },
    [
      {
        $set: {
          hasActiveDiscount: true,
          productDiscountPrice: {
            $subtract: [
              "$productPrice",
              {
                $multiply: [
                  "$productPrice",
                  { $divide: ["$productDiscountPercentage", 100] },
                ],
              },
            ],
          },
        },
      },
    ]
  );
};

// Method لتسجيل نقرة
productSchema.methods.recordClick = async function () {
  this.clickCount += 1;
  await this.save();
};

// Method لتسجيل بحث
productSchema.methods.recordSearch = async function () {
  this.searchCount += 1;
  await this.save();
};

// Method لتسجيل شراء
productSchema.methods.recordPurchase = async function (quantity = 1) {
  this.purchaseCount += quantity;
  await this.save();
};

module.exports = mongoose.model("Product", productSchema);
