// Memoize transparency results per image src — the full-resolution decode + alpha
// scan is expensive and gets re-run on every src change (next/prev, grid->image).
// We cache the in-flight Promise (dedups concurrent calls) and keep successful
// results; load failures are evicted so a later retry can recompute.
const transparencyCache = new Map(); // imageSrc -> Promise<boolean>
const TRANSPARENCY_CACHE_MAX = 500;

/**
 * Detect if an image has transparency (alpha channel with values < 255)
 * @param {string} imageSrc - Image source (data URL or URL)
 * @returns {Promise<boolean>} - True if image has transparent pixels
 */
export function hasImageTransparency(imageSrc) {
  if (!imageSrc) return Promise.resolve(false);

  const cached = transparencyCache.get(imageSrc);
  if (cached) return cached;

  if (transparencyCache.size >= TRANSPARENCY_CACHE_MAX) {
    transparencyCache.clear();
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Check alpha channel (every 4th byte starting from index 3)
        // If any pixel has alpha < 255, it has transparency
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            resolve(true);
            return;
          }
        }

        // No transparent pixels found
        resolve(false);
      } catch (error) {
        // If canvas operations fail (CORS, etc), assume no transparency.
        // Don't cache a tainted-canvas failure as a real result.
        console.warn('Failed to detect transparency:', error);
        transparencyCache.delete(imageSrc);
        resolve(false);
      }
    };

    img.onerror = () => {
      // Transient load failure — evict so a retry isn't poisoned.
      transparencyCache.delete(imageSrc);
      resolve(false);
    };

    img.src = imageSrc;
  });

  transparencyCache.set(imageSrc, promise);
  return promise;
}

/**
 * Quick check if image is likely to have transparency based on format
 * @param {string} src - Image source
 * @returns {boolean}
 */
export function isPNGFormat(src) {
  if (!src) return false;
  return (
    src.toLowerCase().includes('.png') ||
    src.toLowerCase().includes('image/png') ||
    src.toLowerCase().includes('data:image/png')
  );
}
