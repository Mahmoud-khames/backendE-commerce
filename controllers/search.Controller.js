// controllers/search.Controller.js
const SearchService = require('../services/searchService');
const asyncHandler = require('express-async-handler');
const AppError = require('../utils/AppError');

class SearchController {
  // البحث الذكي
  smartSearch = asyncHandler(async (req, res) => {
    const { 
      q, 
      query,
      page = 1, 
      limit = 12,
      categories,
      minPrice,
      maxPrice,
      colors,
      sizes,
      sort,
      includeOutOfStock,
      lang = 'en'
    } = req.query;
    
    const searchQuery = q || query;
    
    if (!searchQuery || searchQuery.trim() === '') {
      throw new AppError(
        lang === 'ar' ? 'كلمة البحث مطلوبة' : 'Search query is required',
        400
      );
    }
    
    const options = {
      lang: lang || req.headers['accept-language']?.split(',')[0] || 'en',
      page: parseInt(page),
      limit: parseInt(limit),
      categories: categories ? categories.split(',') : [],
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      colors: colors ? colors.split(',') : [],
      sizes: sizes ? sizes.split(',') : [],
      sortBy: sort || 'relevance',
      includeOutOfStock: includeOutOfStock === 'true',
      userId: req.user?.id
    };
    
    const result = await SearchService.smartSearch(searchQuery, options);
    
    res.status(200).json({
      success: true,
      data: result.products,
      pagination: result.pagination,
      searchInfo: result.searchInfo,
      filters: result.filters
    });
  });
  
  // اقتراحات البحث
  getSuggestions = asyncHandler(async (req, res) => {
    const { q, query, limit = 10, lang = 'en' } = req.query;
    const searchQuery = q || query || '';
    
    const suggestions = await SearchService.getSearchSuggestions(
      searchQuery,
      lang,
      parseInt(limit),
      req.user?.id
    );
    
    res.status(200).json({
      success: true,
      ...suggestions
    });
  });
  
  // البحوث الشائعة
  getTrendingSearches = asyncHandler(async (req, res) => {
    const { limit = 10, lang = 'en' } = req.query;
    
    const trending = await SearchService.getTrendingSearches(
      lang,
      parseInt(limit)
    );
    
    res.status(200).json({
      success: true,
      trending
    });
  });
  
  // تتبع البحث
  trackSearch = asyncHandler(async (req, res) => {
    const { query, resultsCount, clickedProduct, sessionId } = req.body;
    
    const result = await SearchService.trackSearch({
      query,
      userId: req.user?.id,
      resultsCount,
      clickedProduct,
      sessionId
    });
    
    res.status(200).json(result);
  });
  
  // تحليلات البحث (للإدارة)
  getAnalytics = asyncHandler(async (req, res) => {
    const { period = '7d' } = req.query;
    
    const analytics = await SearchService.getSearchAnalytics(period);
    
    res.status(200).json({
      success: true,
      analytics
    });
  });
  
  // مسح سجل البحث للمستخدم
  clearUserSearchHistory = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    
    await SearchService.clearUserHistory(req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Search history cleared'
    });
  });
}

module.exports = new SearchController();