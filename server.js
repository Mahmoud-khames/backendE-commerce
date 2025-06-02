require("dotenv").config();
const express = require("express");
const app = express();
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

// Middleware
const allowedOrigins = [
  "https://front-end-e-commerce-seto.vercel.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Handle Stripe webhook separately (needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    next();
  } else {
    express.json({ limit: "10mb" })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware


// Configure Cloudinary
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Connect to database
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

// Serve static files (if needed)
if (process.env.NODE_ENV === 'production') {  
  app.use(express.static(path.join(__dirname, 'public')));
}

// Error handler 
app.use(errorHandler); 
app.use(morgan("dev"));
// Start server
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}!`);
  console.log(`Stripe webhook endpoint: ${process.env.BACKEND_URL}/api/stripe/webhook`);
}); 
 
// Basic route for testing
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
