// controllers/orderController.js
const OrderService = require('../services/order.service');
const AppError = require('../utils/AppError');

class OrderController {
  // Helper للحصول على اللغة
  static getLang(req) {
    return req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
           req.query.lang || 
           'en';
  }

  // Helper للاستجابة
  static successResponse(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...data
    });
  }

  // ==================== Query Methods ====================

  // الحصول على جميع الطلبات (للإدارة)
  async getAllOrders(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { result } = await OrderService.getOrders(req.query, lang);
      
      return OrderController.successResponse(res, {
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          perPage: result.perPage,
          totalPages: result.totalPages
        }
      }, lang === 'ar' ? 'تم جلب الطلبات بنجاح' : 'Orders fetched successfully');
    } catch (error) {
      console.error('Error fetching orders:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch orders', 500));
    }
  }

  // الحصول على طلبات المستخدم
  async getUserOrders(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const userId = req.user._id;
      
      const result = await OrderService.getUserOrders(userId, req.query, lang);
      
      return OrderController.successResponse(res, {
        data: result.orders,
        pagination: result.pagination
      }, lang === 'ar' ? 'تم جلب طلباتك بنجاح' : 'Your orders fetched successfully');
    } catch (error) {
      console.error('Error fetching user orders:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch orders', 500));
    }
  }

  // الحصول على طلب بالـ ID
  async getOrderById(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { id } = req.params;
      const userId = req.user._id;
      const isAdmin = req.user.role === 'admin';
      
      const order = await OrderService.getOrderById(id, lang);
      
      // التحقق من الصلاحيات
      if (!isAdmin && order.user._id.toString() !== userId.toString()) {
        return next(new AppError(
          lang === 'ar' ? 'غير مصرح لك بعرض هذا الطلب' : 'Not authorized to view this order',
          403
        ));
      }
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم جلب الطلب بنجاح' : 'Order fetched successfully');
    } catch (error) {
      console.error('Error fetching order:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch order', 500));
    }
  }

  // الحصول على طلب برقم الطلب
  async getOrderByNumber(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { orderNumber } = req.params;
      
      const order = await OrderService.getOrderByNumber(orderNumber, lang);
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم جلب الطلب بنجاح' : 'Order fetched successfully');
    } catch (error) {
      console.error('Error fetching order:', error);
      next(error instanceof AppError ? error : new AppError('Failed to fetch order', 500));
    }
  }

  // ==================== CRUD Methods ====================

  // إنشاء طلب جديد
  async createOrder(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const userId = req.user._id;
      
      const order = await OrderService.createOrder(userId, req.body, lang);
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', 201);
    } catch (error) {
      console.error('Error creating order:', error);
      next(error instanceof AppError ? error : new AppError('Failed to create order', 500));
    }
  }

  // تحديث حالة الطلب (للإدارة)
  async updateOrderStatus(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { id } = req.params;
      const { status, note } = req.body;
      const changedBy = req.user._id;
      
      if (!status) {
        return next(new AppError(
          lang === 'ar' ? 'الحالة مطلوبة' : 'Status is required',
          400
        ));
      }
      
      const order = await OrderService.updateOrderStatus(id, status, note, changedBy, lang);
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم تحديث حالة الطلب بنجاح' : 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update order', 500));
    }
  }

  // تحديث معلومات الشحن (للإدارة)
  async updateShippingInfo(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { id } = req.params;
      
      const order = await OrderService.updateShippingInfo(id, req.body, lang);
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم تحديث معلومات الشحن بنجاح' : 'Shipping info updated successfully');
    } catch (error) {
      console.error('Error updating shipping info:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update shipping info', 500));
    }
  }

  // تحديث حالة الدفع (للإدارة)
  async updatePaymentStatus(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { id } = req.params;
      const { paymentStatus, ...paymentDetails } = req.body;
      
      if (!paymentStatus) {
        return next(new AppError(
          lang === 'ar' ? 'حالة الدفع مطلوبة' : 'Payment status is required',
          400
        ));
      }
      
      const order = await OrderService.updatePaymentStatus(id, paymentStatus, paymentDetails, lang);
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم تحديث حالة الدفع بنجاح' : 'Payment status updated successfully');
    } catch (error) {
      console.error('Error updating payment status:', error);
      next(error instanceof AppError ? error : new AppError('Failed to update payment status', 500));
    }
  }

  // إلغاء الطلب
  async cancelOrder(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user._id;
      const isAdmin = req.user.role === 'admin';
      
      const order = await OrderService.cancelOrder(id, userId, reason, isAdmin, lang);
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم إلغاء الطلب بنجاح' : 'Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      next(error instanceof AppError ? error : new AppError('Failed to cancel order', 500));
    }
  }

  // طلب إرجاع
  async requestReturn(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user._id;
      
      if (!reason) {
        return next(new AppError(
          lang === 'ar' ? 'سبب الإرجاع مطلوب' : 'Return reason is required',
          400
        ));
      }
      
      const order = await OrderService.requestReturn(id, userId, reason, lang);
      
      return OrderController.successResponse(res, {
        data: order
      }, lang === 'ar' ? 'تم تقديم طلب الإرجاع بنجاح' : 'Return request submitted successfully');
    } catch (error) {
      console.error('Error requesting return:', error);
      next(error instanceof AppError ? error : new AppError('Failed to request return', 500));
    }
  }

  // حذف الطلب (للإدارة)
  async deleteOrder(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { id } = req.params;
      const userId = req.user._id;
      const isAdmin = req.user.role === 'admin';
      
      const result = await OrderService.deleteOrder(id, userId, isAdmin, lang);
      
      return OrderController.successResponse(res, {}, result.message);
    } catch (error) {
      console.error('Error deleting order:', error);
      next(error instanceof AppError ? error : new AppError('Failed to delete order', 500));
    }
  }

  // ==================== Statistics Methods ====================

  // عدد الطلبات
  async getOrdersCount(req, res, next) {
    try {
      const counts = await OrderService.getOrdersCount();
      
      return OrderController.successResponse(res, {
        ...counts
      });
    } catch (error) {
      console.error('Error counting orders:', error);
      next(error instanceof AppError ? error : new AppError('Failed to count orders', 500));
    }
  }

  // إحصائيات الطلبات
  async getOrderStats(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const stats = await OrderService.getOrderStats(req.query, lang);
      
      return OrderController.successResponse(res, {
        stats
      }, lang === 'ar' ? 'تم جلب الإحصائيات بنجاح' : 'Stats fetched successfully');
    } catch (error) {
      console.error('Error getting order stats:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get order stats', 500));
    }
  }

  // الإيرادات
  async getRevenue(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const revenue = await OrderService.getRevenue(req.query);
      
      return OrderController.successResponse(res, {
        data: revenue
      }, lang === 'ar' ? 'تم جلب الإيرادات بنجاح' : 'Revenue fetched successfully');
    } catch (error) {
      console.error('Error getting revenue:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get revenue', 500));
    }
  }

  // أفضل المنتجات مبيعاً
  async getTopSellingProducts(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const limit = parseInt(req.query.limit) || 10;
      
      const products = await OrderService.getTopSellingProducts(limit);
      
      // تنسيق الاستجابة حسب اللغة
      const formattedProducts = products.map(p => ({
        ...p,
        productName: lang === 'ar' ? p.productNameAr : p.productNameEn
      }));
      
      return OrderController.successResponse(res, {
        data: formattedProducts
      }, lang === 'ar' ? 'تم جلب المنتجات الأكثر مبيعاً' : 'Top selling products fetched successfully');
    } catch (error) {
      console.error('Error getting top selling products:', error);
      next(error instanceof AppError ? error : new AppError('Failed to get top selling products', 500));
    }
  }

  // تتبع الطلب
  async trackOrder(req, res, next) {
    try {
      const lang = OrderController.getLang(req);
      const { orderNumber } = req.params;
      
      const order = await OrderService.getOrderByNumber(orderNumber, lang);
      
      // إرجاع معلومات التتبع فقط
      const trackingInfo = {
        orderNumber: order.orderNumber,
        status: order.status,
        statusText: order.statusText,
        statusHistory: order.statusHistory,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        estimatedDeliveryDate: order.estimatedDeliveryDate,
        actualDeliveryDate: order.actualDeliveryDate,
        shippingMethod: order.shippingMethod
      };
      
      return OrderController.successResponse(res, {
        data: trackingInfo
      }, lang === 'ar' ? 'تم جلب معلومات التتبع بنجاح' : 'Tracking info fetched successfully');
    } catch (error) {
      console.error('Error tracking order:', error);
      next(error instanceof AppError ? error : new AppError('Failed to track order', 500));
    }
  }
}

module.exports = new OrderController();