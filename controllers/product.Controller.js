// controllers/productController.js
const ProductService = require('../services/product.service');
const AppError = require('../utils/AppError');

class ProductController {
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

  // تحديث حالة المنتجات
  async updateProductStatuses(req, res, next) {
    try {
      const result = await ProductService.updateProductStatuses();
      return ProductController.successResponse(res, result, 'Product statuses updated successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to update product statuses', 500));
    }
  }

  // الحصول على جميع المنتجات
  async getAllProducts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const products = await ProductService.getAllProducts(lang);
      
      return ProductController.successResponse(res, { 
        data: products,
        count: products.length
      }, lang === 'ar' ? 'تم جلب المنتجات بنجاح' : 'Products fetched successfully');
    } catch (error) {
      console.error("Error fetching products:", error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch products', 500));
    }
  }

  // الحصول على منتج بالـ Slug (يدعم اسم الـ route القديم)
  async getProductBySlug(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { slug } = req.params;
      const product = await ProductService.getProductBySlug(slug, lang);
      
      return ProductController.successResponse(res, { 
        data: product 
      }, lang === 'ar' ? 'تم جلب المنتج بنجاح' : 'Product fetched successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to fetch product', 500));
    }
  }

  // Alias للتوافق مع الكود القديم
  async getSingleProduct(req, res, next) {
    return this.getProductBySlug(req, res, next);
  }

  // الحصول على منتج بالـ ID
  async getProductById(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { id } = req.params;
      const product = await ProductService.getProductById(id, lang);
      
      return ProductController.successResponse(res, { 
        data: product 
      }, lang === 'ar' ? 'تم جلب المنتج بنجاح' : 'Product fetched successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to fetch product', 500));
    }
  }

  // ==================== CRUD Methods ====================

  // إنشاء منتج جديد
  async createProduct(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const product = await ProductService.createProduct(req.body, req.files, lang);
      
      return ProductController.successResponse(res, { 
        data: product 
      }, lang === 'ar' ? 'تم إنشاء المنتج بنجاح' : 'Product created successfully', 201);
    } catch (error) {
      console.error('Error creating product:', error);
      next(error instanceof AppError ? error : new AppError('Failed to create product', 500));
    }
  }

  // تعديل منتج بالـ Slug (يدعم اسم الـ route القديم)
  async editProduct(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { slug } = req.params;
      const product = await ProductService.updateProduct(slug, req.body, req.files, true, lang);
      
      return ProductController.successResponse(res, { 
        data: product 
      }, lang === 'ar' ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully');
    } catch (error) {
      console.error('Error updating product:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update product', 500));
    }
  }

  // Alias للتوافق
  async editProductBySlug(req, res, next) {
    return this.editProduct(req, res, next);
  }

  // تعديل منتج بالـ ID
  async editProductById(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { id } = req.params;
      const product = await ProductService.updateProduct(id, req.body, req.files, false, lang);
      
      return ProductController.successResponse(res, { 
        data: product 
      }, lang === 'ar' ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully');
    } catch (error) {
      console.error('Error updating product:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update product', 500));
    }
  }

  // حذف منتج بالـ Slug (يدعم اسم الـ route القديم)
  async deleteProduct(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { slug } = req.params;
      const product = await ProductService.deleteProduct(slug, true, lang);
      
      return ProductController.successResponse(res, { 
        product 
      }, lang === 'ar' ? 'تم حذف المنتج بنجاح' : 'Product deleted successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to delete product', 500));
    }
  }

  // Alias للتوافق
  async deleteProductBySlug(req, res, next) {
    return this.deleteProduct(req, res, next);
  }

  // حذف منتج بالـ ID
  async deleteProductById(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { id } = req.params;
      const product = await ProductService.deleteProduct(id, false, lang);
      
      return ProductController.successResponse(res, { 
        product 
      }, lang === 'ar' ? 'تم حذف المنتج بنجاح' : 'Product deleted successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to delete product', 500));
    }
  }

  // حذف منتج نهائياً
  async hardDeleteProduct(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { id } = req.params;
      const result = await ProductService.hardDeleteProduct(id, false, lang);
      
      return ProductController.successResponse(res, result, 
        lang === 'ar' ? 'تم حذف المنتج نهائياً' : 'Product permanently deleted');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to delete product', 500));
    }
  }

  // ==================== Special Queries ====================

  // الحصول على المنتجات الجديدة
  async getNewProducts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const products = await ProductService.getNewProducts(lang);
      
      return ProductController.successResponse(res, { 
        data: products,
        count: products.length
      }, lang === 'ar' ? 'تم جلب المنتجات الجديدة بنجاح' : 'New products fetched successfully');
    } catch (error) {
      console.error("Error fetching new products:", error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch new products', 500));
    }
  }

  // الحصول على المنتجات المخفضة
  async getDiscountedProducts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { products, discountInfo } = await ProductService.getDiscountedProducts(lang);
      
      return ProductController.successResponse(res, { 
        data: products,
        count: products.length,
        longestExpiryDate: discountInfo?.longestExpiryDate || null,
        discountProgress: discountInfo?.discountProgress || null
      }, lang === 'ar' ? 'تم جلب المنتجات المخفضة بنجاح' : 'Discounted products fetched successfully');
    } catch (error) {
      console.error("Error fetching discounted products:", error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch discounted products', 500));
    }
  }

  // الحصول على أفضل المنتجات مبيعاً
  async getBestSellingProducts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const limit = parseInt(req.query.limit) || 8;
      const products = await ProductService.getBestSellingProducts(limit, lang);
      
      return ProductController.successResponse(res, { 
        data: products,
        count: products.length
      }, lang === 'ar' ? 'تم جلب أفضل المنتجات مبيعاً' : 'Best selling products fetched successfully');
    } catch (error) {
      console.error("Error fetching best selling products:", error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch best selling products', 500));
    }
  }

  // الحصول على المنتجات حسب التصنيف
  async getProductsByCategory(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { categoryId } = req.params;
      const products = await ProductService.getProductsByCategory(categoryId, lang);
      
      return ProductController.successResponse(res, { 
        products,
        count: products.length
      }, lang === 'ar' ? 'تم جلب المنتجات بنجاح' : 'Products fetched successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to fetch products', 500));
    }
  }

  // Alias للتوافق مع الكود القديم
  async getProductByCategory(req, res, next) {
    req.params.categoryId = req.params.slug;
    return this.getProductsByCategory(req, res, next);
  }

  // ==================== Search & Filter ====================

  // البحث عن المنتجات
  async searchProducts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { query, page, limit } = req.query;
      
      if (!query || query.trim() === '') {
        return next(new AppError(
          lang === 'ar' ? 'كلمة البحث مطلوبة' : 'Search query is required', 
          400
        ));
      }
      
      console.log("Search query received:", query);
      
      const result = await ProductService.searchProducts(query, { 
        page: parseInt(page) || 1, 
        limit: parseInt(limit) || 12 
      }, lang);
      
      console.log(`Search results: ${result.products.length} of ${result.pagination.total} total`);
      
      return ProductController.successResponse(res, { 
        data: result.products,
        pagination: result.pagination,
        noProduct: result.products.length === 0
      }, result.products.length > 0 
        ? (lang === 'ar' ? 'تم العثور على منتجات' : 'Products found')
        : (lang === 'ar' ? 'لم يتم العثور على منتجات' : 'No products found'));
    } catch (error) {
      console.error("Error searching products:", error);
      next(error instanceof AppError ? error : new AppError(`Failed to search products: ${error.message}`, 500));
    }
  }

  // Alias للتوافق مع الكود القديم
  async searchProduct(req, res, next) {
    return this.searchProducts(req, res, next);
  }

  // فلترة المنتجات
  async filterProducts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { 
        page = 1, 
        limit = 12, 
        sort = 'newest',
        category,
        categories,
        minPrice,
        maxPrice,
        colors,
        sizes,
        search,
        discount,
        new: isNew,
        inStock,
        rating
      } = req.query;
      
      console.log("Filter request received with params:", req.query);
      
      const filters = {
        category,
        categories,
        minPrice,
        maxPrice,
        colors,
        sizes,
        search,
        discount,
        new: isNew,
        inStock,
        rating
      };
      
      const result = await ProductService.filterProducts(
        filters, 
        { page: parseInt(page), limit: parseInt(limit), sort }, 
        lang
      );
      
      console.log(`Filtered products: ${result.products.length} of ${result.pagination.total} total`);
      
      return ProductController.successResponse(res, { 
        data: result.products,
        pagination: result.pagination,
        noProduct: result.products.length === 0
      }, result.products.length > 0 
        ? (lang === 'ar' ? 'تم فلترة المنتجات بنجاح' : 'Products filtered successfully')
        : (lang === 'ar' ? 'لم يتم العثور على منتجات' : 'No products found'));
    } catch (error) {
      console.error("Error filtering products:", error);
      next(error instanceof AppError ? error : new AppError('Failed to filter products', 500));
    }
  }

  // الحصول على الفلاتر المتاحة
  async getAvailableFilters(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const filters = await ProductService.getAvailableFilters(lang);
      
      return ProductController.successResponse(res, { 
        filters 
      }, lang === 'ar' ? 'تم جلب الفلاتر بنجاح' : 'Filters fetched successfully');
    } catch (error) {
      console.error("Error getting available filters:", error);
      next(error instanceof AppError ? error : new AppError('Failed to get available filters', 500));
    }
  }

  // ==================== Admin Methods ====================

  // عدد المنتجات
  async getProductsCount(req, res, next) {
    try {
      const count = await ProductService.getProductsCount();
      console.log(count);
      
      return ProductController.successResponse(res, { count });
    } catch (error) {
      console.error("Error counting products:", error);
      next(error instanceof AppError ? error : new AppError('Failed to count products', 500));
    }
  }

  // إعادة تعيين الخصومات المنتهية
  async resetExpiredDiscounts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const result = await ProductService.resetExpiredDiscounts();
      
      return ProductController.successResponse(res, result, 
        lang === 'ar' ? 'تم إعادة تعيين الخصومات المنتهية' : 'Expired discounts reset successfully');
    } catch (error) {
      console.error("Error resetting expired discounts:", error);
      next(error instanceof AppError ? error : new AppError('Failed to reset expired discounts', 500));
    }
  }

  // تحديث مستويات الخصم بشكل جماعي
  async bulkUpdateDiscountTiers(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { discountData } = req.body;
      const results = await ProductService.bulkUpdateDiscountTiers(discountData);
      
      return ProductController.successResponse(res, { results }, 
        lang === 'ar' ? 'تم تحديث مستويات الخصم' : 'Discount tiers updated');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to update discount tiers', 500));
    }
  }

  // تصدير المنتجات
  async exportProducts(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const data = await ProductService.exportProducts(req.query, lang);
      
      return ProductController.successResponse(res, { 
        data,
        count: data.length
      }, lang === 'ar' ? 'تم تصدير المنتجات بنجاح' : 'Products exported successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to export products', 500));
    }
  }

  // رفع صورة منتج (للتوافق مع الكود القديم)
  async uploadProductImage(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { productId } = req.params;
      
      if (!req.file) {
        return next(new AppError(
          lang === 'ar' ? 'لم يتم توفير صورة' : 'No image provided', 
          400
        ));
      }
      
      const product = await ProductService.updateProduct(
        productId, 
        {}, 
        [req.file], 
        false, 
        lang
      );
      
      return ProductController.successResponse(res, { 
        product 
      }, lang === 'ar' ? 'تم رفع صورة المنتج بنجاح' : 'Product image uploaded successfully');
    } catch (error) {
      console.error("Upload error:", error);
      next(error instanceof AppError ? error : new AppError('Failed to upload product image', 500));
    }
  }

  // الحصول على المنتجات حسب السعر (للتوافق مع الكود القديم)
  async getProductByPrice(req, res, next) {
    try {
      const lang = ProductController.getLang(req);
      const { price } = req.params;
      
      const result = await ProductService.filterProducts(
        { minPrice: price, maxPrice: price }, 
        {}, 
        lang
      );
      
      return ProductController.successResponse(res, { 
        products: result.products 
      }, lang === 'ar' ? 'تم جلب المنتجات بنجاح' : 'Products fetched successfully');
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Failed to fetch products', 500));
    }
  }
}

module.exports = new ProductController();