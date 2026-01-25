/**
 * Optimized image loader with:
 * - Concurrent request limiting (prevents network congestion)
 * - Priority queue (visible images first)
 * - Memory cache (instant subsequent loads)
 * - IndexedDB persistence (offline support)
 */

import { getCachedImage, cacheImage } from './offlineCache';

// Configuration
const MAX_CONCURRENT = 4; // Max simultaneous downloads
const PRIORITY_HIGH = 0;
const PRIORITY_NORMAL = 1;
const PRIORITY_LOW = 2;

// State
const memoryCache = new Map(); // URL -> base64/blob URL
const loadingPromises = new Map(); // URL -> Promise (dedup concurrent requests)
const queue = []; // Priority queue: { url, priority, resolve, reject }
let activeCount = 0;

/**
 * Process the next item in the queue
 */
const processQueue = () => {
  if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;

  // Sort by priority (lower = higher priority)
  queue.sort((a, b) => a.priority - b.priority);

  const item = queue.shift();
  if (!item) return;

  activeCount++;

  fetchImage(item.url)
    .then(item.resolve)
    .catch(item.reject)
    .finally(() => {
      activeCount--;
      processQueue(); // Process next
    });
};

/**
 * Fetch a single image with caching
 */
const fetchImage = async (url) => {
  // Check memory cache first (instant)
  if (memoryCache.has(url)) {
    return memoryCache.get(url);
  }

  // Check IndexedDB cache (fast)
  try {
    const cached = await getCachedImage(url);
    if (cached) {
      memoryCache.set(url, cached);
      return cached;
    }
  } catch (e) {
    // Ignore cache errors
  }

  // Fetch from network
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer'
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();

  // Convert to base64 for caching
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Store in caches
  memoryCache.set(url, base64);
  cacheImage(url, base64).catch(() => {}); // Async, don't wait

  return base64;
};

/**
 * Load an image with priority
 * @param {string} url - Image URL
 * @param {number} priority - 0=high, 1=normal, 2=low
 * @returns {Promise<string>} - Resolved image data (base64 or blob URL)
 */
export const loadImage = (url, priority = PRIORITY_NORMAL) => {
  if (!url || !url.startsWith('http')) {
    return Promise.reject(new Error('Invalid URL'));
  }

  // Return from memory cache immediately
  if (memoryCache.has(url)) {
    return Promise.resolve(memoryCache.get(url));
  }

  // Dedup: if already loading this URL, return existing promise
  if (loadingPromises.has(url)) {
    return loadingPromises.get(url);
  }

  // Create new loading promise
  const promise = new Promise((resolve, reject) => {
    queue.push({ url, priority, resolve, reject });
    processQueue();
  });

  loadingPromises.set(url, promise);

  // Clean up promise map when done
  promise.finally(() => {
    loadingPromises.delete(url);
  });

  return promise;
};

/**
 * Check if image is already cached
 */
export const isImageCached = (url) => {
  return memoryCache.has(url);
};

/**
 * Get cached image synchronously (or null)
 */
export const getCached = (url) => {
  return memoryCache.get(url) || null;
};

/**
 * Preload images in background (low priority)
 */
export const preloadImages = (urls) => {
  urls.forEach(url => {
    if (url && !memoryCache.has(url)) {
      loadImage(url, PRIORITY_LOW).catch(() => {});
    }
  });
};

/**
 * Cancel pending loads for URLs (when user navigates away)
 */
export const cancelPending = (urls) => {
  const urlSet = new Set(urls);
  // Remove from queue
  for (let i = queue.length - 1; i >= 0; i--) {
    if (urlSet.has(queue[i].url)) {
      queue.splice(i, 1);
    }
  }
};

/**
 * Clear memory cache (for memory management)
 */
export const clearMemoryCache = () => {
  memoryCache.clear();
};

/**
 * Get loader stats (for debugging)
 */
export const getStats = () => ({
  memoryCacheSize: memoryCache.size,
  queueLength: queue.length,
  activeCount,
  maxConcurrent: MAX_CONCURRENT
});

// Priority exports
export { PRIORITY_HIGH, PRIORITY_NORMAL, PRIORITY_LOW };
