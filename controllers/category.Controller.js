
const CategoryService = require('../services/category.service');
const AppError = require('../utils/AppError');

class CategoryController {
  // Helper للحصول على اللغة من الطلب
  static getLang(req) {
    return req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
           req.query.lang || 
           'en';
  }

  // Helper للاستجابة الناجحة
  static successResponse(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...data
    });
  }

  // ==================== Query Methods ====================

  // الحصول على جميع الفئات
  async getAllCategories(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const categories = await CategoryService.getAllCategories(lang);
      
      return CategoryController.successResponse(res, { 
        data: categories,
        count: categories.length
      }, lang === 'ar' ? 'تم جلب الفئات بنجاح' : 'Categories fetched successfully');
    } catch (error) {
      console.error('Error fetching categories:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get categories', 500));
    }
  }

  // الحصول على الفئات مع Pagination
  async getCategories(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { result, keys } = await CategoryService.getCategories(req.query, lang);
      
      return CategoryController.successResponse(res, { 
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          perPage: result.perPage,
          totalPages: result.totalPages
        },
        keys
      }, lang === 'ar' ? 'تم جلب الفئات بنجاح' : 'Categories fetched successfully');
    } catch (error) {
      console.error('Error fetching categories:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get categories', 500));
    }
  }

  // الحصول على الفئات النشطة فقط
  async getActiveCategories(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const categories = await CategoryService.getActiveCategories(lang);
      
      return CategoryController.successResponse(res, { 
        data: categories,
        count: categories.length
      }, lang === 'ar' ? 'تم جلب الفئات النشطة بنجاح' : 'Active categories fetched successfully');
    } catch (error) {
      console.error('Error fetching active categories:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get active categories', 500));
    }
  }

  // الحصول على الفئات الرئيسية مع الفرعية
  async getMainCategoriesWithSubs(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const categories = await CategoryService.getMainCategoriesWithSubs(lang);
      
      return CategoryController.successResponse(res, { 
        data: categories,
        count: categories.length
      }, lang === 'ar' ? 'تم جلب الفئات الرئيسية بنجاح' : 'Main categories fetched successfully');
    } catch (error) {
      console.error('Error fetching main categories:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get main categories', 500));
    }
  }

  // الحصول على فئة بالـ ID
  async getCategoryById(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { id } = req.params;
      const category = await CategoryService.getCategoryById(id, lang);
      
      return CategoryController.successResponse(res, { 
        category 
      }, lang === 'ar' ? 'تم جلب الفئة بنجاح' : 'Category fetched successfully');
    } catch (error) {
      console.error('Error fetching category:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get category', 500));
    }
  }

  // الحصول على فئة بالـ Slug
  async getCategoryBySlug(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { slug } = req.params;
      const category = await CategoryService.getCategoryBySlug(slug, lang);
      
      return CategoryController.successResponse(res, { 
        category 
      }, lang === 'ar' ? 'تم جلب الفئة بنجاح' : 'Category fetched successfully');
    } catch (error) {
      console.error('Error fetching category:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get category', 500));
    }
  }

  // ==================== CRUD Methods ====================

  // إنشاء فئة جديدة
  async createCategory(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const category = await CategoryService.createCategory(req.body, req.file, lang);
      
      return CategoryController.successResponse(res, { 
        category 
      }, lang === 'ar' ? 'تم إنشاء الفئة بنجاح' : 'Category created successfully', 201);
    } catch (error) {
      console.error('Error creating category:', error);
      next(error instanceof AppError ? error : new AppError('Failed to create category', 500));
    }
  }

  // تحديث فئة
  async updateCategory(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { id } = req.params;
      const category = await CategoryService.updateCategory(id, req.body, req.file, lang);
      
      return CategoryController.successResponse(res, { 
        category 
      }, lang === 'ar' ? 'تم تحديث الفئة بنجاح' : 'Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update category', 500));
    }
  }

  // حذف فئة (Soft Delete)
  async deleteCategory(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { id } = req.params;
      await CategoryService.deleteCategory(id, lang);
      
      return CategoryController.successResponse(res, {}, 
        lang === 'ar' ? 'تم حذف الفئة بنجاح' : 'Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      next(error instanceof AppError ? error : new AppError('Failed to delete category', 500));
    }
  }

  // حذف فئة نهائياً (Hard Delete)
  async hardDeleteCategory(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { id } = req.params;
      const result = await CategoryService.hardDeleteCategory(id, lang);
      
      return CategoryController.successResponse(res, result, result.message);
    } catch (error) {
      console.error('Error deleting category:', error);
      next(error instanceof AppError ? error : new AppError('Failed to delete category', 500));
    }
  }

  // ==================== Image Methods ====================

  // رفع صورة الفئة
  async uploadCategoryImage(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { id } = req.params;
      const category = await CategoryService.uploadCategoryImage(id, req.file, lang);
      
      return CategoryController.successResponse(res, { 
        category 
      }, lang === 'ar' ? 'تم رفع صورة الفئة بنجاح' : 'Category image uploaded successfully');
    } catch (error) {
      console.error('Error uploading category image:', error);
      next(error instanceof AppError ? error : new AppError('Failed to upload category image', 500));
    }
  }

  // حذف صورة الفئة
  async deleteCategoryImage(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { id } = req.params;
      const category = await CategoryService.deleteCategoryImage(id, lang);
      
      return CategoryController.successResponse(res, { 
        category 
      }, lang === 'ar' ? 'تم حذف صورة الفئة بنجاح' : 'Category image deleted successfully');
    } catch (error) {
      console.error('Error deleting category image:', error);
      next(error instanceof AppError ? error : new AppError('Failed to delete category image', 500));
    }
  }

  // ==================== Search & Other Methods ====================

  // البحث عن الفئات
  async searchCategories(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { query } = req.query;
      const categories = await CategoryService.searchCategories(query, lang);
      
      return CategoryController.successResponse(res, { 
        data: categories,
        count: categories.length
      }, categories.length > 0 
        ? (lang === 'ar' ? 'تم العثور على فئات' : 'Categories found')
        : (lang === 'ar' ? 'لم يتم العثور على فئات' : 'No categories found'));
    } catch (error) {
      console.error('Error searching categories:', error);
      next(error instanceof AppError ? error : new AppError('Failed to search categories', 500));
    }
  }

  // عدد الفئات
  async getCategoriesCount(req, res, next) {
    try {
      const counts = await CategoryService.getCategoriesCount();
      
      return CategoryController.successResponse(res, { counts });
    } catch (error) {
      console.error('Error counting categories:', error);
      next(error instanceof AppError ? error : new AppError('Failed to count categories', 500));
    }
  }

  // إعادة ترتيب الفئات
  async reorderCategories(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { orderedIds } = req.body;
      
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return next(new AppError(
          lang === 'ar' ? 'يجب توفير قائمة معرفات الفئات' : 'Ordered IDs array is required',
          400
        ));
      }
      
      const result = await CategoryService.reorderCategories(orderedIds, lang);
      
      return CategoryController.successResponse(res, result, result.message);
    } catch (error) {
      console.error('Error reordering categories:', error);
      next(error instanceof AppError ? error : new AppError('Failed to reorder categories', 500));
    }
  }

  // تغيير حالة الفئة
  async toggleCategoryStatus(req, res, next) {
    try {
      const lang = CategoryController.getLang(req);
      const { id } = req.params;
      const category = await CategoryService.toggleCategoryStatus(id, lang);
      
      return CategoryController.successResponse(res, { 
        category 
      }, lang === 'ar' ? 'تم تغيير حالة الفئة بنجاح' : 'Category status toggled successfully');
    } catch (error) {
      console.error('Error toggling category status:', error);
      next(error instanceof AppError ? error : new AppError('Failed to toggle category status', 500));
    }
  }
}

module.exports = new CategoryController();