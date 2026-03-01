// services/searchService.js
const ProductModel = require("../models/productModel");
const CategoryModel = require("../models/categoryModel");
const SearchHistoryModel = require("../models/searchHistoryModel");
const AppError = require("../utils/AppError");
const natural = require("natural");
const Fuse = require("fuse.js");
const searchCache = require("../utils/searchCache");

class SearchService {
  constructor() {
    // إعداد معالج اللغة الطبيعية
    this.tokenizer = new natural.WordTokenizer();
    this.stemmerEn = natural.PorterStemmer;
    this.metaphone = new natural.Metaphone();

    // إعداد المرادفات
    this.synonyms = {
      en: {
        phone: [
          "mobile",
          "smartphone",
          "device",
          "cellphone",
          "iphone",
          "android",
        ],
        laptop: [
          "notebook",
          "computer",
          "pc",
          "macbook",
          "dell",
          "hp",
          "lenovo",
        ],
        shirt: ["tshirt", "t-shirt", "top", "blouse", "polo"],
        shoes: ["sneakers", "footwear", "boots", "sandals", "slippers"],
        watch: ["smartwatch", "timepiece", "clock"],
        headphones: ["earphones", "earbuds", "headset", "airpods"],
        bag: ["backpack", "handbag", "purse", "luggage", "suitcase"],
        dress: ["gown", "frock", "outfit"],
        jacket: ["coat", "blazer", "hoodie", "sweater"],
        pants: ["trousers", "jeans", "leggings", "shorts"],
      },
      ar: {
        هاتف: ["جوال", "موبايل", "تليفون", "ايفون", "اندرويد", "سمارت فون"],
        حاسوب: ["لابتوب", "كمبيوتر", "حاسب", "ماك بوك", "ديل"],
        قميص: ["تيشيرت", "بلوزة", "تي شيرت", "بولو"],
        حذاء: ["جزمة", "بوت", "شوز", "صندل", "شبشب", "كوتشي"],
        ساعة: ["ساعة ذكية", "ساعة يد"],
        سماعات: ["سماعة", "ايربودز", "هيدفون"],
        حقيبة: ["شنطة", "محفظة", "باك باك", "حقيبة ظهر"],
        فستان: ["ثوب", "رداء"],
        جاكيت: ["معطف", "بليزر", "هودي", "كنزة"],
        بنطلون: ["بنطال", "جينز", "شورت"],
      },
    };

    // كلمات التوقف
    this.stopWords = {
      en: [
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "from",
        "is",
        "was",
        "are",
        "were",
      ],
      ar: [
        "في",
        "من",
        "إلى",
        "على",
        "عن",
        "مع",
        "هذا",
        "هذه",
        "ذلك",
        "التي",
        "الذي",
        "كان",
        "هو",
        "هي",
      ],
    };

    // تصحيحات إملائية شائعة
    this.spellCorrections = {
      iphon: "iphone",
      samsnug: "samsung",
      addidas: "adidas",
      nikee: "nike",
      labtop: "laptop",
      computr: "computer",
      shose: "shoes",
      dres: "dress",
      jaket: "jacket",
    };
  }

  // معالجة نص البحث
  processSearchQuery(query, lang = "en") {
    if (!query)
      return {
        original: "",
        processed: "",
        tokens: [],
        expandedTokens: [],
        stemmedTokens: [],
      };

    // تحويل لأحرف صغيرة
    let processed = query.toLowerCase().trim();

    // تطبيق التصحيحات الإملائية
    Object.keys(this.spellCorrections).forEach((wrong) => {
      const correct = this.spellCorrections[wrong];
      processed = processed.replace(new RegExp(wrong, "g"), correct);
    });

    // إزالة الأحرف الخاصة مع الحفاظ على الأرقام والحروف العربية
    processed = processed.replace(/[^\w\s\u0600-\u06FF\u0750-\u077F]/g, " ");

    // تقسيم الكلمات ببساطة بناءً على المسافات لأننا قمنا بتنظيف النص مسبقاً
    let tokens = processed.split(/\s+/).filter((t) => t.length > 0);

    // إزالة كلمات التوقف
    tokens = tokens.filter(
      (token) =>
        !this.stopWords[lang]?.includes(token.toLowerCase()) && token.length > 1
    );

    // إضافة المرادفات
    const expandedTokens = [];
    tokens.forEach((token) => {
      expandedTokens.push(token);
      const syns = this.synonyms[lang]?.[token.toLowerCase()];
      if (syns) {
        expandedTokens.push(...syns);
      }
    });

    // Stemming للغة الإنجليزية
    const stemmedTokens =
      lang === "en"
        ? expandedTokens.map((token) => this.stemmerEn.stem(token))
        : expandedTokens;

    // Metaphone للبحث الصوتي (للإنجليزية فقط)
    const phoneticTokens =
      lang === "en" ? tokens.map((token) => this.metaphone.process(token)) : [];

    return {
      original: query,
      processed: processed,
      tokens: [...new Set(tokens)],
      expandedTokens: [...new Set(expandedTokens)],
      stemmedTokens: [...new Set(stemmedTokens)],
      phoneticTokens: [...new Set(phoneticTokens)],
    };
  }

