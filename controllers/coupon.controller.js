// controllers/couponController.js
const CouponService = require("../services/coupon.service");
const AppError = require("../utils/AppError");

class CouponController {
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

  // ==================== Query Methods ====================

  // الحصول على جميع الكوبونات
  async getAllCoupons(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { result } = await CouponService.getAllCoupons(req.query, lang);

      return CouponController.successResponse(
        res,
        {
          coupons: result.data,
          pagination: result.pagination,
        },
        lang === "ar"
          ? "تم جلب الكوبونات بنجاح"
          : "Coupons fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching coupons:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch coupons", 500)
      );
    }
  }

  // الحصول على الكوبونات النشطة
  async getActiveCoupons(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const coupons = await CouponService.getActiveCoupons(lang);

      return CouponController.successResponse(
        res,
        {
          coupons,
          count: coupons.length,
        },
        lang === "ar"
          ? "تم جلب الكوبونات النشطة بنجاح"
          : "Active coupons fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching active coupons:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch active coupons", 500)
      );
    }
  }

  // الحصول على كوبون بالـ ID
  async getCouponById(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { id } = req.params;

      const coupon = await CouponService.getCouponById(id, lang);

      return CouponController.successResponse(
        res,
        {
          coupon,
        },
        lang === "ar" ? "تم جلب الكوبون بنجاح" : "Coupon fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch coupon", 500)
      );
    }
  }

  // الحصول على كوبون بالكود
  async getCouponByCode(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { code } = req.params;

      const coupon = await CouponService.getCouponByCode(code, lang);

      return CouponController.successResponse(
        res,
        {
          coupon: coupon.toLocalizedJSON(lang),
        },
        lang === "ar" ? "تم جلب الكوبون بنجاح" : "Coupon fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to fetch coupon", 500)
      );
    }
  }

  // ==================== CRUD Methods ====================

  // إنشاء كوبون جديد
  async createCoupon(req, res, next) {
    try {
      console.log(
        "Creating coupon with body:",
        JSON.stringify(req.body, null, 2)
      );
      const lang = CouponController.getLang(req);

      const coupon = await CouponService.createCoupon(req.body, lang);

      return CouponController.successResponse(
        res,
        {
          coupon,
        },
        lang === "ar"
          ? "تم إنشاء الكوبون بنجاح"
          : "Coupon created successfully",
        201
      );
    } catch (error) {
      console.error("Error creating coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to create coupon", 500)
      );
    }
  }

  // تحديث كوبون
  async updateCoupon(req, res, next) {
    try {
      console.log(
        `Updating coupon ${req.params.id} with body:`,
        JSON.stringify(req.body, null, 2)
      );
      const lang = CouponController.getLang(req);
      const { id } = req.params;

      const coupon = await CouponService.updateCoupon(id, req.body, lang);

      return CouponController.successResponse(
        res,
        {
          coupon,
        },
        lang === "ar" ? "تم تحديث الكوبون بنجاح" : "Coupon updated successfully"
      );
    } catch (error) {
      console.error("Error updating coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to update coupon", 500)
      );
    }
  }

  // حذف كوبون
  async deleteCoupon(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { id } = req.params;

      const result = await CouponService.deleteCoupon(id, lang);

      return CouponController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error("Error deleting coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to delete coupon", 500)
      );
    }
  }

  // ==================== Validation & Usage ====================

  // التحقق من صحة الكوبون
  async validateCoupon(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { code } = req.params;
      const userId = req.user?._id;
      const { subtotal, items, paymentMethod } = req.body;

      if (!subtotal || !items) {
        return next(
          new AppError(
            lang === "ar" ? "بيانات السلة مطلوبة" : "Cart data is required",
            400
          )
        );
      }

      const cartData = {
        subtotal: parseFloat(subtotal),
        items: items || [],
        paymentMethod: paymentMethod || "cod",
      };

      const validation = await CouponService.validateCoupon(
        code,
        userId,
        cartData,
        lang
      );

      return CouponController.successResponse(res, {
        valid: validation.valid,
        message: validation.message,
        coupon: validation.coupon,
        discount: validation.discount,
      });
    } catch (error) {
      console.error("Error validating coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to validate coupon", 500)
      );
    }
  }

  // تطبيق الكوبون
  async applyCoupon(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { code } = req.params;
      const userId = req.user._id;
      const { subtotal, items, paymentMethod } = req.body;

      if (!subtotal || !items) {
        return next(
          new AppError(
            lang === "ar" ? "بيانات السلة مطلوبة" : "Cart data is required",
            400
          )
        );
      }

      const cartData = {
        subtotal: parseFloat(subtotal),
        items: items || [],
        paymentMethod: paymentMethod || "cod",
      };

      const result = await CouponService.applyCoupon(
        code,
        userId,
        cartData,
        lang
      );

      return CouponController.successResponse(
        res,
        {
          coupon: result.coupon,
          discount: result.discount,
          discountedTotal: result.discountedTotal,
        },
        result.message
      );
    } catch (error) {
      console.error("Error applying coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to apply coupon", 500)
      );
    }
  }

  // حساب الخصم (للتوافق مع الكود القديم)
  async calculateDiscount(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { code } = req.params;
      const { total } = req.query;

      if (!total || isNaN(total)) {
        return next(
          new AppError(
            lang === "ar"
              ? "المبلغ الإجمالي مطلوب"
              : "Total amount is required",
            400
          )
        );
      }

      const coupon = await CouponService.getCouponByCode(code, lang);

      if (!coupon.isValid) {
        return res.json({
          error: lang === "ar" ? "الكوبون غير صالح" : "Coupon is not valid",
        });
      }

      const amount = parseFloat(total);
      const discount = coupon.calculateDiscount(amount);
      const discountedTotal = amount - discount;

      return res.json({
        discount,
        discountedTotal,
        discountPercentage:
          coupon.discountType === "percentage" ? coupon.discountValue : null,
        discountType: coupon.discountType,
      });
    } catch (error) {
      console.error("Error calculating discount:", error);
      return res.json({
        error:
          lang === "ar" ? "فشل حساب الخصم" : "Failed to calculate discount",
      });
    }
  }

  // ==================== Statistics ====================

  // إحصائيات الكوبونات
  async getCouponStats(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const stats = await CouponService.getCouponStats();

      return CouponController.successResponse(
        res,
        {
          stats,
        },
        lang === "ar" ? "تم جلب الإحصائيات بنجاح" : "Stats fetched successfully"
      );
    } catch (error) {
      console.error("Error getting coupon stats:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to get coupon stats", 500)
      );
    }
  }

  // تبديل حالة التفعيل
  async toggleActiveStatus(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { id } = req.params;

      const coupon = await CouponService.toggleActiveStatus(id, lang);

      return CouponController.successResponse(
        res,
        {
          coupon,
        },
        lang === "ar" ? "تم تغيير حالة الكوبون" : "Coupon status toggled"
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

  // نسخ كوبون
  async duplicateCoupon(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { id } = req.params;

      const coupon = await CouponService.getCouponById(id, lang);

      // إنشاء نسخة جديدة
      const newCouponData = {
        ...coupon,
        code: `${coupon.code}-COPY`,
        nameEn: `${coupon.nameEn} (Copy)`,
        nameAr: `${coupon.nameAr} (نسخة)`,
        isActive: false,
        usageCount: 0,
        usedBy: [],
      };

      delete newCouponData._id;
      delete newCouponData.createdAt;
      delete newCouponData.updatedAt;

      const newCoupon = await CouponService.createCoupon(newCouponData, lang);

      return CouponController.successResponse(
        res,
        {
          coupon: newCoupon,
        },
        lang === "ar"
          ? "تم نسخ الكوبون بنجاح"
          : "Coupon duplicated successfully",
        201
      );
    } catch (error) {
      console.error("Error duplicating coupon:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to duplicate coupon", 500)
      );
    }
  }

  // الحصول على سجل استخدام الكوبون
  async getCouponUsageHistory(req, res, next) {
    try {
      const lang = CouponController.getLang(req);
      const { id } = req.params;

      const coupon = await CouponService.getCouponById(id, lang);

      // الحصول على المستخدمين الذين استخدموا الكوبون
      const usageHistory = await CouponModel.findById(id)
        .select("usedBy")
        .populate("usedBy.user", "firstName lastName email");

      return CouponController.successResponse(
        res,
        {
          usage: usageHistory.usedBy,
          totalUses: coupon.usageCount,
        },
        lang === "ar"
          ? "تم جلب سجل الاستخدام بنجاح"
          : "Usage history fetched successfully"
      );
    } catch (error) {
      console.error("Error getting usage history:", error);
      next(
        error instanceof AppError
          ? error
          : new AppError("Failed to get usage history", 500)
      );
    }
  }
}

module.exports = new CouponController();
