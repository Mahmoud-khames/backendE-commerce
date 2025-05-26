const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
    },
    discount: {
      type: Number,
      required: true,
    },
    expiry: {
      type: Date,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  
    maxUses: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const couponModel = mongoose.model("Coupon", couponSchema);

module.exports = couponModel;
