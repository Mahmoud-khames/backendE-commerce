const mongoose = require("mongoose");

const customizeSchema = new mongoose.Schema(
  {
    slideImage: {
      type: Array,
      default: [],
    },
    firstShow: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    title: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    }
  },
  { timestamps: true }
);

const customizeModel = mongoose.model("Customize", customizeSchema);
module.exports = customizeModel;
