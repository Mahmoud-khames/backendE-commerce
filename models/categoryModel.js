// models/categoryModel.js
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    // الاسم بالعربي والإنجليزي
    nameEn: {
      type: String,
      required: [true, 'Category name in English is required'],
      unique: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
      trim: true
    },
    nameAr: {
      type: String,
      required: [true, 'اسم الفئة بالعربي مطلوب'],
      unique: true,
      maxlength: [50, 'الاسم لا يمكن أن يتجاوز 50 حرف'],
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
    
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Categories',
      default: null
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual للحصول على الاسم حسب اللغة
categorySchema.virtual('name').get(function() {
  return {
    en: this.nameEn,
    ar: this.nameAr
  };
});

// Virtual للحصول على الوصف حسب اللغة
categorySchema.virtual('description').get(function() {
  return {
    en: this.descriptionEn || '',
    ar: this.descriptionAr || ''
  };
});

// Virtual للفئات الفرعية
categorySchema.virtual('subcategories', {
  ref: 'Categories',
  localField: '_id',
  foreignField: 'parentCategory'
});

// فهارس
categorySchema.index({ status: 1 });
categorySchema.index({ isDeleted: 1 });
categorySchema.index({ order: 1 });
categorySchema.index({ parentCategory: 1 });

// Middleware لفلترة الفئات المحذوفة
categorySchema.pre('find', function(next) {
  if (!this.getQuery().hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

categorySchema.pre('findOne', function(next) {
  if (!this.getQuery().hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

// Method للحصول على بيانات الفئة حسب اللغة
categorySchema.methods.toLocalizedJSON = function(lang = 'en') {
  const obj = this.toObject();
  
  return {
    _id: obj._id,
    name: lang === 'ar' ? this.nameAr : this.nameEn,
    nameEn: this.nameEn,
    nameAr: this.nameAr,
    description: lang === 'ar' ? this.descriptionAr : this.descriptionEn,
    descriptionEn: this.descriptionEn,
    descriptionAr: this.descriptionAr,
    slug: this.slug,
    image: this.image,
    status: this.status,
    order: this.order,
    parentCategory: this.parentCategory,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method للحصول على الفئات النشطة
categorySchema.statics.getActiveCategories = function() {
  return this.find({ status: true, isDeleted: false }).sort({ order: 1 });
};

// Static method للحصول على الفئات الرئيسية
categorySchema.statics.getMainCategories = function() {
  return this.find({ 
    status: true, 
    isDeleted: false, 
    parentCategory: null 
  })
  .sort({ order: 1 })
  .populate('subcategories');
};

const CategoryModel = mongoose.model("Categories", categorySchema);
module.exports = CategoryModel;