// services/categoryService.js
const MongooseFeatures = require('./mongodb/features/index');
const CategoryModel = require('../models/categoryModel');
const { pick } = require('lodash');
const AppError = require('../utils/AppError');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

class CategoryService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = [
      'nameEn',
      'nameAr',
      'descriptionEn',
      'descriptionAr',
      'slug',
      'image',
      'status',
      'order',
      'parentCategory'
    ];
    
    this.populateOptions = [
      { path: 'parentCategory', select: 'nameEn nameAr slug' },
      { path: 'subcategories', select: 'nameEn nameAr slug image status' }
    ];
  }

  // ==================== Helper Methods ====================

  // الحصول على اللغة
  getLangMessage(lang, enMsg, arMsg) {
    return lang === 'ar' ? arMsg : enMsg;
  }

  // تنسيق البيانات الواردة
  formatCategoryData(body) {
    const data = {};
    
    // الحقول النصية
    if (body.nameEn) data.nameEn = body.nameEn.trim();
    if (body.nameAr) data.nameAr = body.nameAr.trim();
    if (body.descriptionEn !== undefined) data.descriptionEn = body.descriptionEn.trim();
    if (body.descriptionAr !== undefined) data.descriptionAr = body.descriptionAr.trim();
    if (body.slug) data.slug = body.slug.toLowerCase().trim();
    
    // الحقول المنطقية
    if (body.status !== undefined) {
      data.status = body.status === 'true' || body.status === true;
    }
    
    // الحقول الرقمية
    if (body.order !== undefined) {
      data.order = parseInt(body.order) || 0;
    }
    
    // الفئة الأب
    if (body.parentCategory) {
      data.parentCategory = body.parentCategory === 'null' || body.parentCategory === '' 
        ? null 
        : body.parentCategory;
    }
    
    return data;
  }

  // إنشاء slug فريد
  async generateUniqueSlug(name) {
    const baseSlug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;
    
    while (await CategoryModel.exists({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }
    
    return slug;
  }

  // رفع صورة
  async uploadImage(file) {
    if (!file) return null;
    
    const buffer = file.buffer || file.path;
    const result = await uploadToCloudinary(buffer, 'categories');
    return result.url;
  }

  // حذف صورة من Cloudinary
  async deleteImage(imageUrl) {
    if (!imageUrl) return;
    
    try {
      const publicId = imageUrl.split('/').pop().split('.')[0];
      await deleteFromCloudinary(publicId, 'categories');
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع الفئات مع Pagination
  async getCategories(query = {}, lang = 'en') {
    const { 
      perPage = 15, 
      page = 1, 
      sorts = [], 
      queries = [],
      status,
      parentCategory
    } = pick(query, ['perPage', 'page', 'sorts', 'queries', 'status', 'parentCategory']);

    // بناء الفلتر
    let filter = { isDeleted: false };
    
    if (status !== undefined) {
      filter.status = status === 'true' || status === true;
    }
    
    if (parentCategory !== undefined) {
      filter.parentCategory = parentCategory === 'null' ? null : parentCategory;
    }

    const result = await this.PaginateHandler(
      CategoryModel, 
      Number(perPage), 
      Number(page), 
      sorts, 
      queries
    );

    // Populate البيانات
    if (result.data && result.data.length > 0) {
      await CategoryModel.populate(result.data, this.populateOptions);
    }

    return {
      result,
      keys: this.allowedKeys
    };
  }

  // الحصول على جميع الفئات بدون Pagination
  async getAllCategories(lang = 'en') {
    const categories = await CategoryModel.find({ isDeleted: false })
      .sort({ order: 1, createdAt: -1 })
      .populate(this.populateOptions);
    
    return categories;
  }

  // الحصول على الفئات النشطة فقط
  async getActiveCategories(lang = 'en') {
    const categories = await CategoryModel.find({ 
      isDeleted: false, 
      status: true 
    })
    .sort({ order: 1 })
    .populate(this.populateOptions);
    
    return categories;
  }

  // الحصول على الفئات الرئيسية مع الفرعية
  async getMainCategoriesWithSubs(lang = 'en') {
    const categories = await CategoryModel.find({ 
      isDeleted: false, 
      status: true,
      parentCategory: null
    })
    .sort({ order: 1 })
    .populate({
      path: 'subcategories',
      match: { isDeleted: false, status: true },
      options: { sort: { order: 1 } }
    });
    
    return categories;
  }

  // الحصول على فئة واحدة بالـ ID
  async getCategoryById(id, lang = 'en') {
    const category = await CategoryModel.findById(id)
      .populate(this.populateOptions);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }
    
    return category;
  }

  // الحصول على فئة بالـ Slug
  async getCategoryBySlug(slug, lang = 'en') {
    const category = await CategoryModel.findOne({ slug })
      .populate(this.populateOptions);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }
    
    return category;
  }

  // إنشاء فئة جديدة
  async createCategory(body, file, lang = 'en') {
    // التحقق من الحقول المطلوبة
    if (!body.nameEn) {
      throw new AppError(
        this.getLangMessage(lang, 'Category name in English is required', 'اسم الفئة بالإنجليزي مطلوب'),
        400
      );
    }
    
    if (!body.nameAr) {
      throw new AppError(
        this.getLangMessage(lang, 'Category name in Arabic is required', 'اسم الفئة بالعربي مطلوب'),
        400
      );
    }

    // التحقق من عدم وجود فئة بنفس الاسم
    const existingEn = await CategoryModel.findOne({ 
      nameEn: body.nameEn.trim(),
      isDeleted: false 
    });
    if (existingEn) {
      throw new AppError(
        this.getLangMessage(lang, 'Category with this English name already exists', 'يوجد فئة بهذا الاسم الإنجليزي'),
        400
      );
    }

    const existingAr = await CategoryModel.findOne({ 
      nameAr: body.nameAr.trim(),
      isDeleted: false 
    });
    if (existingAr) {
      throw new AppError(
        this.getLangMessage(lang, 'Category with this Arabic name already exists', 'يوجد فئة بهذا الاسم العربي'),
        400
      );
    }

    // تنسيق البيانات
    const categoryData = this.formatCategoryData(body);
    
    // إنشاء الـ slug
    categoryData.slug = body.slug 
      ? await this.generateUniqueSlug(body.slug)
      : await this.generateUniqueSlug(body.nameEn);

    // التحقق من الفئة الأب إذا وجدت
    if (categoryData.parentCategory) {
      const parentExists = await CategoryModel.findById(categoryData.parentCategory);
      if (!parentExists) {
        throw new AppError(
          this.getLangMessage(lang, 'Parent category not found', 'الفئة الأب غير موجودة'),
          404
        );
      }
    }

    // رفع الصورة
    if (file) {
      categoryData.image = await this.uploadImage(file);
    }

    // إنشاء الفئة
    const category = await CategoryModel.create(categoryData);
    await category.populate(this.populateOptions);

    return category;
  }

  // تحديث فئة
  async updateCategory(id, body, file, lang = 'en') {
    // البحث عن الفئة
    const category = await CategoryModel.findById(id);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }

    // التحقق من عدم تكرار الاسم
    if (body.nameEn && body.nameEn !== category.nameEn) {
      const existingEn = await CategoryModel.findOne({ 
        nameEn: body.nameEn.trim(),
        _id: { $ne: id },
        isDeleted: false 
      });
      if (existingEn) {
        throw new AppError(
          this.getLangMessage(lang, 'Category with this English name already exists', 'يوجد فئة بهذا الاسم الإنجليزي'),
          400
        );
      }
    }

    if (body.nameAr && body.nameAr !== category.nameAr) {
      const existingAr = await CategoryModel.findOne({ 
        nameAr: body.nameAr.trim(),
        _id: { $ne: id },
        isDeleted: false 
      });
      if (existingAr) {
        throw new AppError(
          this.getLangMessage(lang, 'Category with this Arabic name already exists', 'يوجد فئة بهذا الاسم العربي'),
          400
        );
      }
    }

    // تنسيق البيانات
    const updateData = this.formatCategoryData(body);

    // التحقق من الفئة الأب
    if (updateData.parentCategory) {
      // لا يمكن أن تكون الفئة هي نفسها الأب
      if (updateData.parentCategory === id) {
        throw new AppError(
          this.getLangMessage(lang, 'Category cannot be its own parent', 'لا يمكن أن تكون الفئة هي نفسها الأب'),
          400
        );
      }
      
      const parentExists = await CategoryModel.findById(updateData.parentCategory);
      if (!parentExists) {
        throw new AppError(
          this.getLangMessage(lang, 'Parent category not found', 'الفئة الأب غير موجودة'),
          404
        );
      }
    }

    // رفع الصورة الجديدة
    if (file) {
      // حذف الصورة القديمة
      if (category.image) {
        await this.deleteImage(category.image);
      }
      updateData.image = await this.uploadImage(file);
    }

    // تحديث الفئة
    Object.assign(category, updateData);
    await category.save();
    await category.populate(this.populateOptions);

    return category;
  }

  // حذف فئة (Soft Delete)
  async deleteCategory(id, lang = 'en') {
    const category = await CategoryModel.findById(id);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }

    // التحقق من وجود فئات فرعية
    const hasSubcategories = await CategoryModel.exists({ 
      parentCategory: id, 
      isDeleted: false 
    });
    
    if (hasSubcategories) {
      throw new AppError(
        this.getLangMessage(lang, 'Cannot delete category with subcategories', 'لا يمكن حذف فئة لها فئات فرعية'),
        400
      );
    }

    category.isDeleted = true;
    await category.save();
    
    return category;
  }

  // حذف فئة نهائياً (Hard Delete)
  async hardDeleteCategory(id, lang = 'en') {
    const category = await CategoryModel.findById(id);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }

    // حذف الصورة
    if (category.image) {
      await this.deleteImage(category.image);
    }

    await CategoryModel.deleteOne({ _id: id });
    
    return { 
      message: this.getLangMessage(lang, 'Category permanently deleted', 'تم حذف الفئة نهائياً') 
    };
  }

  // ==================== Image Operations ====================

  // رفع/تحديث صورة الفئة
  async uploadCategoryImage(id, file, lang = 'en') {
    if (!file) {
      throw new AppError(
        this.getLangMessage(lang, 'No image provided', 'لم يتم توفير صورة'),
        400
      );
    }

    const category = await CategoryModel.findById(id);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }

    // حذف الصورة القديمة
    if (category.image) {
      await this.deleteImage(category.image);
    }

    // رفع الصورة الجديدة
    category.image = await this.uploadImage(file);
    await category.save();
    await category.populate(this.populateOptions);

    return category;
  }

  // حذف صورة الفئة
  async deleteCategoryImage(id, lang = 'en') {
    const category = await CategoryModel.findById(id);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }

    if (category.image) {
      await this.deleteImage(category.image);
      category.image = null;
      await category.save();
    }

    return category;
  }

  // ==================== Search & Filter ====================

  // البحث عن الفئات
  async searchCategories(searchQuery, lang = 'en') {
    if (!searchQuery || searchQuery.trim() === '') {
      throw new AppError(
        this.getLangMessage(lang, 'Search query is required', 'كلمة البحث مطلوبة'),
        400
      );
    }

    const categories = await CategoryModel.find({
      isDeleted: false,
      $or: [
        { nameEn: { $regex: searchQuery, $options: 'i' } },
        { nameAr: { $regex: searchQuery, $options: 'i' } },
        { descriptionEn: { $regex: searchQuery, $options: 'i' } },
        { descriptionAr: { $regex: searchQuery, $options: 'i' } }
      ]
    })
    .sort({ order: 1 })
    .populate(this.populateOptions);

    return categories;
  }

  // ==================== Statistics ====================

  // عدد الفئات
  async getCategoriesCount() {
    const total = await CategoryModel.countDocuments({ isDeleted: false });
    const active = await CategoryModel.countDocuments({ isDeleted: false, status: true });
    const inactive = await CategoryModel.countDocuments({ isDeleted: false, status: false });
    const main = await CategoryModel.countDocuments({ isDeleted: false, parentCategory: null });
    const sub = await CategoryModel.countDocuments({ isDeleted: false, parentCategory: { $ne: null } });

    return { total, active, inactive, main, sub };
  }

  // تغيير ترتيب الفئات
  async reorderCategories(orderedIds, lang = 'en') {
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index } }
      }
    }));

    await CategoryModel.bulkWrite(bulkOps);
    
    return { 
      message: this.getLangMessage(lang, 'Categories reordered successfully', 'تم إعادة ترتيب الفئات بنجاح') 
    };
  }

  // تغيير حالة الفئة
  async toggleCategoryStatus(id, lang = 'en') {
    const category = await CategoryModel.findById(id);
    
    if (!category) {
      throw new AppError(
        this.getLangMessage(lang, 'Category not found', 'الفئة غير موجودة'),
        404
      );
    }

    category.status = !category.status;
    await category.save();

    return category;
  }
}

module.exports = new CategoryService();