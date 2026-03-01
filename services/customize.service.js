// services/customizeService.js
const MongooseFeatures = require("./mongodb/features/index");
const CustomizeModel = require("../models/customizeModel");
const { pick } = require("lodash");
const AppError = require("../utils/AppError");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/cloudinaryUpload");

class CustomizeService extends MongooseFeatures {
  constructor() {
    super();
    this.allowedKeys = [
      "titleEn",
      "titleAr",
      "descriptionEn",
      "descriptionAr",
      "buttonTextEn",
      "buttonTextAr",
      "buttonLink",
      "slideImages",
      "displayOrder",
      "isActive",
      "type",
      "startDate",
      "endDate",
      "settings",
    ];
  }

  // ==================== Helper Methods ====================

  getLangMessage(lang, enMsg, arMsg) {
    return lang === "ar" ? arMsg : enMsg;
  }

  // تنسيق البيانات
  formatSlideData(body) {
    const data = {};

    if (body.titleEn !== undefined) data.titleEn = body.titleEn.trim();
    if (body.titleAr !== undefined) data.titleAr = body.titleAr.trim();
    if (body.descriptionEn !== undefined)
      data.descriptionEn = body.descriptionEn.trim();
    if (body.descriptionAr !== undefined)
      data.descriptionAr = body.descriptionAr.trim();
    if (body.buttonTextEn !== undefined)
      data.buttonTextEn = body.buttonTextEn.trim();
    if (body.buttonTextAr !== undefined)
      data.buttonTextAr = body.buttonTextAr.trim();
    if (body.buttonLink !== undefined) data.buttonLink = body.buttonLink.trim();

    if (body.displayOrder !== undefined)
      data.displayOrder = parseInt(body.displayOrder) || 0;
    if (body.isActive !== undefined)
      data.isActive = body.isActive === "true" || body.isActive === true;
    if (body.type !== undefined) data.type = body.type;

    if (body.startDate !== undefined) {
      data.startDate = body.startDate ? new Date(body.startDate) : null;
    }
    if (body.endDate !== undefined) {
      data.endDate = body.endDate ? new Date(body.endDate) : null;
    }

    // Handle settings - either as object or from FormData
    if (body.settings) {
      data.settings =
        typeof body.settings === "string"
          ? JSON.parse(body.settings)
          : body.settings;
    } else if (body["settings[autoPlay]"] !== undefined) {
      // Handle FormData format: settings[autoPlay], settings[autoPlaySpeed], etc.
      data.settings = {
        autoPlay:
          body["settings[autoPlay]"] === "true" ||
          body["settings[autoPlay]"] === true,
        autoPlaySpeed: parseInt(body["settings[autoPlaySpeed]"]) || 3000,
        showArrows:
          body["settings[showArrows]"] === "true" ||
          body["settings[showArrows]"] === true,
        showDots:
          body["settings[showDots]"] === "true" ||
          body["settings[showDots]"] === true,
        loop:
          body["settings[loop]"] === "true" || body["settings[loop]"] === true,
      };
    }

    return data;
  }

  // رفع صورة واحدة
  async uploadImage(file, altEn = "", altAr = "", order = 0) {
    const result = await uploadToCloudinary(
      file.buffer || file.path,
      "customize"
    );
    return {
      url: result.url,
      altEn,
      altAr,
      order,
    };
  }

  // رفع صور متعددة
  async uploadImages(files, altsData = []) {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map((file, index) => {
      const altData = altsData[index] || {};
      return this.uploadImage(
        file,
        altData.altEn || "",
        altData.altAr || "",
        altData.order || index
      );
    });

    return await Promise.all(uploadPromises);
  }

  // حذف صورة من Cloudinary
  async deleteImage(imageUrl) {
    if (!imageUrl) return;

    try {
      const publicId = imageUrl.split("/").pop().split(".")[0];
      await deleteFromCloudinary(publicId, "customize");
    } catch (error) {
      console.error("Failed to delete image:", error);
    }
  }

