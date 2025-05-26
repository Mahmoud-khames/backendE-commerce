const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 0,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
  },
  images: [
    {
      type: String,
    },
  ],
  status: {
    type: Boolean,
    default: true,
  },
},
  { timestamps: true }
);

// Middleware to update product's reviews and rating when a review is saved
reviewSchema.post('save', async function() {
  try {
    // Get the Product model
    const Product = mongoose.model('Product');
    
    // Add this review to the product's productReviews array
    await Product.findByIdAndUpdate(
      this.product,
      { $addToSet: { productReviews: this._id } }
    );
    
    // Calculate and update the average rating
    const reviews = await this.constructor.find({ product: this.product });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
    
    await Product.findByIdAndUpdate(
      this.product,
      { productRating: averageRating }
    );
  } catch (error) {
    console.error('Error updating product reviews:', error);
  }
});

// Middleware to update product when a review is deleted
reviewSchema.post('remove', async function() {
  try {
    const Product = mongoose.model('Product');
    
    // Remove this review from the product's productReviews array
    await Product.findByIdAndUpdate(
      this.product,
      { $pull: { productReviews: this._id } }
    );
    
    // Recalculate average rating
    const reviews = await this.constructor.find({ product: this.product });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
    
    await Product.findByIdAndUpdate(
      this.product,
      { productRating: averageRating }
    );
  } catch (error) {
    console.error('Error updating product after review deletion:', error);
  }
});

const reviewModel = mongoose.model("Review", reviewSchema);
module.exports = reviewModel;
