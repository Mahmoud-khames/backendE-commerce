// controllers/customizeController.js
const CustomizeService = require("../services/customize.service");
const AppError = require("../utils/AppError");

class CustomizeController {
  // Helper للحصول على اللغة
  static getLang(req) {
    return (
      req.headers["accept-language"]?.split(",")[0]?.split("-")[0] ||
      req.query.lang ||
      "en"
    );
  }

  // Helper للاستجابة
  static successResponse(res, data, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...data,
    });
  }

  // الحصول على جميع السلايدات
  async getAllSlides(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { result } = await CustomizeService.getAllSlides(req.query, lang);

      return CustomizeController.successResponse(
        res,
        {
          data: result.data,
          pagination: result.pagination,
        },
        lang === "ar" ? "تم جلب السلايدات بنجاح" : "Slides fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching slides:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch slides", 500)
      );
    }
  }

  // الحصول على السلايدات النشطة (للواجهة العامة)
  async getActiveSlides(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { type } = req.query;

      const slides = await CustomizeService.getActiveSlides(type, lang);

      return CustomizeController.successResponse(
        res,
        {
          data: slides,
          count: slides.length,
        },
        lang === "ar"
          ? "تم جلب السلايدات النشطة بنجاح"
          : "Active slides fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching active slides:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch active slides", 500)
      );
    }
  }

  // Alias للتوافق مع الكود القديم
  async getImages(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { type } = req.query;

      const slides = await CustomizeService.getActiveSlides(type, lang);

      return CustomizeController.successResponse(
        res,
        {
          data: slides,
          count: slides.length,
        },
        lang === "ar"
          ? "تم جلب السلايدات النشطة بنجاح"
          : "Active slides fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching active slides:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch active slides", 500)
      );
    }
  }

  // الحصول على سلايد بالـ ID
  async getSlideById(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id } = req.params;

      const slide = await CustomizeService.getSlideById(id, lang, false);

      return CustomizeController.successResponse(
        res,
        {
          data: slide,
        },
        lang === "ar" ? "تم جلب السلايد بنجاح" : "Slide fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching slide:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch slide", 500)
      );
    }
  }

  // إنشاء سلايد جديد
  async createSlide(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);

      const slide = await CustomizeService.createSlide(
        req.body,
        req.files,
        lang,
        false
      );

      return CustomizeController.successResponse(
        res,
        {
          data: slide,
        },
        lang === "ar" ? "تم إنشاء السلايد بنجاح" : "Slide created successfully",
        201
      );
    } catch (error) {
      console.error("Error creating slide:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to create slide", 500)
      );
    }
  }

  // Alias للتوافق
  async createCustomize(req, res, next) {
    return this.createSlide(req, res, next);
  }

  // تحديث سلايد
  async updateSlide(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id } = req.params;

      const slide = await CustomizeService.updateSlide(
        id,
        req.body,
        req.files,
        lang,
        false
      );

      return CustomizeController.successResponse(
        res,
        {
          data: slide,
        },
        lang === "ar" ? "تم تحديث السلايد بنجاح" : "Slide updated successfully"
      );
    } catch (error) {
      console.error("Error updating slide:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to update slide", 500)
      );
    }
  }

  // Alias للتوافق
  async updateCustomize(req, res, next) {
    return this.updateSlide(req, res, next);
  }

  // إضافة صورة
  async addImage(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id, altEn, altAr } = req.body;

      if (!req.file) {
        return next(
          new AppError(
            lang === "ar" ? "ملف الصورة مطلوب" : "Image file is required",
            400
          )
        );
      }

      const result = await CustomizeService.addImageToSlide(
        id,
        req.file,
        { altEn, altAr },
        lang
      );

      return CustomizeController.successResponse(
        res,
        {
          image: result.image,
        },
        result.message
      );
    } catch (error) {
      console.error("Error adding image:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to add image", 500)
      );
    }
  }

  // Alias للتوافق
  async uploadSlideImage(req, res, next) {
    return this.addImage(req, res, next);
  }

  // حذف صورة
  async deleteImage(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id, imageIndex } = req.body;

      const result = await CustomizeService.deleteImageFromSlide(
        id,
        parseInt(imageIndex),
        lang
      );

      return CustomizeController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error("Error deleting image:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to delete image", 500)
      );
    }
  }

  // Alias للتوافق
  async deleteSlideImage(req, res, next) {
    return this.deleteImage(req, res, next);
  }

  // إعادة ترتيب الصور
  async reorderImages(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id } = req.params;
      const { orderedImages } = req.body;

      if (!Array.isArray(orderedImages) || orderedImages.length === 0) {
        return next(
          new AppError(
            lang === "ar"
              ? "قائمة الصور مطلوبة"
              : "Ordered images array is required",
            400
          )
        );
      }

      const result = await CustomizeService.reorderImages(
        id,
        orderedImages,
        lang
      );

      return CustomizeController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error("Error reordering images:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to reorder images", 500)
      );
    }
  }

  // حذف سلايد
  async deleteSlide(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id } = req.params;

      const result = await CustomizeService.deleteSlide(id, lang);

      return CustomizeController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error("Error deleting slide:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to delete slide", 500)
      );
    }
  }

  // Alias للتوافق
  async deleteCustomize(req, res, next) {
    return this.deleteSlide(req, res, next);
  }

  // تبديل حالة التفعيل
  async toggleActiveStatus(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id } = req.params;

      const slide = await CustomizeService.toggleActiveStatus(id, lang, false);

      return CustomizeController.successResponse(
        res,
        {
          data: slide,
        },
        lang === "ar" ? "تم تغيير حالة السلايد" : "Slide status toggled"
      );
    } catch (error) {
      console.error("Error toggling status:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to toggle status", 500)
      );
    }
  }

  // إعادة ترتيب السلايدات
  async reorderSlides(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return next(
          new AppError(
            lang === "ar"
              ? "قائمة المعرفات مطلوبة"
              : "Ordered IDs array is required",
            400
          )
        );
      }

      const result = await CustomizeService.reorderSlides(orderedIds, lang);

      return CustomizeController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error("Error reordering slides:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to reorder slides", 500)
      );
    }
  }

  // نسخ سلايد
  async duplicateSlide(req, res, next) {
    try {
      const lang = CustomizeController.getLang(req);
      const { id } = req.params;

      const slide = await CustomizeService.duplicateSlide(id, lang, false);

      return CustomizeController.successResponse(
        res,
        {
          data: slide,
        },
        lang === "ar"
          ? "تم نسخ السلايد بنجاح"
          : "Slide duplicated successfully",
        201
      );
    } catch (error) {
      console.error("Error duplicating slide:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to duplicate slide", 500)
      );
    }
  }
}

module.exports = new CustomizeController();
