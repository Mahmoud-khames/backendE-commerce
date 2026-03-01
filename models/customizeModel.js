// models/customizeModel.js
const mongoose = require("mongoose");

const customizeSchema = new mongoose.Schema(
  {
    // العنوان بالعربي والإنجليزي
    titleEn: {
      type: String,
      required: [true, 'Title in English is required'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
      trim: true
    },
    titleAr: {
      type: String,
      required: [true, 'العنوان بالعربي مطلوب'],
      maxlength: [100, 'العنوان لا يمكن أن يتجاوز 100 حرف'],
      trim: true
    },
    
    // الوصف بالعربي والإنجليزي
    descriptionEn: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },
    descriptionAr: {
      type: String,
      maxlength: [500, 'الوصف لا يمكن أن يتجاوز 500 حرف'],
      default: ''
    },
    
    // نص الزر بالعربي والإنجليزي
    buttonTextEn: {
      type: String,
      default: 'Shop Now'
    },
    buttonTextAr: {
      type: String,
      default: 'تسوق الآن'
    },
    
    // رابط الزر
    buttonLink: {
      type: String,
      default: ''
    },
    
    // صور السلايدر
    slideImages: [{
      url: {
        type: String,
        required: true
      },
      altEn: String,
      altAr: String,
      order: {
        type: Number,
        default: 0
      }
    }],
    
    // ترتيب العرض
    displayOrder: {
      type: Number,
      default: 0
    },
    
    // حالة التفعيل
    isActive: {
      type: Boolean,
      default: true
    },
    
    // نوع السلايدر
    type: {
      type: String,
      enum: ['hero', 'banner', 'promotional', 'category'],
      default: 'hero'
    },
    
    // تاريخ البداية والنهاية للعرض
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    
    // إعدادات متقدمة
    settings: {
      autoPlay: {
        type: Boolean,
        default: true
      },
      autoPlaySpeed: {
        type: Number,
        default: 3000
      },
      showArrows: {
        type: Boolean,
        default: true
      },
      showDots: {
        type: Boolean,
        default: true
      },
      loop: {
        type: Boolean,
        default: true
      }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual للعنوان حسب اللغة
customizeSchema.virtual('title').get(function() {
  return {
    en: this.titleEn,
    ar: this.titleAr
  };
});

// Virtual للوصف حسب اللغة
customizeSchema.virtual('description').get(function() {
  return {
    en: this.descriptionEn || '',
    ar: this.descriptionAr || ''
  };
});

// Virtual لنص الزر حسب اللغة
customizeSchema.virtual('buttonText').get(function() {
  return {
    en: this.buttonTextEn,
    ar: this.buttonTextAr
  };
});

// Virtual لعدد الصور
customizeSchema.virtual('imagesCount').get(function() {
  return this.slideImages ? this.slideImages.length : 0;
});

// فهارس
customizeSchema.index({ displayOrder: 1 });
customizeSchema.index({ isActive: 1 });
customizeSchema.index({ type: 1 });
customizeSchema.index({ startDate: 1, endDate: 1 });

// Middleware للتحقق من صحة التواريخ
customizeSchema.pre('save', function(next) {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    return next(new Error('Start date cannot be after end date'));
  }
  
  // ترتيب الصور حسب order
  if (this.slideImages && this.slideImages.length > 0) {
    this.slideImages.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  
  next();
});

// Method للتحقق من نشاط السلايد
customizeSchema.methods.isCurrentlyActive = function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  
  return true;
};

// Method للحصول على بيانات السلايد حسب اللغة
customizeSchema.methods.toLocalizedJSON = function(lang = 'en') {
  const obj = this.toObject();
  
  return {
    _id: obj._id,
    title: lang === 'ar' ? this.titleAr : this.titleEn,
    description: lang === 'ar' ? this.descriptionAr : this.descriptionEn,
    buttonText: lang === 'ar' ? this.buttonTextAr : this.buttonTextEn,
    buttonLink: this.buttonLink,
    slideImages: obj.slideImages?.map(img => ({
      url: img.url,
      alt: lang === 'ar' ? img.altAr : img.altEn,
      order: img.order
    })),
    displayOrder: this.displayOrder,
    isActive: this.isActive,
    type: this.type,
    settings: this.settings,
    isCurrentlyActive: this.isCurrentlyActive(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method للحصول على السلايدات النشطة
customizeSchema.statics.getActiveSlides = async function(type = null, lang = 'en') {
  const now = new Date();
  
  const filter = {
    isActive: true,
    $or: [
      { startDate: null, endDate: null },
      { startDate: { $lte: now }, endDate: null },
      { startDate: null, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: { $gte: now } }
    ]
  };
  
  if (type) {
    filter.type = type;
  }
  
  const slides = await this.find(filter).sort({ displayOrder: 1 });
  
  return slides.map(slide => slide.toLocalizedJSON(lang));
};

const CustomizeModel = mongoose.model("Customize", customizeSchema);
module.exports = CustomizeModel;