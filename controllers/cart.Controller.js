const Cart = require("../models/cartModel");
const AppError = require("../utils/AppError");

class CartController {
  async getCart(req, res, next) {
    const userId = req.user._id;
    try {
      const cart = await Cart.findOne({ user: userId })
        .populate("items.product");
      
      if (!cart) {
        return res.status(200).json({
          status: "success",
          data: { items: [], totalPrice: 0, totalDiscount: 0 }
        });
      }
      
      res.status(200).json({
        status: "success",
        data: cart,
      });
    } catch (err) {
      next(err);
    }
  }

  async addToCart(req, res, next) {
    const { productId, quantity, size, color } = req.body;
    const userId = req.user._id;

    try {
      let cart = await Cart.findOne({ user: userId });

      if (cart) {
        const itemIndex = cart.items.findIndex(
          (item) => item.product.toString() === productId
        );
      
        if (itemIndex > -1) {
          cart.items[itemIndex].quantity += quantity;
        } else {
          cart.items.push({ 
            product: productId, 
            quantity,
            size,
            color,
            price: req.body.price || 0,
            discount: req.body.discount || 0
          });
        }
      
        await cart.save();
      } else {
        cart = await Cart.create({
          user: userId,
          items: [{ 
            product: productId, 
            quantity,
            size,
            color,
            price: req.body.price || 0,
            discount: req.body.discount || 0
          }]
        });
      }
      
      // Populate the product details before sending the response
      await cart.populate('items.product');
      
      res.status(200).json({
        status: "success",
        data: cart
      });
    } catch (error) {
      return next(new AppError("Failed to add product to cart", 500));
    }
  }

  async removeFromCart(req, res, next) {
    const productId = req.params.id;
    const userId = req.user._id;

    try {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        return next(new AppError("Cart not found", 404));
      }
      
      cart.items = cart.items.filter(item => item.product.toString() !== productId);
      await cart.save();
      
      // Populate the product details before sending the response
      await cart.populate('items.product');
      
      return res.status(200).json({
        status: "success",
        data: cart
      });
    } catch (error) {
      return next(new AppError("Failed to remove product from cart", 500));
    }
  }

  async updateCartItem(req, res, next) {
    const productId = req.params.id;
    const { quantity } = req.body;
    const userId = req.user._id;

    try {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        return next(new AppError("Cart not found", 404));
      }
      
      const itemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
      );
      
      if (itemIndex === -1) {
        return next(new AppError("Product not found in cart", 404));
      }
      
      cart.items[itemIndex].quantity = quantity;
      await cart.save();
      
      // Populate the product details before sending the response
      await cart.populate('items.product');
      
      return res.status(200).json({
        status: "success",
        data: cart
      });
    } catch (error) {
      return next(new AppError("Failed to update cart item", 500));
    }
  }

  async clearCart(req, res, next) {
    const userId = req.user._id;

    try {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        return res.status(200).json({
          status: "success",
          data: { items: [], totalPrice: 0, totalDiscount: 0 }
        });
      }
      
      cart.items = [];
      await cart.save();
      
      return res.status(200).json({
        status: "success",
        data: cart
      });
    } catch (error) {
      return next(new AppError("Failed to clear cart", 500));
    }
  }
}

const   cartController   = new CartController();

  module.exports = cartController;
