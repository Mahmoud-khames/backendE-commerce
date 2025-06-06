const fs = require("fs");
const path = require("path");
const Product = require("../models/productModel");
const AppError = require("../utils/AppError");
const { uploadToCloudinary, deleteFromCloudinary, uploadMultipleToCloudinary } = require("../utils/cloudinaryUpload");

class ProductController {
  // حذف الصور من Cloudinary
  static async deleteImages(images) {
    if (!Array.isArray(images)) return;

    await Promise.all(images.map(async (image) => {
      try {
        // استخراج معرف الصورة من URL
        const publicId = image.split('/').pop().split('.')[0];
        await deleteFromCloudinary(publicId, 'products');
      } catch (error) {
        console.error(`Failed to delete image ${image}:`, error);
      }
    }));
  }

  // تحديث حالة المنتجات الجديدة والخصومات
  async updateProductStatuses(req, res, next) {
    try {
      await Product.updateNewAndDiscountStatus();
      return res.status(200).json({
        success: true,
        message: "Product statuses updated successfully",
      });
    } catch (error) {
      console.error("Error updating product statuses:", error);
      next(new AppError("Failed to update product statuses", 500));
    }
  }

  async getAllProduct(req, res, next) {
    try {
      // تحديث حالة المنتجات قبل إرجاعها
      await Product.updateNewAndDiscountStatus();
      // product reviews
      const products = await Product.find({ isDeleted: false })
        .sort({ _id: -1 })
        .populate("productCategory", "name") // Remove the extra space after "productCategory"
        .populate("productReviews", "rating comment user createdAt"); // Add user and createdAt fields

      console.log("Fetched products count:", products.length);
      res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        data: products,
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      next(new AppError("Failed to fetch products", 500));
    }
  }

  async getSingleProduct(req, res, next) {
    try {
      const { slug } = req.params;
      const product = await Product.findOne({ productSlug: slug });
      if (!product) return next(new AppError("Product not found", 404));

      res.status(200).json({
        success: true,
        message: "Product fetched successfully",
        data: product,
      });
    } catch (error) {
      next(new AppError("Failed to fetch product", 500));
    }
  }

