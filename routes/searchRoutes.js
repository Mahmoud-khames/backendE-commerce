// routes/searchRoutes.js
const express = require("express");
const router = express.Router();
const SearchController = require("../controllers/search.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// البحث الذكي
router.get("/", SearchController.smartSearch);

// اقتراحات البحث
router.get("/suggestions", SearchController.getSuggestions);

// البحوث الشائعة
router.get("/trending", SearchController.getTrendingSearches);

// تتبع البحث
router.post("/track", SearchController.trackSearch);

// مسح سجل البحث (للمستخدمين المسجلين)
router.delete("/history", authMiddleware, SearchController.clearUserSearchHistory);

// تحليلات البحث (للإدارة)
router.get("/analytics", authMiddleware, isAdmin, SearchController.getAnalytics);

module.exports = router;