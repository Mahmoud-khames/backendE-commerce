class SearchCache {
  constructor() {
    this.cache = new Map();
  }

  getCachedSearch(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
 
    return item.value;
  }
 
  setCachedSearch(key, value, ttlSeconds = 300) {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });

    // Simple cleanup to prevent memory leaks: remove oldest if too big
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new SearchCache();
