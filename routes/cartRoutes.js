const express = require("express");
const cartController = require("../controllers/cart.Controller");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router(); 

router.use(authMiddleware);


router.route("/").get(cartController.getCart).post(cartController.addToCart);

router
  .route("/:id")
  .put(cartController.updateCartItem) 
  .delete(cartController.removeFromCart);

// // Fix: Use route instead of delete directly
router.route("/clear").delete(cartController.clearCart);
 
module.exports = router;
