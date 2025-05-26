const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripe.controller");
const { authMiddleware } = require("../middlewares/authMiddleware");

// تأكد من أن المسار متطابق مع ما تستدعيه من الفرونت اند
router.post("/create-checkout-session", authMiddleware, stripeController.createCheckoutSession);
router.post("/webhook", express.raw({type: 'application/json'}), stripeController.handleWebhook);
router.get("/payment-success", stripeController.paymentSuccess);
router.get("/payment-cancel", stripeController.paymentCancel);
router.get("/verify-payment", stripeController.verifyPayment); // إضافة هذا المسار

module.exports = router;
