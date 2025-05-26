const Wishlist = require("../models/wishlistModel");
const Product = require("../models/productModel");
const AppError = require("../utils/AppError");
const  StatusCodes  = require("../utils/http-status-codes");

// Get user's wishlist
const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(userId);
    // Find or create the user's wishlist
    let wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: "products",
      select:
        "_id productName productPrice productDescription productImage productCategory productBrand productQuantity productSizes productColors productRating",
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
      wishlist = await wishlist.populate({
        path: "products",
        select:
          "_id productName productPrice productDescription productImage productCategory productBrand productQuantity productSizes productColors productRating",
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        wishlist: wishlist.products,
      },
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Add product to wishlist
const addToWishlist = async (req, res, next) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!productId) {
    next(new AppError("Product ID is required", 400));
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    next(new AppError("Product not found", 404));
  }

  // Find or create the user's wishlist
  let wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, products: [productId] });
  } else {
    // Check if product is already in wishlist
    if (wishlist.products.includes(productId)) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Product already in wishlist",
        data: {
          wishlist: await getPopulatedWishlist(userId),
        },
      });
    }

    // Add product to wishlist
    wishlist.products.push(productId);
    await wishlist.save();
  }

  // Get populated wishlist
  const populatedWishlist = await getPopulatedWishlist(userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Product added to wishlist",
    data: {
      wishlist: populatedWishlist,
    },
  });
};

// Remove product from wishlist
const removeFromWishlist = async (req, res, next) => {
  const userId = req.user._id;
  const { productId } = req.params;

  if (!productId) {
    next(new AppError("Product ID is required", 400));
  }

  // Find the user's wishlist
  const wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    next(new AppError("Wishlist not found", 404));
  }

  // Remove product from wishlist
  wishlist.products = wishlist.products.filter(
    (id) => id.toString() !== productId
  );

  await wishlist.save();

  // Get populated wishlist
  const populatedWishlist = await getPopulatedWishlist(userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Product removed from wishlist",
    data: {
      wishlist: populatedWishlist,
    },
  });
};

// Clear wishlist
const clearWishlist = async (req, res) => {
  const userId = req.user._id;

  // Find the user's wishlist
  const wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Wishlist cleared",
      data: {
        wishlist: [],
      },
    });
  }

  // Clear wishlist
  wishlist.products = [];
  await wishlist.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Wishlist cleared",
    data: {
      wishlist: [],
    },
  });
};

// Helper function to get populated wishlist
const getPopulatedWishlist = async (userId) => {
  const wishlist = await Wishlist.findOne({ user: userId }).populate({
    path: "products",
    select:
      "_id productName productPrice productDescription productImage productCategory productBrand productQuantity productSizes productColors productRating",
  });

  return wishlist ? wishlist.products : [];
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
};
