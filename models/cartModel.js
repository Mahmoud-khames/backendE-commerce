const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  size: String,
  color: String,
  price: Number,
  discount: Number,
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
  totalPrice: {
    type: Number,
    default: 0,
  },
  totalDiscount: {
    type: Number,
    default: 0,
  },
  coupon: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
});

// Middleware لحساب الإجماليات تلقائياً
cartSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  
  let total = 0;
  let discount = 0;
  
  this.items.forEach(item => {
    total += item.price * item.quantity;
    discount += (item.discount || 0) * item.quantity;
  });
  
  this.totalPrice = total;
  this.totalDiscount = discount;
  
  next();
});

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;