  async editProduct(req, res, next) {
    try {
      const { slug } = req.params;
      const {
        productName,
        productDescription,
        productPrice,
        oldProductPrice,
        productColors,
        productSizes,
        productCategory,
        productQuantity,
        productStatus,
        deletedImages = '[]',
        productDiscount,
        productDiscountPercentage,
        productDiscountStartDate,
        productDiscountEndDate,
        NEW,
      } = req.body;
  
      const product = await Product.findOne({ productSlug: slug });
      if (!product) return next(new AppError("Product not found", 404));
  
      // حذف الصور القديمة
      const imagesToDelete = JSON.parse(deletedImages);
      if (Array.isArray(imagesToDelete) && imagesToDelete.length > 0) {
        await ProductController.deleteImages(imagesToDelete);
        product.productImages = product.productImages.filter(
          (img) => !imagesToDelete.includes(img)
        );
      }
  
      // حساب الخصم
      const discountPercentage = parseFloat(productDiscountPercentage) || 0;
      const price = parseFloat(productPrice) || product.productPrice;
      const calculatedDiscountPrice =
        discountPercentage > 0 ? price - (price * (discountPercentage / 100)) : 0;
  
      const now = new Date();
      const discountStartDate = productDiscountStartDate
        ? new Date(productDiscountStartDate)
        : product.productDiscountStartDate;
  
      const discountEndDate = productDiscountEndDate
        ? new Date(productDiscountEndDate)
        : product.productDiscountEndDate;
  
      const hasActiveDiscount =
        discountPercentage > 0 &&
        discountStartDate &&
        discountEndDate &&
        now >= discountStartDate &&
        now <= discountEndDate;
  
      // تحديث حالة المنتج الجديد
      const isNew = NEW === "true" || NEW === true;
      const newUntil = isNew
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : product.newUntil;
  
      // تحديث خصائص المنتج الأساسية
      product.productName = productName || product.productName;
      product.productDescription = productDescription || product.productDescription;
      product.productPrice = price;
      product.oldProductPrice = oldProductPrice ? parseFloat(oldProductPrice) : product.oldProductPrice;
      product.productColors = productColors ? JSON.parse(productColors) : product.productColors;
      product.productSizes = productSizes ? JSON.parse(productSizes) : product.productSizes;
      product.productCategory = productCategory || product.productCategory;
      product.productQuantity = parseInt(productQuantity) || product.productQuantity;
      product.productStatus = productStatus === "true" || product.productStatus;
      product.productDiscount = productDiscount ? parseFloat(productDiscount) : product.productDiscount;
      product.productDiscountPrice = calculatedDiscountPrice;
      product.productDiscountPercentage = discountPercentage;
      product.productDiscountStartDate = discountStartDate;
      product.productDiscountEndDate = discountEndDate;
      product.hasActiveDiscount = hasActiveDiscount;
      product.NEW = isNew;
      product.newUntil = newUntil;
  
      // الصورة الرئيسية (إجباري رفعها مع التعديل)
      const mainImage = req.files.find((f) => f.fieldname === "productImage");
      if (mainImage) {
        const mainImageResult = await uploadToCloudinary(mainImage.buffer, 'products');
        product.productImage = mainImageResult.url;
      }
  
      // الصور الإضافية
      const otherImages = req.files.filter((f) => f.fieldname === "productImages");
      if (otherImages.length > 0) {
        const otherImageResults = await Promise.all(
          otherImages.map((img) => uploadToCloudinary(img.buffer, 'products'))
        );
        product.productImages.push(...otherImageResults.map((r) => r.url));
      }
  
      await product.save();
  
      res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error) {
      console.error("Error updating product:", error);
      next(new AppError("Failed to update product", 500));
    }
  }
  

