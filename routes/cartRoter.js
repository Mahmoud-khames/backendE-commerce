const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
router.get("/", authMiddleware, cartController.getCart);
router.post("/", authMiddleware, cartController.addToCart);
router.put("/:id", authMiddleware, cartController.updateCartItem);
router.delete("/:id", authMiddleware, cartController.removeFromCart);

module.exports = router;
