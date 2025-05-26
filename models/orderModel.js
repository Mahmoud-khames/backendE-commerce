const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const orderItemSchema = new mongoose.Schema({
  product: {
    type: ObjectId,
    ref: "Product",
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  size: String,
  color: String
});

const orderSchema = new mongoose.Schema(
  {
    items: [orderItemSchema],
    user: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    shippingAddress: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash on Delivery", "PayPal", "Stripe"],
      default: "Cash on Delivery"
    },
    stripePaymentId: {
      type: String,
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending"
    },
    couponApplied: {
      type: String,
      default: null
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      default: "Pending",
      enum: [
        "Pending",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