  async createProduct(req, res, next) {
    try {
      const {
        productName,
        productDescription,
        productPrice,
        oldProductPrice,
        productColors,
        productSizes,
        productCategory,
        productQuantity,
        productStatus,
        productDiscount,
        productDiscountPercentage,
        productDiscountStartDate,
        productDiscountEndDate,
        NEW,
      } = req.body;

      if (!productName?.trim()) return next(new AppError("Product name is required", 400));

      // إنشاء slug فريد
      const baseSlug = productName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50);

      let slug = baseSlug;
      let counter = 1;
      while (await Product.exists({ productSlug: slug })) {
        slug = `${baseSlug}-${counter++}`;
      }

      // حساب سعر الخصم وحالة الخصم
      const discountPercentage = productDiscountPercentage
        ? parseFloat(productDiscountPercentage)
        : 0;
      const price = parseFloat(productPrice) || 0;
      const calculatedDiscountPrice =
        discountPercentage > 0 ? price - (price * (discountPercentage / 100)) : 0;

      const now = new Date();
      const discountStartDate = productDiscountStartDate
        ? new Date(productDiscountStartDate)
        : null;
      const discountEndDate = productDiscountEndDate
        ? new Date(productDiscountEndDate)
        : null;

      const hasActiveDiscount =
        discountPercentage > 0 &&
        discountStartDate &&
        discountEndDate &&
        now >= discountStartDate &&
        now <= discountEndDate;

      // تعيين حالة المنتج الجديد
      const isNew = NEW === "true" || NEW === true;
      const newUntil = isNew ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null;

      const productData = {
        productName,
        productDescription,
        productPrice: parseFloat(productPrice),
        oldProductPrice: oldProductPrice ? parseFloat(oldProductPrice) : 0,
        productSlug: slug,
        productColors: productColors ? JSON.parse(productColors) : [],
        productSizes: productSizes ? JSON.parse(productSizes) : [],
        productCategory,
        productQuantity: parseInt(productQuantity) || 0,
        productStatus: productStatus !== undefined ? productStatus === "true" : true,
        productImage: "",
        productImages: [],
        productDiscount: productDiscount ? parseFloat(productDiscount) : 0,
        productDiscountPrice: calculatedDiscountPrice,
        productDiscountPercentage: discountPercentage,
        productDiscountStartDate: discountStartDate,
        productDiscountEndDate: discountEndDate,
        hasActiveDiscount,
        NEW: isNew,
        newUntil,
      };

      if (!req.files || req.files.length === 0) {
        return next(new AppError("Product image is required", 400));
      }

      // رفع الصورة الرئيسية
      const mainImage = req.files.find((f) => f.fieldname === "productImage");
      if (!mainImage) return next(new AppError("Main product image is required", 400));
      
      const mainImageResult = await uploadToCloudinary(mainImage.buffer, 'products');
      productData.productImage = mainImageResult.url;
      
      // الصور الإضافية
      const otherImages = req.files.filter((f) => f.fieldname === "productImages");
      if (otherImages.length > 0) {
        const otherImageResults = await Promise.all(
          otherImages.map(img => uploadToCloudinary(img.buffer, 'products'))
        );
        productData.productImages = otherImageResults.map(result => result.url);
      }
      
      const product = await Product.create(productData);

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      console.error("Error creating product:", error);
      next(new AppError("Failed to create product", 500));
    }
  }

  // الحصول على المنتجات الجديدة
  async getNewProducts(req, res, next) {
    try {
      // تحديث حالة المنتجات أولاً
      await Product.updateNewAndDiscountStatus();
      
      const products = await Product.find({ 
        isDeleted: false,
        NEW: true
      })
      .sort({ createdAt: -1 })
      .populate("productCategory", "name");

      res.status(200).json({
        success: true,
        message: "New products fetched successfully",
        data: products,
      });
    } catch (error) {
      console.error("Error fetching new products:", error);
      next(new AppError("Failed to fetch new products", 500));
    }
  }

  // الحصول على المنتجات التي لها خصم نشط
  async getDiscountedProducts(req, res, next) {
    try {
      // تحديث حالة المنتجات أولاً
      await Product.updateNewAndDiscountStatus();
      
      const products = await Product.find({ 
        isDeleted: false,
        hasActiveDiscount: true
      })
      .sort({ productDiscountEndDate: -1 }) // Sort by end date descending to get latest expiring first
      .populate("productCategory", "name")
      .populate("productReviews", "rating comment user createdAt");

      // Get the product with the longest remaining discount time
      let longestExpiryDate = null;
      let totalDuration = 0;
      let elapsedDuration = 0;
      
      if (products.length > 0) {
        const now = new Date();
        
        // Find the product with the longest remaining discount time
        const productWithLongestRemaining = products.reduce((longest, product) => {
          const endDate = new Date(product.productDiscountEndDate);
          const remainingTime = endDate.getTime() - now.getTime();
          
          if (!longest || remainingTime > (new Date(longest.productDiscountEndDate).getTime() - now.getTime())) {
            return product;
          }
          return longest;
        }, null);
        
        if (productWithLongestRemaining) {
          longestExpiryDate = productWithLongestRemaining.productDiscountEndDate;
          
          // Calculate total duration and elapsed duration
          const startDate = new Date(productWithLongestRemaining.productDiscountStartDate);
          const endDate = new Date(productWithLongestRemaining.productDiscountEndDate);
          
          // Total duration in milliseconds
          totalDuration = endDate.getTime() - startDate.getTime();
          
          // Elapsed duration in milliseconds (capped at total duration)
          elapsedDuration = Math.min(now.getTime() - startDate.getTime(), totalDuration);
          
          // If elapsed duration is negative (discount hasn't started yet), set to 0
          if (elapsedDuration < 0) {
            elapsedDuration = 0;
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Discounted products fetched successfully",
        data: products,
        longestExpiryDate, // Changed from earliestExpiryDate to longestExpiryDate
        discountProgress: {
          totalDuration,
          elapsedDuration,
          percentComplete: totalDuration > 0 ? Math.round((elapsedDuration / totalDuration) * 100) : 0
        }
      });
    } catch (error) {
      console.error("Error fetching discounted products:", error);
      next(new AppError("Failed to fetch discounted products", 500));
    }
  }

  // Get best selling products
  async getBestSellingProducts(req, res, next) {
    try {
      // Update product statuses first
      await Product.updateNewAndDiscountStatus();
      
      // Get products sorted by rating
      const products = await Product.find({ 
        isDeleted: false,
        productStatus: true
      })
      .sort({ productRating: -1 }) // Sort by rating descending
      .limit(8) // Limit to 8 products
      .populate("productCategory", "name")
      .populate("productReviews", "rating comment user createdAt");

      res.status(200).json({
        success: true,
        message: "Best selling products fetched successfully",
        data: products
      });
    } catch (error) {
      console.error("Error fetching best selling products:", error);
      next(new AppError("Failed to fetch best selling products", 500));
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const { slug } = req.params;
      const product = await Product.findOneAndUpdate({ productSlug: slug }, { isDeleted: true }, { new: true });

      if (!product) return next(new AppError("Product not found", 404));

      res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        product,
      });
    } catch (error) {
      next(new AppError("Failed to delete product", 500));
    }
  }

  async getProductBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const product = await Product.findOne({ productSlug: slug });

      if (!product) return next(new AppError("Product not found", 404));

      res.status(200).json({
        success: true,
        message: "Product fetched successfully",
        data: product,
      });
    } catch (error) {
      next(new AppError("Failed to fetch product", 500));
    }
  }

  async getProductByCategory(req, res, next) {
    try {
      const { categoryId } = req.params;
      const products = await Product.find({ productCategory: categoryId });

      res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        products,
      });
    } catch (error) {
      next(new AppError("Failed to fetch products", 500));
    }
  }

  async getProductByPrice(req, res, next) {
    try {
      const { price } = req.params;
      const products = await Product.find({ productPrice: price });

      res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        products,
      });
    } catch (error) {
      next(new AppError("Failed to fetch products", 500));
    }
  }

  async searchProduct(req, res, next) {
    try {
      const { query } = req.query;
      
      if (!query || query.trim() === '') {
        return next(new AppError("Search query is required", 400));
      }
      
      console.log("Search query received:", query);
      
      const trimmedQuery = query.trim();
      const page = parseInt(req.query.page || '1');
      const limit = parseInt(req.query.limit || '12');
      const skip = (page - 1) * limit;
      
      // Search for products that contain the search term in their name
      const searchFilter = {
        isDeleted: false,
        productName: { $regex: trimmedQuery, $options: 'i' }
      };
      
      // Log the search filter for debugging
      console.log("Search filter:", JSON.stringify(searchFilter));
      
      // Get all matching products without pagination first
      const allMatchingProducts = await Product.find(searchFilter)
        .sort({ createdAt: -1 })
        .populate("productCategory", "name");
      
      console.log("Total matching products:", allMatchingProducts.length);
      console.log("Matching product names:", allMatchingProducts.map(p => p.productName));
      
      // Then apply pagination
      const products = allMatchingProducts.slice(skip, skip + limit);
      
      const total = allMatchingProducts.length;
      
      // Populate product reviews if there are results
      if (products.length > 0) {
        try {
          await Product.populate(products, {
            path: "productReviews",
            select: "rating comment user createdAt"
          });
        } catch (error) {
          console.warn("Warning: Could not populate product reviews:", error.message);
        }
      }
      
      const totalPages = Math.ceil(total / limit);
      
      console.log(`Search results: ${products.length} of ${total} total`);
      
      return res.status(200).json({
        success: true,
        message: total > 0 ? "Products found" : "No products found",
        noProduct: total === 0,
        data: products,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      });
    } catch (error) {
      console.error("Error searching products:", error);
      next(new AppError(`Failed to search products: ${error.message}`, 500));
    }
  }
  
  async uploadProductImage(req, res, next) {
    try {
      const { productId } = req.params;
      if (!req.file) return next(new AppError("No image provided", 400));

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'products'
      });
      
      const imageUrl = `/backend/uploads/products/${result.public_id}`;
      const product = await Product.findByIdAndUpdate(
        productId,
        { productImage: imageUrl },
        { new: true }
      );

      if (!product) return next(new AppError("Product not found", 404));

      res.status(200).json({
        success: true,
        message: "Product image uploaded successfully",
        product,
      });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      next(new AppError("Failed to upload product image", 500));
    }
  }

  async getProductsCount(req, res, next) {
    try {
      const count = await Product.countDocuments({ isDeleted: false });
      console.log(count)
      res.status(200).json({
        success: true,
        count
      });
    } catch (error) {
      console.error("Error counting products:", error);
      next(new AppError("Failed to count products", 500));
    }
  }

  async filterProducts(req, res, next) {
    try {
      const {
        category,
        categories,
        minPrice,
        maxPrice,
        colors,
        sizes,
        search,
        sort,
        discount,
        new: isNew,
        inStock,
        rating,
        page = 1,
        limit = 12
      } = req.query;

      console.log("Filter request received with params:", req.query);

      // Build filter object
      const filter = { isDeleted: false };

      // Filter by single category
      if (category) {
        filter.productCategory = category;
      }

      // Filter by multiple categories
      if (categories) {
        const categoryList = categories.split(',');
        filter.productCategory = { $in: categoryList };
      }

      // Filter by price range
      if (minPrice || maxPrice) {
        filter.productPrice = {};
        if (minPrice) filter.productPrice.$gte = parseFloat(minPrice);
        if (maxPrice) filter.productPrice.$lte = parseFloat(maxPrice);
      }

      // Filter by search term - CRITICAL FIX HERE
      if (search && search.trim() !== '') {
        // If we're specifically searching for Samsung products, only look in product names
        if (search.toLowerCase() === 'samsung') {
          filter.productName = { $regex: search, $options: 'i' };
        } else {
          // Otherwise use the original OR logic for general searches
          filter.$or = [
            { productName: { $regex: search, $options: 'i' } },
            { productDescription: { $regex: search, $options: 'i' } }
          ];
        }
      }

      // Filter by colors
      if (colors) {
        const colorList = colors.split(',');
        filter.productColors = { $in: colorList };
      }

      // Filter by sizes
      if (sizes) {
        const sizeList = sizes.split(',');
        filter.productSizes = { $in: sizeList };
      }

      // Filter by discount
      if (discount === 'true') {
        filter.hasActiveDiscount = true;
      }

      // Filter by new
      if (isNew === 'true') {
        filter.NEW = true;
      }

      // Filter by stock
      if (inStock === 'true') {
        filter.productQuantity = { $gt: 0 };
      }

      console.log("Final filter object:", JSON.stringify(filter));

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Determine sort option
      let sortOption = { createdAt: -1 }; // Default sort by newest
      if (sort) {
        switch (sort) {
          case 'price-asc':
            sortOption = { productPrice: 1 };
            break;
          case 'price-desc':
            sortOption = { productPrice: -1 };
            break;
          case 'name-asc':
            sortOption = { productName: 1 };
            break;
          case 'name-desc':
            sortOption = { productName: -1 };
            break;
          case 'discount':
            sortOption = { productDiscountPercentage: -1 };
            break;
          // 'popular' and 'newest' are handled separately
        }
      }

      // CRITICAL FIX: Get total count for pagination first
      const total = await Product.countDocuments(filter);
      
      // CRITICAL FIX: Verify the filter is working by logging the matching product names
      const matchingProductNames = await Product.find(filter).select('productName -_id');
      console.log("Matching product names:", matchingProductNames.map(p => p.productName));
      
      // Then get the products with pagination
      const products = await Product.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("productCategory", "name")
        .populate("productReviews", "rating comment user createdAt");

      const totalPages = Math.ceil(total / parseInt(limit));

      console.log(`Filtered products: ${products.length} of ${total} total`);
      
      // CRITICAL FIX: Ensure we're only returning products that match the filter
      if (products.length > total) {
        console.error("Warning: Products length exceeds total count. This indicates a query issue.");
        // Return only the products that match the filter
        return res.status(200).json({
          success: true,
          message: total > 0 ? "Products filtered successfully" : "No products found",
          noProduct: total === 0,
          data: products.slice(0, total), // Only return the number of products that match the filter
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages
          }
        });
      }
      
      return res.status(200).json({
        success: true,
        message: total > 0 ? "Products filtered successfully" : "No products found",
        noProduct: total === 0,
        data: products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      });
    } catch (error) {
      console.error("Error filtering products:", error);
      next(new AppError("Failed to filter products", 500));
    }
  }

  // Add a method to get available filters (for frontend filter UI)
  async getAvailableFilters(req, res, next) {
    try {
      // Get all unique colors
      const colors = await Product.distinct('productColors', { isDeleted: false });
      
      // Get all unique sizes
      const sizes = await Product.distinct('productSizes', { isDeleted: false });
      
      // Get price range
      const priceRange = await Product.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$productPrice' },
            maxPrice: { $max: '$productPrice' }
          }
        }
      ]);
      
      // Get categories with product counts
      const categories = await Product.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$productCategory', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $project: {
            _id: 1,
            count: 1,
            name: { $arrayElemAt: ['$categoryInfo.name', 0] }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      // Get counts for special filters
      const counts = await Product.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            newProducts: { $sum: { $cond: ['$NEW', 1, 0] } },
            discountedProducts: { $sum: { $cond: ['$hasActiveDiscount', 1, 0] } },
            inStock: { $sum: { $cond: [{ $gt: ['$productQuantity', 0] }, 1, 0] } },
            outOfStock: { $sum: { $cond: [{ $lte: ['$productQuantity', 0] }, 1, 0] } }
          }
        }
      ]);
      
      res.status(200).json({
        success: true,
        filters: {
          colors,
          sizes,
          priceRange: priceRange.length > 0 ? {
            min: priceRange[0].minPrice,
            max: priceRange[0].maxPrice
          } : { min: 0, max: 0 },
          categories,
          counts: counts.length > 0 ? counts[0] : {
            total: 0,
            newProducts: 0,
            discountedProducts: 0,
            inStock: 0,
            outOfStock: 0
          }
        }
      });
    } catch (error) {
      console.error("Error getting available filters:", error);
      next(new AppError("Failed to get available filters", 500));
    }
  }

  async resetExpiredDiscounts(req, res, next) {
    try {
      const now = new Date();
      
      // Find products with expired discounts
      const expiredProducts = await Product.find({
        productDiscountEndDate: { $lt: now },
        hasActiveDiscount: true
      });
      
      // Reset each product's price
      for (const product of expiredProducts) {
        product.hasActiveDiscount = false;
        product.productDiscountPrice = 0;
        product.productDiscountPercentage = 0;
        await product.save();
      }
      
      return res.status(200).json({
        success: true,
        message: "Expired discounts reset successfully",
        count: expiredProducts.length
      });
    } catch (error) {
      console.error("Error resetting expired discounts:", error);
      next(new AppError("Failed to reset expired discounts", 500));
    }
  }
}

module.exports = new ProductController();
