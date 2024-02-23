import NodeCache from "node-cache";

class CacheService {
  defaultCacheName: 'default';
  caches: Map<string, NodeCache> = new Map<string, NodeCache>();
  cacheOptions: NodeCache.Options = {
    stdTTL: 3600
  };
  autoCreateCaches = true;

  constructor () {
    const cache = new NodeCache(this.cacheOptions);
    this.caches.set(this.defaultCacheName, cache);
  }

  init () {}

  getDefaultCacheName() {
    return 'default';
  }

  addToCache(cacheName: string = this.defaultCacheName, key: string, value: unknown, options: Record<string, any> = {}) {
    let cache = this.caches.get(cacheName);
    if (!cache && this.autoCreateCaches) {
      cache = new NodeCache(this.cacheOptions);
      this.caches.set(cacheName, cache);
    }

    if (!cache) {
      throw new Error(`Cache ${cacheName} is unkown and could not be auto-created`);
    }

    cache.set(key, value);
  }

  getFromCache<T>(cacheName: string = this.defaultCacheName, key: string): T | undefined {
    let cache = this.caches.get(cacheName);
    if (!cache) {
      return undefined;
    }
    return cache.get(key);
  }

  removeFromCache(cacheName: string = this.defaultCacheName, key: string) {
    let cache = this.caches.get(cacheName);
    if (cache) {
      cache.del(key);
    }
  }
}

export default new CacheService();