  // ==================== CRUD Operations ====================

  // الحصول على جميع السلايدات
  async getAllSlides(query = {}, lang = "en") {
    const {
      perPage = 15,
      page = 1,
      sorts = [],
      queries = [],
      type,
      isActive,
      includeInactive = false,
    } = pick(query, [
      "perPage",
      "page",
      "sorts",
      "queries",
      "type",
      "isActive",
      "includeInactive",
    ]);

    const includeInactiveBool =
      includeInactive === "true" || includeInactive === true;
    const isActiveBool = isActive === "true" || isActive === true;

    let filter = {};

    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActiveBool;

    // إذا لم يطلب المستخدم السلايدات غير النشطة، نعرض فقط النشطة والمناسبة للتاريخ
    if (!includeInactiveBool) {
      const now = new Date();
      filter.isActive = true;
      filter.$or = [
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: { $gte: now } },
      ];
    }

    const result = await this.PaginateHandler(
      CustomizeModel,
      Number(perPage),
      Number(page),
      sorts.length ? sorts : [["displayOrder", "asc"]],
      queries
    );

    // For admin, we return full objects. Localization happens in getActiveSlides (public).
    // result.data = result.data.map((slide) => slide.toLocalizedJSON(lang));

    return { result, keys: this.allowedKeys };
  }

  // الحصول على السلايدات النشطة
  async getActiveSlides(type = null, lang = "en") {
    return await CustomizeModel.getActiveSlides(type, lang);
  }

  // الحصول على سلايد بالـ ID
  async getSlideById(id, lang = "en", localize = true) {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    return localize ? slide.toLocalizedJSON(lang) : slide;
  }

  // إنشاء سلايد جديد
  async createSlide(body, files, lang = "en", localize = true) {
    // التحقق من الحقول المطلوبة
    if (!body.titleEn || !body.titleAr) {
      throw new AppError(
        this.getLangMessage(
          lang,
          "Title in both languages is required",
          "العنوان بكلا اللغتين مطلوب"
        ),
        400
      );
    }

    // تنسيق البيانات
    const slideData = this.formatSlideData(body);

    // رفع الصور إذا كانت موجودة
    if (files && files.length > 0) {
      // معالجة بيانات Alt للصور
      let altsData = [];
      if (body.imageAlts) {
        altsData =
          typeof body.imageAlts === "string"
            ? JSON.parse(body.imageAlts)
            : body.imageAlts;
      }

      // رفع الصور
      slideData.slideImages = await this.uploadImages(files, altsData);
    } else {
      // تعيين مصفوفة فارغة إذا لم تكن هناك صور
      slideData.slideImages = [];
    }

    // إنشاء السلايد
    const slide = await CustomizeModel.create(slideData);

    return localize ? slide.toLocalizedJSON(lang) : slide;
  }

  // تحديث سلايد
  async updateSlide(id, body, files, lang = "en", localize = true) {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    // تنسيق البيانات
    const updateData = this.formatSlideData(body);

    // إضافة صور جديدة
    if (files && files.length > 0) {
      let altsData = [];
      if (body.imageAlts) {
        altsData =
          typeof body.imageAlts === "string"
            ? JSON.parse(body.imageAlts)
            : body.imageAlts;
      }

      const newImages = await this.uploadImages(files, altsData);
      updateData.slideImages = [...slide.slideImages, ...newImages];
    }

    // حذف صور محددة
    if (body.deleteImages) {
      const imagesToDelete =
        typeof body.deleteImages === "string"
          ? JSON.parse(body.deleteImages)
          : body.deleteImages;

      for (const imageUrl of imagesToDelete) {
        await this.deleteImage(imageUrl);
        if (updateData.slideImages) {
          updateData.slideImages = updateData.slideImages.filter(
            (img) => img.url !== imageUrl
          );
        } else {
          slide.slideImages = slide.slideImages.filter(
            (img) => img.url !== imageUrl
          );
        }
      }
    }

    // تحديث السلايد
    Object.assign(slide, updateData);
    await slide.save();

    return localize ? slide.toLocalizedJSON(lang) : slide;
  }

  // إضافة صورة إلى سلايد موجود
  async addImageToSlide(id, file, altData, lang = "en") {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    if (!file) {
      throw new AppError(
        this.getLangMessage(lang, "Image file is required", "ملف الصورة مطلوب"),
        400
      );
    }

    const newImage = await this.uploadImage(
      file,
      altData?.altEn || "",
      altData?.altAr || "",
      slide.slideImages.length
    );

    slide.slideImages.push(newImage);
    await slide.save();

    return {
      image: newImage,
      message: this.getLangMessage(
        lang,
        "Image added successfully",
        "تمت إضافة الصورة بنجاح"
      ),
    };
  }

  // حذف صورة من سلايد
  async deleteImageFromSlide(id, imageIndex, lang = "en") {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    if (imageIndex < 0 || imageIndex >= slide.slideImages.length) {
      throw new AppError(
        this.getLangMessage(lang, "Invalid image index", "رقم الصورة غير صحيح"),
        400
      );
    }

    const imageUrl = slide.slideImages[imageIndex].url;
    await this.deleteImage(imageUrl);

    slide.slideImages.splice(imageIndex, 1);
    await slide.save();

    return {
      message: this.getLangMessage(
        lang,
        "Image deleted successfully",
        "تم حذف الصورة بنجاح"
      ),
    };
  }

  // تحديث ترتيب الصور
  async reorderImages(id, orderedImages, lang = "en") {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    // تحديث ترتيب الصور
    orderedImages.forEach((imageUrl, index) => {
      const image = slide.slideImages.find((img) => img.url === imageUrl);
      if (image) {
        image.order = index;
      }
    });

    slide.slideImages.sort((a, b) => a.order - b.order);
    await slide.save();

    return {
      message: this.getLangMessage(
        lang,
        "Images reordered successfully",
        "تم إعادة ترتيب الصور بنجاح"
      ),
    };
  }

  // حذف سلايد
  async deleteSlide(id, lang = "en") {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    // حذف جميع الصور
    for (const image of slide.slideImages) {
      await this.deleteImage(image.url);
    }

    await CustomizeModel.findByIdAndDelete(id);

    return {
      message: this.getLangMessage(
        lang,
        "Slide deleted successfully",
        "تم حذف السلايد بنجاح"
      ),
    };
  }

  // تبديل حالة التفعيل
  async toggleActiveStatus(id, lang = "en", localize = true) {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    slide.isActive = !slide.isActive;
    await slide.save();

    return localize ? slide.toLocalizedJSON(lang) : slide;
  }

  // إعادة ترتيب السلايدات
  async reorderSlides(orderedIds, lang = "en") {
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { displayOrder: index } },
      },
    }));

    await CustomizeModel.bulkWrite(bulkOps);

    return {
      message: this.getLangMessage(
        lang,
        "Slides reordered successfully",
        "تم إعادة ترتيب السلايدات بنجاح"
      ),
    };
  }

  // نسخ سلايد
  async duplicateSlide(id, lang = "en", localize = true) {
    const slide = await CustomizeModel.findById(id);

    if (!slide) {
      throw new AppError(
        this.getLangMessage(lang, "Slide not found", "السلايد غير موجود"),
        404
      );
    }

    const slideObj = slide.toObject();
    delete slideObj._id;
    delete slideObj.createdAt;
    delete slideObj.updatedAt;

    slideObj.titleEn = `${slideObj.titleEn} (Copy)`;
    slideObj.titleAr = `${slideObj.titleAr} (نسخة)`;
    slideObj.isActive = false;
    slideObj.displayOrder = slideObj.displayOrder + 1;

    const newSlide = await CustomizeModel.create(slideObj);

    return localize ? newSlide.toLocalizedJSON(lang) : newSlide;
  }
}

module.exports = new CustomizeService();
