// models/reviewModel.js
const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    comment: {
      type: String,
      required: [true, "Comment is required"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      trim: true,
    },
    images: [
      {
        type: String,
      },
    ],
    status: {
      type: Boolean,
      default: true,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
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

// فهارس
reviewSchema.index({ product: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // مراجعة واحدة لكل مستخدم لكل منتج

// Virtual للتاريخ المنسق
reviewSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Middleware لتحديث تقييم المنتج بعد الحفظ
reviewSchema.post("save", async function () {
  await this.constructor.updateProductRating(this.product);
});

// Middleware لتحديث تقييم المنتج بعد الحذف
reviewSchema.post("remove", async function () {
  await this.constructor.updateProductRating(this.product);
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.updateProductRating(doc.product);
  }
});

// Static method لتحديث تقييم المنتج
reviewSchema.statics.updateProductRating = async function (productId) {
  try {
    const Product = mongoose.model("Product");

    const stats = await this.aggregate([
      { $match: { product: productId, status: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        productRating: Math.round(stats[0].averageRating * 10) / 10,
        $set: {
          productReviews: await this.find({
            product: productId,
            status: true,
          }).select("_id"),
        },
      });
    } else {
      await Product.findByIdAndUpdate(productId, {
        productRating: 0,
        productReviews: [],
      });
    }
  } catch (error) {
    console.error("Error updating product rating:", error);
  }
};

// Static method للحصول على إحصائيات التقييم
reviewSchema.statics.getRatingStats = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: { product: new mongoose.Types.ObjectId(productId), status: true },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const distribution = {};

  for (let i = 5; i >= 1; i--) {
    const found = stats.find((s) => s._id === i);
    distribution[i] = {
      count: found ? found.count : 0,
      percentage:
        total > 0 ? Math.round(((found ? found.count : 0) / total) * 100) : 0,
    };
  }

  return {
    total,
    distribution,
  };
};

const ReviewModel = mongoose.model("Review", reviewSchema);
module.exports = ReviewModel;
