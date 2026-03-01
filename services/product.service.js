// services/productService.js
const MongooseFeatures = require('./mongodb/features/index');
const AppError = require('../utils/AppError');
const ProductModel = require('../models/productModel');
const CategoryModel = require('../models/categoryModel');
const { pick } = require('lodash');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

class ProductService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = [
      'productNameEn',
      'productNameAr',
      'productDescriptionEn',
      'productDescriptionAr',
      'productPrice',
      'oldProductPrice',
      'productCategory',
      'productImage',
      'productImages',
      'productColorsEn',
      'productColorsAr',
      'productSizesEn',
      'productSizesAr',
      'productStatus',
      'productQuantity',
      'productCode',
      'productDiscount',
      'productDiscountPercentage',
      'productDiscountStartDate',
      'productDiscountEndDate',
      'NEW',
      'productSlug'
    ];
    
    this.populateOptions = [
      { path: 'productCategory', select: 'nameEn nameAr status' },
      { path: 'productReviews', select: 'rating comment user createdAt' }
    ];
  }

  // تنسيق البيانات الواردة
  formatProductData(body) {
    const data = {};
    
    // الحقول النصية
    if (body.productNameEn) data.productNameEn = body.productNameEn.trim();
    if (body.productNameAr) data.productNameAr = body.productNameAr.trim();
    if (body.productDescriptionEn) data.productDescriptionEn = body.productDescriptionEn.trim();
    if (body.productDescriptionAr) data.productDescriptionAr = body.productDescriptionAr.trim();
    
    // الحقول الرقمية
    if (body.productPrice !== undefined) data.productPrice = parseFloat(body.productPrice) || 0;
    if (body.oldProductPrice !== undefined) data.oldProductPrice = parseFloat(body.oldProductPrice) || 0;
    if (body.productQuantity !== undefined) data.productQuantity = parseInt(body.productQuantity) || 0;
    if (body.productDiscount !== undefined) data.productDiscount = parseFloat(body.productDiscount) || 0;
    if (body.productDiscountPercentage !== undefined) {
      data.productDiscountPercentage = parseFloat(body.productDiscountPercentage) || 0;
    }
    
    // الحقول المنطقية
    if (body.productStatus !== undefined) {
      data.productStatus = body.productStatus === 'true' || body.productStatus === true;
    }
    if (body.NEW !== undefined) {
      data.NEW = body.NEW === 'true' || body.NEW === true;
    }
    
    // التواريخ
    if (body.productDiscountStartDate) {
      data.productDiscountStartDate = new Date(body.productDiscountStartDate);
    }
    if (body.productDiscountEndDate) {
      data.productDiscountEndDate = new Date(body.productDiscountEndDate);
    }
    
    // المصفوفات (الألوان والمقاسات)
    if (body.productColorsEn) {
      data.productColorsEn = typeof body.productColorsEn === 'string' 
        ? JSON.parse(body.productColorsEn) 
        : body.productColorsEn;
    }
    if (body.productColorsAr) {
      data.productColorsAr = typeof body.productColorsAr === 'string' 
        ? JSON.parse(body.productColorsAr) 
        : body.productColorsAr;
    }
    if (body.productSizesEn) {
      data.productSizesEn = typeof body.productSizesEn === 'string' 
        ? JSON.parse(body.productSizesEn) 
        : body.productSizesEn;
    }
    if (body.productSizesAr) {
      data.productSizesAr = typeof body.productSizesAr === 'string' 
        ? JSON.parse(body.productSizesAr) 
        : body.productSizesAr;
    }
    
    // الحقول الأخرى
    if (body.productCategory) data.productCategory = body.productCategory;
    if (body.productCode) data.productCode = body.productCode;
    if (body.productSlug) data.productSlug = body.productSlug;
    
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
    
    while (await ProductModel.exists({ productSlug: slug })) {
      slug = `${baseSlug}-${counter++}`;
    }
    
    return slug;
  }

  // حساب بيانات الخصم
  calculateDiscountData(data) {
    const now = new Date();
    const discountPercentage = data.productDiscountPercentage || 0;
    const price = data.productPrice || 0;
    
    let hasActiveDiscount = false;
    let discountPrice = 0;
    
    if (discountPercentage > 0 && data.productDiscountStartDate && data.productDiscountEndDate) {
      hasActiveDiscount = now >= data.productDiscountStartDate && now <= data.productDiscountEndDate;
      if (hasActiveDiscount) {
        discountPrice = price - (price * (discountPercentage / 100));
      }
    }
    
    return {
      hasActiveDiscount,
      productDiscountPrice: discountPrice
    };
  }

  // حساب تاريخ انتهاء حالة الجديد
  calculateNewUntil(isNew) {
    if (isNew) {
      const date = new Date();
      date.setHours(date.getHours() + 24);
      return date;
    }
    return null;
  }

  // رفع الصور
  async uploadImages(files) {
    const result = {
      mainImage: null,
      additionalImages: []
    };
    
    if (!files || files.length === 0) return result;
    
    // الصورة الرئيسية
    const mainImageFile = files.find(f => f.fieldname === 'productImage');
    if (mainImageFile) {
      const uploadResult = await uploadToCloudinary(mainImageFile.buffer, 'products');
      result.mainImage = uploadResult.url;
    }
    
    // الصور الإضافية
    const additionalImageFiles = files.filter(f => f.fieldname === 'productImages');
    if (additionalImageFiles.length > 0) {
      const uploadResults = await Promise.all(
        additionalImageFiles.map(img => uploadToCloudinary(img.buffer, 'products'))
      );
      result.additionalImages = uploadResults.map(r => r.url);
    }
    
    return result;
  }

  // حذف الصور من Cloudinary
  async deleteImages(images) {
    if (!Array.isArray(images) || images.length === 0) return;
    
    await Promise.all(images.map(async (image) => {
      try {
        const publicId = image.split('/').pop().split('.')[0];
        await deleteFromCloudinary(publicId, 'products');
      } catch (error) {
        console.error(`Failed to delete image ${image}:`, error);
      }
    }));
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع المنتجات مع Pagination
  async getProducts(query = {}, lang = 'en') {
    const { 
      perPage = 15, 
      page = 1, 
      sorts = [], 
      queries = [] 
    } = pick(query, ['perPage', 'page', 'sorts', 'queries']);

    // تحديث حالة المنتجات
    await ProductModel.updateNewAndDiscountStatus();

    const result = await this.PaginateHandler(
      ProductModel, 
      Number(perPage), 
      Number(page), 
      sorts, 
      queries
    );

    if (result.data && result.data.length > 0) {
      await ProductModel.populate(result.data, this.populateOptions);
    }

    return {
      result,
      keys: this.allowedKeys
    };
  }

  // الحصول على منتج واحد بالـ ID
  async getProductById(id, lang = 'en') {
    const product = await ProductModel.findById(id)
      .populate(this.populateOptions);
    
    if (!product) {
      throw new AppError(
        lang === 'ar' ? 'المنتج غير موجود' : 'Product not found', 
        404
      );
    }
    
    return product;
  }

  // الحصول على منتج بالـ Slug
  async getProductBySlug(slug, lang = 'en') {
    const product = await ProductModel.findOne({ productSlug: slug })
      .populate(this.populateOptions);
    
    if (!product) {
      throw new AppError(
        lang === 'ar' ? 'المنتج غير موجود' : 'Product not found', 
        404
      );
    }
    
    return product;
  }

  // إنشاء منتج جديد
  async createProduct(body, files, lang = 'en') {
    // التحقق من الحقول المطلوبة
    const requiredFields = {
      productNameEn: lang === 'ar' ? 'اسم المنتج بالإنجليزي مطلوب' : 'Product name in English is required',
      productNameAr: lang === 'ar' ? 'اسم المنتج بالعربي مطلوب' : 'Product name in Arabic is required',
      productDescriptionEn: lang === 'ar' ? 'وصف المنتج بالإنجليزي مطلوب' : 'Product description in English is required',
      productDescriptionAr: lang === 'ar' ? 'وصف المنتج بالعربي مطلوب' : 'Product description in Arabic is required',
      productPrice: lang === 'ar' ? 'سعر المنتج مطلوب' : 'Product price is required',
      productCategory: lang === 'ar' ? 'تصنيف المنتج مطلوب' : 'Product category is required'
    };

    for (const [field, message] of Object.entries(requiredFields)) {
      if (!body[field]) {
        throw new AppError(message, 400);
      }
    }

    // التحقق من وجود التصنيف
    const category = await CategoryModel.findById(body.productCategory);
    if (!category) {
      throw new AppError(
        lang === 'ar' ? 'التصنيف غير موجود' : 'Category not found',
        404
      );
    }

    // تنسيق البيانات
    const productData = this.formatProductData(body);
    
    // إنشاء الـ slug
    productData.productSlug = await this.generateUniqueSlug(body.productNameEn);
    
    // حساب بيانات الخصم
    const discountData = this.calculateDiscountData(productData);
    productData.hasActiveDiscount = discountData.hasActiveDiscount;
    productData.productDiscountPrice = discountData.productDiscountPrice;
    
    // حساب تاريخ انتهاء حالة الجديد
    if (productData.NEW) {
      productData.newUntil = this.calculateNewUntil(true);
    }

    // رفع الصور
    if (!files || files.length === 0) {
      throw new AppError(
        lang === 'ar' ? 'صورة المنتج مطلوبة' : 'Product image is required',
        400
      );
    }
    
    const uploadedImages = await this.uploadImages(files);
    
    if (!uploadedImages.mainImage) {
      throw new AppError(
        lang === 'ar' ? 'الصورة الرئيسية للمنتج مطلوبة' : 'Main product image is required',
        400
      );
    }
    
    productData.productImage = uploadedImages.mainImage;
    productData.productImages = uploadedImages.additionalImages;

    // إنشاء المنتج
    const product = await ProductModel.create(productData);
    await product.populate(this.populateOptions);

    return product;
  }

  // تحديث منتج
  async updateProduct(identifier, body, files, isSlug = false, lang = 'en') {
    // البحث عن المنتج
    const query = isSlug ? { productSlug: identifier } : { _id: identifier };
    const product = await ProductModel.findOne(query);
    
    if (!product) {
      throw new AppError(
        lang === 'ar' ? 'المنتج غير موجود' : 'Product not found',
        404
      );
    }

    // التحقق من التصنيف إذا تم تغييره
    if (body.productCategory && body.productCategory !== product.productCategory?.toString()) {
      const category = await CategoryModel.findById(body.productCategory);
      if (!category) {
        throw new AppError(
          lang === 'ar' ? 'التصنيف غير موجود' : 'Category not found',
          404
        );
      }
    }

    // تنسيق البيانات
    const updateData = this.formatProductData(body);

    // حذف الصور القديمة إذا طلب ذلك
    if (body.deletedImages) {
      const imagesToDelete = typeof body.deletedImages === 'string' 
        ? JSON.parse(body.deletedImages) 
        : body.deletedImages;
      
      if (Array.isArray(imagesToDelete) && imagesToDelete.length > 0) {
        await this.deleteImages(imagesToDelete);
        product.productImages = product.productImages.filter(
          img => !imagesToDelete.includes(img)
        );
      }
    }

    // رفع الصور الجديدة
    if (files && files.length > 0) {
      const uploadedImages = await this.uploadImages(files);
      
      if (uploadedImages.mainImage) {
        updateData.productImage = uploadedImages.mainImage;
      }
      
      if (uploadedImages.additionalImages.length > 0) {
        updateData.productImages = [
          ...product.productImages,
          ...uploadedImages.additionalImages
        ];
      }
    }

    // تحديث حالة الخصم
    if (updateData.productPrice || updateData.productDiscountPercentage !== undefined) {
      const priceForCalc = updateData.productPrice || product.productPrice;
      const discountForCalc = updateData.productDiscountPercentage ?? product.productDiscountPercentage;
      const startDateForCalc = updateData.productDiscountStartDate || product.productDiscountStartDate;
      const endDateForCalc = updateData.productDiscountEndDate || product.productDiscountEndDate;
      
      const discountData = this.calculateDiscountData({
        productPrice: priceForCalc,
        productDiscountPercentage: discountForCalc,
        productDiscountStartDate: startDateForCalc,
        productDiscountEndDate: endDateForCalc
      });
      
      updateData.hasActiveDiscount = discountData.hasActiveDiscount;
      updateData.productDiscountPrice = discountData.productDiscountPrice;
    }

    // تحديث حالة المنتج الجديد
    if (updateData.NEW !== undefined) {
      if (updateData.NEW && !product.NEW) {
        updateData.newUntil = this.calculateNewUntil(true);
      } else if (!updateData.NEW) {
        updateData.newUntil = null;
      }
    }

    // تحديث المنتج
    Object.assign(product, updateData);
    await product.save();
    await product.populate(this.populateOptions);

    return product;
  }

  // حذف منتج (Soft Delete)
  async deleteProduct(identifier, isSlug = false, lang = 'en') {
    const query = isSlug ? { productSlug: identifier } : { _id: identifier };
    const product = await ProductModel.findOneAndUpdate(
      query,
      { isDeleted: true },
      { new: true }
    );
    
    if (!product) {
      throw new AppError(
        lang === 'ar' ? 'المنتج غير موجود' : 'Product not found',
        404
      );
    }
    
    return product;
  }

  // حذف منتج نهائياً (Hard Delete)
  async hardDeleteProduct(identifier, isSlug = false, lang = 'en') {
    const query = isSlug ? { productSlug: identifier } : { _id: identifier };
    const product = await ProductModel.findOne(query);
    
    if (!product) {
      throw new AppError(
        lang === 'ar' ? 'المنتج غير موجود' : 'Product not found',
        404
      );
    }
    
    // حذف الصور
    if (product.productImage) {
      await this.deleteImages([product.productImage]);
    }
    if (product.productImages && product.productImages.length > 0) {
      await this.deleteImages(product.productImages);
    }
    
    await ProductModel.deleteOne(query);
    
    return { message: lang === 'ar' ? 'تم حذف المنتج نهائياً' : 'Product permanently deleted' };
  }

  // ==================== Query Operations ====================

  // الحصول على جميع المنتجات
  async getAllProducts(lang = 'en') {
    await ProductModel.updateNewAndDiscountStatus();
    
    const products = await ProductModel.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .populate(this.populateOptions);
    
    return products;
  }

  // الحصول على المنتجات الجديدة
  async getNewProducts(lang = 'en') {
    await ProductModel.updateNewAndDiscountStatus();
    
    const products = await ProductModel.find({ 
      isDeleted: false,
      NEW: true
    })
    .sort({ createdAt: -1 })
    .populate(this.populateOptions);
    
    return products;
  }

  // الحصول على المنتجات المخفضة
  async getDiscountedProducts(lang = 'en') {
    await ProductModel.updateNewAndDiscountStatus();
    
    const products = await ProductModel.find({ 
      isDeleted: false,
      hasActiveDiscount: true
    })
    .sort({ productDiscountEndDate: 1 })
    .populate(this.populateOptions);
    
    // حساب معلومات الخصم
    let discountInfo = null;
    if (products.length > 0) {
      const now = new Date();
      const productWithLongestRemaining = products.reduce((longest, product) => {
        const endDate = new Date(product.productDiscountEndDate);
        const remainingTime = endDate.getTime() - now.getTime();
        if (!longest || remainingTime > (new Date(longest.productDiscountEndDate).getTime() - now.getTime())) {
          return product;
        }
        return longest;
      }, null);
      
      if (productWithLongestRemaining) {
        const startDate = new Date(productWithLongestRemaining.productDiscountStartDate);
        const endDate = new Date(productWithLongestRemaining.productDiscountEndDate);
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsedDuration = Math.max(0, Math.min(now.getTime() - startDate.getTime(), totalDuration));
        
        discountInfo = {
          longestExpiryDate: endDate,
          discountProgress: {
            totalDuration,
            elapsedDuration,
            percentComplete: totalDuration > 0 ? Math.round((elapsedDuration / totalDuration) * 100) : 0
          }
        };
      }
    }
    
    return { products, discountInfo };
  }

  // الحصول على أفضل المنتجات مبيعاً
  async getBestSellingProducts(limit = 8, lang = 'en') {
    await ProductModel.updateNewAndDiscountStatus();
    
    const products = await ProductModel.find({ 
      isDeleted: false,
      productStatus: true
    })
    .sort({ productRating: -1 })
    .limit(limit)
    .populate(this.populateOptions);
    
    return products;
  }

  // الحصول على المنتجات حسب التصنيف
  async getProductsByCategory(categoryId, lang = 'en') {
    const products = await ProductModel.find({ 
      productCategory: categoryId,
      isDeleted: false 
    })
    .sort({ createdAt: -1 })
    .populate(this.populateOptions);
    
    return products;
  }

  // البحث عن المنتجات
  async searchProducts(searchQuery, options = {}, lang = 'en') {
    const { page = 1, limit = 12 } = options;
    const skip = (page - 1) * limit;
    
    if (!searchQuery || searchQuery.trim() === '') {
      throw new AppError(
        lang === 'ar' ? 'كلمة البحث مطلوبة' : 'Search query is required',
        400
      );
    }
    
    const trimmedQuery = searchQuery.trim();
    
    // البحث في الاسم العربي والإنجليزي
    const searchFilter = {
      isDeleted: false,
      $or: [
        { productNameEn: { $regex: trimmedQuery, $options: 'i' } },
        { productNameAr: { $regex: trimmedQuery, $options: 'i' } },
        { productDescriptionEn: { $regex: trimmedQuery, $options: 'i' } },
        { productDescriptionAr: { $regex: trimmedQuery, $options: 'i' } }
      ]
    };
    
    const total = await ProductModel.countDocuments(searchFilter);
    const products = await ProductModel.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(this.populateOptions);
    
    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // فلترة المنتجات
  async filterProducts(filters, options = {}, lang = 'en') {
    const { page = 1, limit = 12, sort = 'newest' } = options;
    const skip = (page - 1) * limit;
    
    const filter = { isDeleted: false };
    
    // فلترة حسب التصنيف
    if (filters.category) {
      filter.productCategory = filters.category;
    }
    if (filters.categories) {
      filter.productCategory = { $in: filters.categories.split(',') };
    }
    
    // فلترة حسب السعر
    if (filters.minPrice || filters.maxPrice) {
      filter.productPrice = {};
      if (filters.minPrice) filter.productPrice.$gte = parseFloat(filters.minPrice);
      if (filters.maxPrice) filter.productPrice.$lte = parseFloat(filters.maxPrice);
    }
    
    // فلترة حسب البحث (العربي والإنجليزي)
    if (filters.search && filters.search.trim() !== '') {
      filter.$or = [
        { productNameEn: { $regex: filters.search, $options: 'i' } },
        { productNameAr: { $regex: filters.search, $options: 'i' } },
        { productDescriptionEn: { $regex: filters.search, $options: 'i' } },
        { productDescriptionAr: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    // فلترة حسب الألوان
    if (filters.colors) {
      const colorList = filters.colors.split(',');
      filter.$or = [
        { productColorsEn: { $in: colorList } },
        { productColorsAr: { $in: colorList } }
      ];
    }
    
    // فلترة حسب المقاسات
    if (filters.sizes) {
      const sizeList = filters.sizes.split(',');
      filter.$or = [
        { productSizesEn: { $in: sizeList } },
        { productSizesAr: { $in: sizeList } }
      ];
    }
    
    // فلترة حسب الخصم
    if (filters.discount === 'true') {
      filter.hasActiveDiscount = true;
    }
    
    // فلترة حسب الجديد
    if (filters.new === 'true') {
      filter.NEW = true;
    }
    
    // فلترة حسب التوفر
    if (filters.inStock === 'true') {
      filter.productQuantity = { $gt: 0 };
    }
    
    // تحديد الترتيب
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'price-asc': sortOption = { productPrice: 1 }; break;
      case 'price-desc': sortOption = { productPrice: -1 }; break;
      case 'name-asc': sortOption = { productNameEn: 1 }; break;
      case 'name-desc': sortOption = { productNameEn: -1 }; break;
      case 'discount': sortOption = { productDiscountPercentage: -1 }; break;
      case 'rating': sortOption = { productRating: -1 }; break;
    }
    
    const total = await ProductModel.countDocuments(filter);
    const products = await ProductModel.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate(this.populateOptions);
    
    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // الحصول على الفلاتر المتاحة
  async getAvailableFilters(lang = 'en') {
    const [colorsEn, colorsAr, sizesEn, sizesAr, priceRange, categories, counts] = await Promise.all([
      ProductModel.distinct('productColorsEn', { isDeleted: false }),
      ProductModel.distinct('productColorsAr', { isDeleted: false }),
      ProductModel.distinct('productSizesEn', { isDeleted: false }),
      ProductModel.distinct('productSizesAr', { isDeleted: false }),
      ProductModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: null, minPrice: { $min: '$productPrice' }, maxPrice: { $max: '$productPrice' } } }
      ]),
      ProductModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$productCategory', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categoryInfo' } },
        { $project: { _id: 1, count: 1, nameEn: { $arrayElemAt: ['$categoryInfo.nameEn', 0] }, nameAr: { $arrayElemAt: ['$categoryInfo.nameAr', 0] } } },
        { $sort: { count: -1 } }
      ]),
      ProductModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            newProducts: { $sum: { $cond: ['$NEW', 1, 0] } },
            discountedProducts: { $sum: { $cond: ['$hasActiveDiscount', 1, 0] } },
            inStock: { $sum: { $cond: [{ $gt: ['$productQuantity', 0] }, 1, 0] } }
          }
        }
      ])
    ]);
    
    return {
      colors: { en: colorsEn.filter(Boolean), ar: colorsAr.filter(Boolean) },
      sizes: { en: sizesEn.filter(Boolean), ar: sizesAr.filter(Boolean) },
      priceRange: priceRange.length > 0 ? { min: priceRange[0].minPrice || 0, max: priceRange[0].maxPrice || 0 } : { min: 0, max: 0 },
      categories,
      counts: counts.length > 0 ? counts[0] : { total: 0, newProducts: 0, discountedProducts: 0, inStock: 0 }
    };
  }

  // عدد المنتجات
  async getProductsCount() {
    return await ProductModel.countDocuments({ isDeleted: false });
  }

  // تحديث حالة المنتجات
  async updateProductStatuses() {
    await ProductModel.updateNewAndDiscountStatus();
    return { message: 'Product statuses updated successfully' };
  }

  // إعادة تعيين الخصومات المنتهية
  async resetExpiredDiscounts() {
    const now = new Date();
    const result = await ProductModel.updateMany(
      { productDiscountEndDate: { $lt: now }, hasActiveDiscount: true },
      { $set: { hasActiveDiscount: false, productDiscountPrice: 0, productDiscountPercentage: 0 } }
    );
    return { count: result.modifiedCount };
  }

  // تحديث مستويات الخصم بشكل جماعي
  async bulkUpdateDiscountTiers(discountData = []) {
    const results = { success: [], failed: [] };
    
    for (const item of discountData) {
      try {
        const { productCode, discountTiers } = item;
        if (!productCode) throw new Error('productCode required');
        
        const formatted = Array.isArray(discountTiers) 
          ? discountTiers.map(t => ({
              quantity: Number(t.quantity),
              discount: Number(t.discount),
              code: productCode
            }))
          : [];
        
        await ProductModel.findOneAndUpdate(
          { productCode },
          { $set: { discountTiers: formatted } },
          { new: true }
        );
        
        results.success.push(productCode);
      } catch (err) {
        results.failed.push({ productCode: item.productCode, error: err.message });
      }
    }
    
    return results;
  }

  // تصدير المنتجات
  async exportProducts(query = {}, lang = 'en') {
    const { perPage = 999999, page = 1, sorts = [], queries = [] } = query;
    
    const result = await this.PaginateHandler(
      ProductModel,
      Number(perPage),
      Number(page),
      sorts,
      queries
    );

    if (result.data && result.data.length > 0) {
      await ProductModel.populate(result.data, this.populateOptions);
    }

    return result.data.map(p => ({
      productNameEn: p.productNameEn || '',
      productNameAr: p.productNameAr || '',
      productDescriptionEn: p.productDescriptionEn || '',
      productDescriptionAr: p.productDescriptionAr || '',
      productPrice: p.productPrice || 0,
      productCategoryId: p.productCategory?._id || '',
      productCategoryNameEn: p.productCategory?.nameEn || '',
      productCategoryNameAr: p.productCategory?.nameAr || '',
      productStatus: p.productStatus || false,
      productDiscount: p.productDiscount || 0,
      productDiscountPercentage: p.productDiscountPercentage || 0,
      hasActiveDiscount: p.hasActiveDiscount || false,
      createdAt: p.createdAt || null,
      updatedAt: p.updatedAt || null
    }));
  }
}

module.exports = new ProductService();