  // البحث الذكي الرئيسي
  async smartSearch(query, options = {}) {
    const {
      lang = "en",
      page = 1,
      limit = 12,
      categories = [],
      minPrice = null,
      maxPrice = null,
      colors = [],
      sizes = [],
      includeOutOfStock = false,
      sortBy = "relevance",
      userId = null,
    } = options;

    const skip = (page - 1) * limit;

    // التحقق من الكاش أولاً
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cachedResult = await searchCache.getCachedSearch(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // معالجة الاستعلام
    const processedQuery = this.processSearchQuery(query, lang);

    // حفظ في سجل البحث
    if (userId) {
      await this.saveSearchHistory(userId, query, lang);
    }

    // بناء فلتر البحث الأساسي
    const baseFilter = {
      isDeleted: false,
      productStatus: true,
    };

    if (!includeOutOfStock) {
      baseFilter.productQuantity = { $gt: 0 };
    }

    if (categories && categories.length > 0) {
      baseFilter.productCategory = { $in: categories };
    }

    if (minPrice !== null || maxPrice !== null) {
      baseFilter.productPrice = {};
      if (minPrice !== null) baseFilter.productPrice.$gte = minPrice;
      if (maxPrice !== null) baseFilter.productPrice.$lte = maxPrice;
    }

    if (colors && colors.length > 0) {
      baseFilter.$or = [
        { productColorsEn: { $in: colors } },
        { productColorsAr: { $in: colors } },
      ];
    }

    if (sizes && sizes.length > 0) {
      const sizeFilter = baseFilter.$or || [];
      sizeFilter.push(
        { productSizesEn: { $in: sizes } },
        { productSizesAr: { $in: sizes } }
      );
      baseFilter.$or = sizeFilter;
    }

    // البحث متعدد المراحل
    let products = [];
    let searchMethod = "none";
    let searchScore = [];

    try {
      // المرحلة 1: البحث بـ Text Search (الأسرع والأدق)
      if (processedQuery.tokens.length > 0) {
        searchMethod = "text";
        const textSearchQuery = processedQuery.expandedTokens.join(" ");

        products = await ProductModel.aggregate([
          {
            $match: {
              ...baseFilter,
              $text: {
                $search: textSearchQuery,
                $language: lang === "ar" ? "arabic" : "english",
              },
            },
          },
          {
            $addFields: {
              score: { $meta: "textScore" },
            },
          },
          {
            $sort: { score: -1 },
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
        ]);

        // Populate المراجع
        if (products.length > 0) {
          await ProductModel.populate(products, [
            { path: "productCategory", select: "nameEn nameAr" },
          ]);
        }
      }

      // المرحلة 2: إذا لم نجد نتائج، استخدم Regex
      if (products.length === 0 && processedQuery.tokens.length > 0) {
        searchMethod = "regex";

        const regexQueries = processedQuery.tokens.map((token) => ({
          $or: [
            { productNameEn: new RegExp(token, "i") },
            { productNameAr: new RegExp(token, "i") },
            { productDescriptionEn: new RegExp(token, "i") },
            { productDescriptionAr: new RegExp(token, "i") },
            { searchTags: new RegExp(token, "i") },
          ],
        }));

        products = await ProductModel.find({
          ...baseFilter,
          $and: regexQueries,
        })
          .sort(this.getSortOption(sortBy))
          .skip(skip)
          .limit(limit)
          .populate("productCategory", "nameEn nameAr");
      }

      // المرحلة 3: إذا لم نجد نتائج، استخدم Fuzzy Search
      if (products.length === 0 && processedQuery.tokens.length > 0) {
        searchMethod = "fuzzy";
        products = await this.fuzzySearch(
          query,
          baseFilter,
          skip,
          limit,
          lang,
          sortBy
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      // في حالة الخطأ، نعيد منتجات افتراضية
      products = await ProductModel.find(baseFilter)
        .sort(this.getSortOption(sortBy))
        .skip(skip)
        .limit(limit)
        .populate("productCategory", "nameEn nameAr");
    }

    // تحديث عدد البحث للمنتجات المعروضة
    if (products.length > 0) {
      const productIds = products.map((p) => p._id);
      await ProductModel.updateMany(
        { _id: { $in: productIds } },
        { $inc: { searchCount: 1 } }
      );
    }

    // حساب الإحصائيات
    const total = await this.countSearchResults(processedQuery, baseFilter);

    // تحضير النتيجة
    const result = {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
      searchInfo: {
        query: query,
        processedQuery: processedQuery,
        method: searchMethod,
        resultsCount: products.length,
        totalResults: total,
        searchTime: new Date().toISOString(),
      },
      filters: {
        appliedFilters: {
          categories: categories || [],
          priceRange: { min: minPrice, max: maxPrice },
          colors: colors || [],
          sizes: sizes || [],
        },
        availableFilters: await this.getAvailableFiltersForSearch(products),
      },
    };

    // حفظ في الكاش
    await searchCache.setCachedSearch(cacheKey, result, 300); // cache for 5 minutes

    return result;
  }

  // Fuzzy Search للبحث التقريبي
  async fuzzySearch(
    query,
    baseFilter,
    skip,
    limit,
    lang = "en",
    sortBy = "relevance"
  ) {
    // جلب عينة كبيرة من المنتجات
    const sampleSize = 500;
    const allProducts = await ProductModel.find(baseFilter)
      .limit(sampleSize)
      .populate("productCategory", "nameEn nameAr")
      .lean();

    if (allProducts.length === 0) return [];

    // إعداد Fuse.js للبحث التقريبي
    const fuseOptions = {
      keys: [
        { name: lang === "ar" ? "productNameAr" : "productNameEn", weight: 3 },
        {
          name: lang === "ar" ? "productDescriptionAr" : "productDescriptionEn",
          weight: 1,
        },
        { name: "searchTags", weight: 2 },
        { name: "productCategory.nameEn", weight: 1 },
        { name: "productCategory.nameAr", weight: 1 },
      ],
      threshold: 0.4, // مستوى التشابه (0.0 = تطابق تام، 1.0 = أي شيء)
      includeScore: true,
      minMatchCharLength: 2,
      useExtendedSearch: true,
    };

    const fuse = new Fuse(allProducts, fuseOptions);
    const results = fuse.search(query);

    // ترتيب النتائج حسب المطلوب
    let sortedResults = results.map((r) => ({
      ...r.item,
      searchScore: 1 - r.score, // تحويل النقاط (0 = أفضل في Fuse)
    }));

    // تطبيق الترتيب
    switch (sortBy) {
      case "price-asc":
        sortedResults.sort((a, b) => a.productPrice - b.productPrice);
        break;
      case "price-desc":
        sortedResults.sort((a, b) => b.productPrice - a.productPrice);
        break;
      case "newest":
        sortedResults.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
      case "rating":
        sortedResults.sort((a, b) => b.productRating - a.productRating);
        break;
      default: // relevance
        sortedResults.sort((a, b) => b.searchScore - a.searchScore);
    }

    // تطبيق pagination
    return sortedResults.slice(skip, skip + limit);
  }

  // عد نتائج البحث
  async countSearchResults(processedQuery, baseFilter) {
    if (!processedQuery.tokens || processedQuery.tokens.length === 0) {
      return await ProductModel.countDocuments(baseFilter);
    }

    try {
      // محاولة العد باستخدام text search
      return await ProductModel.countDocuments({
        ...baseFilter,
        $text: {
          $search: processedQuery.expandedTokens.join(" "),
        },
      });
    } catch {
      // إذا فشل، استخدم regex
      const regexQueries = processedQuery.tokens.map((token) => ({
        $or: [
          { productNameEn: new RegExp(token, "i") },
          { productNameAr: new RegExp(token, "i") },
          { productDescriptionEn: new RegExp(token, "i") },
          { productDescriptionAr: new RegExp(token, "i") },
          { searchTags: new RegExp(token, "i") },
        ],
      }));

      return await ProductModel.countDocuments({
        ...baseFilter,
        $and: regexQueries,
      });
    }
  }

  // الحصول على اقتراحات البحث
  async getSearchSuggestions(query, lang = "en", limit = 10, userId = null) {
    if (!query || query.length < 2) {
      // إرجاع اقتراحات افتراضية
      return await this.getDefaultSuggestions(lang, userId);
    }

    const processedQuery = this.processSearchQuery(query, lang);

    // البحث عن المنتجات المطابقة
    const productSuggestions = await ProductModel.aggregate([
      {
        $match: {
          isDeleted: false,
          productStatus: true,
          productQuantity: { $gt: 0 },
          $or: [
            { productNameEn: new RegExp(query, "i") },
            { productNameAr: new RegExp(query, "i") },
            { searchTags: new RegExp(query, "i") },
          ],
        },
      },
      {
        $sort: {
          popularityScore: -1,
          searchCount: -1,
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 1,
          name: {
            $cond: {
              if: { $eq: [lang, "ar"] },
              then: "$productNameAr",
              else: "$productNameEn",
            },
          },
          nameEn: "$productNameEn",
          nameAr: "$productNameAr",
          image: "$productImage",
          slug: "$productSlug",
          price: "$productPrice",
          finalPrice: {
            $cond: {
              if: "$hasActiveDiscount",
              then: "$productDiscountPrice",
              else: "$productPrice",
            },
          },
        },
      },
    ]);

    // البحث عن التصنيفات المطابقة
    const categorySuggestions = await CategoryModel.aggregate([
      {
        $match: {
          status: true,
          $or: [
            { nameEn: new RegExp(query, "i") },
            { nameAr: new RegExp(query, "i") },
          ],
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "productCategory",
          as: "productsCount",
        },
      },
      {
        $addFields: {
          productCount: { $size: "$productsCount" },
        },
      },
      {
        $sort: { productCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $project: {
          _id: 1,
          name: {
            $cond: {
              if: { $eq: [lang, "ar"] },
              then: "$nameAr",
              else: "$nameEn",
            },
          },
          nameEn: "$nameEn",
          nameAr: "$nameAr",
          productCount: 1,
        },
      },
    ]);

    // الحصول على البحوث الشائعة ذات الصلة
    const popularSearches = await this.getRelatedPopularSearches(
      query,
      lang,
      5
    );

    // الحصول على سجل البحث الشخصي
    let searchHistory = [];
    if (userId) {
      searchHistory = await this.getUserSearchHistory(userId, query, 5);
    }

    return {
      products: productSuggestions,
      categories: categorySuggestions,
      popularSearches,
      searchHistory,
      query: query,
    };
  }

  // اقتراحات افتراضية
  async getDefaultSuggestions(lang = "en", userId = null) {
    // المنتجات الأكثر شعبية
    const popularProducts = await ProductModel.find({
      isDeleted: false,
      productStatus: true,
      productQuantity: { $gt: 0 },
    })
      .sort({ popularityScore: -1, searchCount: -1 })
      .limit(5)
      .select(
        "productNameEn productNameAr productImage productSlug productPrice"
      );

    // البحوث الشائعة
    const trendingSearches = await this.getTrendingSearches(lang, 10);

    // سجل البحث الشخصي
    let searchHistory = [];
    if (userId) {
      searchHistory = await this.getUserSearchHistory(userId, "", 10);
    }

    return {
      products: popularProducts.map((p) => ({
        id: p._id,
        name: lang === "ar" ? p.productNameAr : p.productNameEn,
        image: p.productImage,
        slug: p.productSlug,
        price: p.productPrice,
        type: "product",
      })),
      categories: [],
      popularSearches: trendingSearches,
      searchHistory,
      query: "",
    };
  }

  // البحوث الشائعة
  async getTrendingSearches(lang = "en", limit = 10) {
    const trending = await SearchHistoryModel.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // آخر 7 أيام
        },
      },
      {
        $group: {
          _id: "$query",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
    ]);

    return trending.map((t) => t._id);
  }

  // البحوث الشائعة ذات الصلة
  async getRelatedPopularSearches(query, lang = "en", limit = 5) {
    const related = await SearchHistoryModel.aggregate([
      {
        $match: {
          query: new RegExp(query, "i"),
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: "$query",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
    ]);

    return related.map((r) => r._id);
  }

  // سجل بحث المستخدم
  async getUserSearchHistory(userId, query = "", limit = 10) {
    const filter = { userId };
    if (query) {
      filter.query = new RegExp(query, "i");
    }

    const history = await SearchHistoryModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("query");

    return [...new Set(history.map((h) => h.query))];
  }

  // حفظ سجل البحث
  async saveSearchHistory(userId, query, lang = "en") {
    try {
      await SearchHistoryModel.create({
        userId: userId || null,
        query: query.toLowerCase(),
        language: lang,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error saving search history:", error);
    }
  }

  // الحصول على الفلاتر المتاحة للبحث
  async getAvailableFiltersForSearch(products) {
    const productIds = products.map((p) => p._id);

    if (productIds.length === 0) {
      return {
        categories: [],
        colors: [],
        sizes: [],
        priceRange: { min: 0, max: 0 },
      };
    }

    // استخراج الفلاتر من المنتجات المعروضة
    const categories = [
      ...new Set(products.map((p) => p.productCategory?._id).filter(Boolean)),
    ];
    const colors = [
      ...new Set(
        products.flatMap((p) => [
          ...(p.productColorsEn || []),
          ...(p.productColorsAr || []),
        ])
      ),
    ];
    const sizes = [
      ...new Set(
        products.flatMap((p) => [
          ...(p.productSizesEn || []),
          ...(p.productSizesAr || []),
        ])
      ),
    ];
    const prices = products.map((p) => p.productPrice);

    return {
      categories,
      colors: colors.filter(Boolean),
      sizes: sizes.filter(Boolean),
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices),
      },
    };
  }

  // تتبع البحث (Analytics)
  async trackSearch(data) {
    const { query, userId, resultsCount, clickedProduct, sessionId } = data;

    try {
      // يمكن حفظ هذه البيانات في collection منفصل للتحليلات
      await SearchHistoryModel.findOneAndUpdate(
        {
          query: query.toLowerCase(),
          userId: userId || null,
          sessionId: sessionId,
        },
        {
          $inc: { searchCount: 1 },
          $set: {
            lastSearched: new Date(),
            resultsCount: resultsCount,
          },
          $push: clickedProduct ? { clickedProducts: clickedProduct } : {},
        },
        { upsert: true }
      );

      return { success: true };
    } catch (error) {
      console.error("Error tracking search:", error);
      return { success: false };
    }
  }

  // الحصول على تحليلات البحث
  async getSearchAnalytics(period = "7d") {
    const periodDays = parseInt(period) || 7;
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [
      totalSearches,
      uniqueSearches,
      noResultSearches,
      topSearches,
      searchesByDay,
    ] = await Promise.all([
      // إجمالي البحوث
      SearchHistoryModel.countDocuments({ createdAt: { $gte: startDate } }),

      // البحوث الفريدة
      SearchHistoryModel.distinct("query", { createdAt: { $gte: startDate } }),

      // البحوث بدون نتائج
      SearchHistoryModel.countDocuments({
        createdAt: { $gte: startDate },
        resultsCount: 0,
      }),

      // أكثر البحوث
      SearchHistoryModel.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: "$query", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // البحوث حسب اليوم
      SearchHistoryModel.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      period: `${periodDays} days`,
      totalSearches,
      uniqueSearches: uniqueSearches.length,
      noResultSearches,
      topSearches,
      searchesByDay,
      averageSearchesPerDay: Math.round(totalSearches / periodDays),
    };
  }

  // مسح سجل بحث المستخدم
  async clearUserHistory(userId) {
    try {
      await SearchHistoryModel.deleteMany({ userId });
      return true;
    } catch (error) {
      console.error("Error clearing search history:", error);
      return false;
    }
  }

  // خيارات الترتيب
  getSortOption(sortBy) {
    const sortOptions = {
      relevance: { popularityScore: -1, searchCount: -1 },
      "price-asc": { productPrice: 1 },
      "price-desc": { productPrice: -1 },
      newest: { createdAt: -1 },
      popular: { popularityScore: -1 },
      rating: { productRating: -1 },
      discount: { productDiscountPercentage: -1 },
      "name-asc": { productNameEn: 1 },
      "name-desc": { productNameEn: -1 },
    };

    return sortOptions[sortBy] || sortOptions["relevance"];
  }
}

module.exports = new SearchService();
