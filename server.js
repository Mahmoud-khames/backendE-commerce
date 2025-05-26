require('dotenv').config();
const express = require("express");
const app = express();
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const errorHandler = require("./middlewares/errorMiddleWare");

// Routers
const authRouter = require("./routes/authRouter");
const usersRouter = require("./routes/userRoutes");
const categoryRouter = require("./routes/categoryRouter");
const productRouter = require("./routes/productRouter");
const customizeRouter = require("./routes/customizeRouter");
const orderRouter = require("./routes/orderRouter");
const couponRouter = require("./routes/couponRouter");
const contactRouter = require("./routes/contactRouter");
const reviewRouter = require("./routes/reviewRouter");
const cartRouter = require("./routes/cartRoutes");
const wishlistRouter = require("./routes/wishlistRoutes");
const stripeRouter = require("./routes/stripeRouter");

// Environment
dotenv.config();

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000", // Match your frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"], 
    allowedHeaders: ["Content-Type", "Authorization"],
  })
); 
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Serve static files
app.use("/backend/uploads/products", express.static(path.join(__dirname, "public/uploads/products")));
app.use("/backend/uploads/users", express.static(path.join(__dirname, "public/uploads/users")));
app.use("/backend/uploads/categories", express.static(path.join(__dirname, "public/uploads/categories")));
app.use("/backend/uploads/customize", express.static(path.join(__dirname, "public/uploads/customize")));
app.use("/backend/uploads/reviews", express.static(path.join(__dirname, "public/uploads/reviews")));

// Database
connectDB();

// Routes
app.use("/api/auth", authRouter);
app.use("/api/user", usersRouter);
app.use("/api/category", categoryRouter);
app.use("/api/product", productRouter);
app.use("/api/order", orderRouter);
app.use("/api/customize", customizeRouter);
app.use("/api/coupon", couponRouter);
app.use("/api/contact", contactRouter);
app.use("/api/review", reviewRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/stripe", stripeRouter);

// Error handler
app.use(errorHandler); 

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}!`);
  console.log(`Stripe webhook endpoint: ${process.env.BACKEND_URL}/api/stripe/webhook`);
});
  