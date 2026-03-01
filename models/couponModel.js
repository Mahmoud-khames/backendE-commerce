// models/couponModel.js
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    // كود الكوبون (فريد)
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // الاسم بالعربي والإنجليزي
    nameEn: {
      type: String,
      required: [true, "Coupon name in English is required"],
      maxlength: [100, "Name cannot exceed 100 characters"],
      trim: true,
    },
    nameAr: {
      type: String,
      required: [true, "اسم الكوبون بالعربي مطلوب"],
      maxlength: [100, "الاسم لا يمكن أن يتجاوز 100 حرف"],
      trim: true,
    },

    // الوصف بالعربي والإنجليزي
    descriptionEn: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    descriptionAr: {
      type: String,
      maxlength: [500, "الوصف لا يمكن أن يتجاوز 500 حرف"],
      default: "",
    },

    // نوع الخصم
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Discount type is required"],
      default: "percentage",
    },

    // قيمة الخصم
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },

    // الحد الأدنى لقيمة الطلب
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum purchase amount cannot be negative"],
    },

    // الحد الأقصى للخصم (للكوبونات من نوع percentage)
    maxDiscountAmount: {
      type: Number,
      default: null,
    },

    // تاريخ البداية والنهاية
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },

    // الحالة
    isActive: {
      type: Boolean,
      default: true,
    },

    // عدد مرات الاستخدام
    usageLimit: {
      type: Number,
      default: null, // null يعني غير محدود
    },
    usageCount: {
      type: Number,
      default: 0,
    },

    // عدد مرات الاستخدام لكل مستخدم
    usageLimitPerUser: {
      type: Number,
      default: 1,
    },

    // المستخدمون الذين استخدموا الكوبون
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usedCount: {
          type: Number,
          default: 1,
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // المستخدمون المسموح لهم (إذا كان الكوبون خاصاً)
    allowedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // الفئات المسموح بها
    allowedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categories",
      },
    ],

    // المنتجات المسموح بها
    allowedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // المنتجات المستثناة
    excludedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // طرق الدفع المسموح بها
    allowedPaymentMethods: [
      {
        type: String,
        enum: ["cod", "paypal", "stripe", "bank_transfer"],
      },
    ],

    // نوع الكوبون
    type: {
      type: String,
      enum: ["public", "private", "first_order", "birthday"],
      default: "public",
    },

    // تطبيق على الشحن
    applyToShipping: {
      type: Boolean,
      default: false,
    },

    // يمكن دمجه مع كوبونات أخرى
    stackable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual للاسم حسب اللغة
couponSchema.virtual("name").get(function () {
  return {
    en: this.nameEn,
    ar: this.nameAr,
  };
});

// Virtual للوصف حسب اللغة
couponSchema.virtual("description").get(function () {
  return {
    en: this.descriptionEn || "",
    ar: this.descriptionAr || "",
  };
});

// Virtual لعدد الاستخدامات المتبقية
couponSchema.virtual("remainingUses").get(function () {
  if (this.usageLimit === null) return null; // غير محدود
  return Math.max(0, this.usageLimit - this.usageCount);
});

// Virtual لحالة الصلاحية
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.startDate &&
    now <= this.endDate &&
    (this.usageLimit === null || this.usageCount < this.usageLimit)
  );
});

// فهارس
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });
couponSchema.index({ "usedBy.user": 1 });

// Middleware للتحقق من صحة البيانات
couponSchema.pre("save", function (next) {
  // التحقق من التواريخ
  if (this.startDate >= this.endDate) {
    return next(new Error("End date must be after start date"));
  }

  // التحقق من قيمة الخصم للنسبة المئوية
  if (this.discountType === "percentage" && this.discountValue > 100) {
    return next(new Error("Percentage discount cannot exceed 100%"));
  }

  // تحويل الكود إلى حروف كبيرة
  if (this.code) {
    this.code = this.code.toUpperCase();
  }

  next();
});

// Method للتحقق من إمكانية استخدام الكوبون
couponSchema.methods.canBeUsedBy = function (userId) {
  // التحقق من الصلاحية العامة
  if (!this.isValid) return false;

  // التحقق من الكوبونات الخاصة
  if (this.type === "private" && this.allowedUsers.length > 0) {
    if (!this.allowedUsers.some((id) => id.toString() === userId.toString())) {
      return false;
    }
  }

  // التحقق من حد الاستخدام للمستخدم
  if (this.usageLimitPerUser > 0) {
    const userUsage = this.usedBy.find(
      (u) => u.user.toString() === userId.toString()
    );
    if (userUsage && userUsage.usedCount >= this.usageLimitPerUser) {
      return false;
    }
  }

  return true;
};

// Method لتسجيل استخدام الكوبون
couponSchema.methods.recordUsage = function (userId) {
  this.usageCount += 1;

  const existingUsage = this.usedBy.find(
    (u) => u.user.toString() === userId.toString()
  );

  if (existingUsage) {
    existingUsage.usedCount += 1;
    existingUsage.usedAt = new Date();
  } else {
    this.usedBy.push({
      user: userId,
      usedCount: 1,
      usedAt: new Date(),
    });
  }
};

// Method لحساب الخصم
couponSchema.methods.calculateDiscount = function (amount) {
  if (amount < this.minPurchaseAmount) {
    return 0;
  }

  let discount = 0;

  if (this.discountType === "percentage") {
    discount = (amount * this.discountValue) / 100;

    if (this.maxDiscountAmount !== null && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else {
    discount = Math.min(this.discountValue, amount);
  }

  return Math.round(discount * 100) / 100;
};

// Method للحصول على بيانات الكوبون حسب اللغة
couponSchema.methods.toLocalizedJSON = function (lang = "en") {
  const obj = this.toObject();

  return {
    _id: obj._id,
    code: this.code,
    name: lang === "ar" ? this.nameAr : this.nameEn,
    nameEn: this.nameEn,
    nameAr: this.nameAr,
    description: lang === "ar" ? this.descriptionAr : this.descriptionEn,
    descriptionEn: this.descriptionEn,
    descriptionAr: this.descriptionAr,
    discountType: this.discountType,
    discountValue: this.discountValue,
    minPurchaseAmount: this.minPurchaseAmount,
    maxDiscountAmount: this.maxDiscountAmount,
    startDate: this.startDate,
    endDate: this.endDate,
    isActive: this.isActive,
    isValid: this.isValid,
    usageLimit: this.usageLimit,
    usageCount: this.usageCount,
    remainingUses: this.remainingUses,
    type: this.type,
    applyToShipping: this.applyToShipping,
    stackable: this.stackable,
    createdAt: this.createdAt,
  };
};

// Static method للحصول على الكوبونات النشطة
couponSchema.statics.getActiveCoupons = async function (lang = "en") {
  const now = new Date();

  const coupons = await this.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { usageLimit: null },
      { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
    ],
  }).sort({ createdAt: -1 });

  return coupons.map((coupon) => coupon.toLocalizedJSON(lang));
};

const CouponModel = mongoose.model("Coupon", couponSchema);
module.exports = CouponModel;
