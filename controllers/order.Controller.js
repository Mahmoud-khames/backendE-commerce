const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const AppError = require("../utils/AppError");

class OrderController {
  async getAllOrders(req, res, next) {
    try {
      const orders = await Order.find({ isDeleted: false })
        .populate("user", "firstName lastName email")
        .populate("items.product", "productName productImage productPrice")
        .sort({ createdAt: -1 });
      
      res.status(200).json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      next(new AppError("Failed to fetch orders", 500));
    }
  }

  async getOrderById(req, res, next) {
    try {
      const { id } = req.params;
      const order = await Order.findById(id)
        .populate("user", "firstName lastName email")
        .populate("items.product", "productName productImage productPrice");
      
      if (!order) {
        return next(new AppError("Order not found", 404));
      }
      
      res.status(200).json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      next(new AppError("Failed to fetch order", 500));
    }
  }

  async updateOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const order = await Order.findByIdAndUpdate(
        id, 
        { status }, 
        { new: true }
      );
      
      if (!order) {
        return next(new AppError("Order not found", 404));
      }
      
      res.status(200).json({
        success: true,
        message: "Order updated successfully",
        data: order
      });
    } catch (error) {
      console.error("Error updating order:", error);
      next(new AppError("Failed to update order", 500));
    }
  }

  async deleteOrder(req, res, next) {
    try {
      const { id } = req.params;
      
      const order = await Order.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
      );
      
      if (!order) {
        return next(new AppError("Order not found", 404));
      }
      
      res.status(200).json({
        success: true,
        message: "Order deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting order:", error);
      next(new AppError("Failed to delete order", 500));
    }
  }

  async createOrder(req, res, next) {
    try {
      const { 
        shippingAddress, 
        phoneNumber, 
        paymentMethod,
        couponApplied,
        discountAmount,
        totalAmount
      } = req.body;
      
      const userId = req.user._id;
      
      // Get user's cart
      const cart = await Cart.findOne({ user: userId }).populate("items.product");
      
      if (!cart || cart.items.length === 0) {
        return next(new AppError("Cart is empty", 400));
      }
      
      // Create order items from cart items
      const orderItems = cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.productPrice,
        size: item.size || null,
        color: item.color || null
      }));
      
      // Create the order
      const order = await Order.create({
        items: orderItems,
        user: userId,
        totalAmount: totalAmount || cart.totalPrice,
        shippingAddress,
        phoneNumber,
        paymentMethod: paymentMethod || "Cash on Delivery",
        couponApplied,
        discountAmount: discountAmount || 0
      });
      
      // Clear the cart after order is created
      await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [], totalPrice: 0, totalDiscount: 0 } }
      );
      
      res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order
      });
    } catch (error) {
      console.error("Error creating order:", error);
      next(new AppError("Failed to create order", 500));
    }
  }

  async getUserOrders(req, res, next) {
    try {
      const userId = req.user._id;
      
      const orders = await Order.find({ 
        user: userId,
        isDeleted: false 
      })
        .populate("items.product", "productName productImage productPrice")
        .sort({ createdAt: -1 });
      
      res.status(200).json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error("Error fetching user orders:", error);
      next(new AppError("Failed to fetch orders", 500));
    }
  }

  async getOrdersCount(req, res, next) {
    try {
      const count = await Order.countDocuments({ isDeleted: false });
   
      res.status(200).json({
        success: true,
        count,
      });
    } catch (error) {
      console.error("Error counting orders:", error);
      next(new AppError("Failed to count orders", 500));
    }
  }
}

const orderController = new OrderController();
module.exports = orderController;
