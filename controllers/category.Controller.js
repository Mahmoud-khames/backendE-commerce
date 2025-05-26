const categoryModel = require("../models/categoryModel");
const AppError = require("../utils/AppError");
const fs = require("fs");
const path = require("path");

class Category {
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
    if (!name || !description) {
      return next(new AppError("Name and description are required", 400));
    }
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

      // Handle image upload
      if (req.file) {
        categoryData.image = `/backend/uploads/categories/${req.file.filename}`;
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
    
    if (!name || !description) {
      return next(new AppError("Name and description are required", 400));
    }
    
    try {
      const category = await categoryModel.findById(id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }

      // Prepare update data
      const updateData = {
        name,
        description,
        status: status === "true" || status === true,
      };

      // If name changed, update slug
      if (name !== category.name) {
        updateData.slug = name.toLowerCase().replace(/ /g, "-");
        
        // Check if new slug already exists
        const existingCategory = await categoryModel.findOne({ 
          slug: updateData.slug,
          _id: { $ne: id } // Exclude current category
        });
        
        if (existingCategory) {
          return next(new AppError("Category with this name already exists", 400));
        }
      }

      // Handle image upload
      if (req.file) {
        // Delete old image if exists
        if (category.image) {
          const oldImagePath = path.join(__dirname, "../public", category.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        updateData.image = `/backend/uploads/categories/${req.file.filename}`;
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
      const category = await categoryModel.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
      );
      
      if (!category) {
        return next(new AppError("Category not found", 404));
      }
      
      return res.status(200).json({
        success: true,
        message: "Category deleted successfully",
        category,
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
      
      // Delete old image if exists
      if (category.image) {
        const oldImagePath = path.join(__dirname, "../public", category.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      const imageUrl = `/backend/uploads/categories/${req.file.filename}`;
      
      const updatedCategory = await categoryModel.findByIdAndUpdate(
        id,
        { image: imageUrl },
        { new: true }
      );
      
      return res.status(200).json({
        success: true,
        message: "Category image uploaded successfully",
        category: updatedCategory,
      });
    } catch (error) {
      console.log(error);
      return next(new AppError("Failed to upload category image", 500));
    }
  }
}

const categoryController = new Category();
module.exports = categoryController;
