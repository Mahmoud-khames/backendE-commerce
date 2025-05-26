const customizeModel = require("../models/customizeModel");
const fs = require("fs");
const path = require("path");

class Customize {
  // الحصول على جميع الصور
  async getImages(req, res) {
    try {
      console.log("Received GET request for /customize from IP:", req.ip);
      console.log("Fetching images from database...");
      let images = await customizeModel.find({}).sort({ createdAt: -1 });
      console.log("Images found:", images);
      if (images.length > 0) {
        return res.status(200).json({
          success: true,
          message: "Images fetched successfully",
          images,
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "No images found",
          images: [],
        });
      }
    } catch (err) {
      console.error("Error in getImages:", err);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }

  // إنشاء تخصيص جديد مع صور متعددة
  async createCustomize(req, res) {
    try {
      const { title, description, firstShow, isActive } = req.body;
      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "Title and description are required",
        });
      }

      // التحقق من وجود ملفات
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please upload at least one image",
        });
      }

      // تحضير مسارات الصور
      const slideImages = req.files.map(
        (file) => `/backend/uploads/customize/${file.filename}`
      );

      // إنشاء تخصيص جديد
      const customize = await customizeModel.create({
        slideImage: slideImages,
        title: title || "",
        description: description || "",
        firstShow: firstShow || 0,
        isActive: isActive === "true" || isActive === true,
      });

      if (customize) {
        return res.status(201).json({
          success: true,
          message: "Customize created successfully",
          customize,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to create customize",
        });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }

  // تحميل صورة واحدة للشرائح
  async uploadSlideImage(req, res) {
    try {
      // التحقق من وجود ملف
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload an image",
        });
      }

      console.log("File uploaded:", req.file);
      const imagePath = `/backend/uploads/customize/${req.file.filename}`;

      // البحث عن تخصيص موجود أو إنشاء واحد جديد
      let customize = await customizeModel.findOne({});

      if (customize) {
        // إضافة الصورة إلى المصفوفة الموجودة
        customize.slideImage.push(imagePath);
        await customize.save();
      } else {
        // إنشاء تخصيص جديد مع الصورة
        customize = await customizeModel.create({
          slideImage: [imagePath],
        });
      }

      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully",
        image: imagePath,
        customize,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }

  // حذف صورة من الشرائح
  async deleteSlideImage(req, res) {
    try {
      const { id, imageIndex } = req.body;

      if (!id || imageIndex === undefined) {
        return res.status(400).json({
          success: false,
          message: "Customize ID and image index are required",
        });
      }

      // البحث عن التخصيص
      const customize = await customizeModel.findById(id);

      if (!customize) {
        return res.status(404).json({
          success: false,
          message: "Customize not found",
        });
      }

      // التأكد من أن الفهرس صالح
      if (imageIndex < 0 || imageIndex >= customize.slideImage.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid image index",
        });
      }

      // تحديد مسار الصورة المراد حذفها
      const imagePath = customize.slideImage[imageIndex];
      const filePath = path.join(__dirname, "../../public", imagePath); // Corrected path

      // إزالة الصورة من المصفوفة
      customize.slideImage.splice(imageIndex, 1);
      await customize.save();

      // حذف الملف من النظام إن وجد
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Failed to delete image file:", err);
          } else {
            console.log("Deleted image file:", filePath);
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: "Image deleted successfully",
        customize,
      });
    } catch (error) {
      console.error("Error deleting slide image:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }

  // تحديث معلومات التخصيص
  async updateCustomize(req, res) {
    try {
      const { id } = req.params;
      const { title, description, firstShow, isActive } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Customize ID is required",
        });
      }

      // البحث عن التخصيص
      let customize = await customizeModel.findById(id);

      if (!customize) {
        return res.status(404).json({
          success: false,
          message: "Customize not found",
        });
      }

      // تحديث البيانات
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (firstShow !== undefined) updateData.firstShow = firstShow;
      if (isActive !== undefined) updateData.isActive = isActive === "true" || isActive === true;

      // إضافة صور جديدة إذا وجدت
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map(
          (file) => `/backend/uploads/customize/${file.filename}`
        );
        updateData.slideImage = [...customize.slideImage, ...newImages];
      }

      // تحديث التخصيص
      customize = await customizeModel.findByIdAndUpdate(id, updateData, { new: true });

      return res.status(200).json({
        success: true,
        message: "Customize updated successfully",
        customize,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }

  // حذف تخصيص بالكامل
  async deleteCustomize(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Customize ID is required",
        });
      }

      // البحث عن التخصيص
      const customize = await customizeModel.findById(id);

      if (!customize) {
        return res.status(404).json({
          success: false,
          message: "Customize not found",
        });
      }

      // حذف جميع الصور من المجلد
      for (const imagePath of customize.slideImage) {
        const fullPath = path.join(__dirname, "../public", imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }

      // حذف التخصيص
      await customizeModel.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: "Customize deleted successfully",
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }
}

const customizeController = new Customize();
module.exports = customizeController;