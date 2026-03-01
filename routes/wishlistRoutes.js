// routes/wishlistRoutes.js
const express = require('express');
const router = express.Router();
const WishlistController = require('../controllers/wishlist.controller');
const { authMiddleware } = require('../middlewares/authMiddleware');

// جميع المسارات تتطلب تسجيل الدخول
router.use(authMiddleware);

// الحصول على wishlist / إضافة منتج
router.route('/')
  .get(WishlistController.getWishlist)
  .post(WishlistController.addToWishlist);

// Toggle منتج (إضافة أو إزالة)
router.post('/toggle', WishlistController.toggleProduct);

// مسح الـ wishlist
router.delete('/clear', WishlistController.clearWishlist);

// عدد المنتجات
router.get('/count', WishlistController.getCount);

// التحقق من وجود منتج / إزالة منتج
router.route('/:productId')
  .get(WishlistController.checkProduct)
  .delete(WishlistController.removeFromWishlist);

module.exports = router;