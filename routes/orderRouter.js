const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware"); 

// Admin routes
router.get("/", authMiddleware, isAdmin, orderController.getAllOrders); 
router.get("/dashboard/count", authMiddleware, isAdmin, orderController.getOrdersCount);

// User routes
router.get("/user", authMiddleware, orderController.getUserOrders);
router.post("/", authMiddleware, orderController.createOrder);

// Common routes with authorization
router.get("/:id", authMiddleware, orderController.getOrderById);
router.put("/:id", authMiddleware, isAdmin, orderController.updateOrder);
router.delete("/:id", authMiddleware, isAdmin, orderController.deleteOrder);

module.exports = router;
