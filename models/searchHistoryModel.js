const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionId: {
      type: String,
      default: null,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    language: {
      type: String,
      default: "en",
      enum: ["en", "ar"],
    },
    searchCount: {
      type: Number,
      default: 1,
    },
    resultsCount: {
      type: Number,
      default: 0,
    },
    clickedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    lastSearched: {
      type: Date,
      default: Date.now,
    },
    // Adding timestamp field to match usage in searchService.js,
    // although createdAt is primarily used for queries.
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
searchHistorySchema.index({ query: 1 });
searchHistorySchema.index({ userId: 1 });
searchHistorySchema.index({ createdAt: -1 });
searchHistorySchema.index({ searchCount: -1 });

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
