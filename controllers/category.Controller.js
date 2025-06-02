const categoryModel = require("../models/categoryModel");
const AppError = require("../utils/AppError");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinaryUpload");

class CategoryController {
  async getAllCategories(req, res, next) {
    try {
      const categories = await categoryModel
        .find({ isDeleted: false })
        .sort({ _id: -1 });
      return res.status(200).json({
        success: true,
        message: "Categories fetched successfully",
       data: categories,
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to get categories", 500));
    }
  }

  async getCategoryById(req, res, next) {
    const { id } = req.params;
    try {
      const category = await categoryModel.findById(id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }
      return res.status(200).json({
        success: true,
        message: "Category fetched successfully",
        category,
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to get category", 500));
    }
  }

  async createCategory(req, res, next) {
    const { name, description, status } = req.body;
    
    try {
      let slug = name.toLowerCase().replace(/ /g, "-");
      const existingCategory = await categoryModel.findOne({ slug });
      if (existingCategory) {
        return next(new AppError("Category already exists", 400));
      }

      const categoryData = {
        name,
        description,
        slug,
        status: status === "true" || status === true,
      };

      // رفع صورة الفئة
      if (req.file) {
        const result = await uploadToCloudinary(req.file.path, 'categories');
        categoryData.image = result.url;
      } else {
        return next(new AppError("Category image is required", 400));
      }

      const category = await categoryModel.create(categoryData);
      
      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        category,
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to create category", 500));
    }
  }

  async updateCategory(req, res, next) {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    try {
      const category = await categoryModel.findById(id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (status !== undefined) updateData.status = status === "true" || status === true;

      // رفع صورة الفئة الجديدة إذا وجدت
      if (req.file) {
        // حذف الصورة القديمة
        if (category.image) {
          const oldImageId = category.image.split('/').pop().split('.')[0];
          await deleteFromCloudinary(oldImageId, 'categories');
        }
        
        const result = await uploadToCloudinary(req.file.path, 'categories');
        updateData.image = result.url;
      }

      const updatedCategory = await categoryModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Category updated successfully",
        category: updatedCategory,
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to update category", 500));
    }
  }

  async deleteCategory(req, res, next) {
    const { id } = req.params;
    
    try {
      const category = await categoryModel.findById(id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }

      // حذف صورة الفئة من Cloudinary
      if (category.image) {
        const imageId = category.image.split('/').pop().split('.')[0];
        await deleteFromCloudinary(imageId, 'categories');
      }

      await categoryModel.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to delete category", 500));
    }
  }

  async uploadCategoryImage(req, res, next) {
    const { id } = req.params;
  
    try {
      if (!req.file) {
        return next(new AppError("No image provided", 400));
      }
  
      const category = await categoryModel.findById(id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }
  
      // حذف الصورة القديمة من Cloudinary إن وُجدت
      if (category.image) {
        const publicId = category.image
          .split('/')
          .slice(-1)[0] // last segment
          .split('.')[0]; // remove file extension
        await deleteFromCloudinary(`categories/${publicId}`);
      }
  
      // رفع الصورة الجديدة
      const result = await uploadToCloudinary(req.file.buffer, 'categories');
  
      // تحديث الفئة
      const updatedCategory = await categoryModel.findByIdAndUpdate(
        id,
        { image: result.url },
        { new: true }
      );
  
      return res.status(200).json({
        success: true,
        message: "Category image uploaded successfully",
        category: updatedCategory,
      });
    } catch (error) {
      console.error(error);
      return next(new AppError("Failed to upload category image", 500));
    }
  }
  
}

module.exports = new CategoryController();
