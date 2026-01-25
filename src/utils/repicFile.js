/**
 * Repic Virtual Image File Utilities
 *
 * .repic files are lightweight JSON files that store references to web images.
 * They allow users to organize and browse web images without downloading them.
 */

const REPIC_VERSION = 1;

/**
 * Create a .repic file data object
 * @param {string} url - The image URL
 * @param {string} name - Display name for the image
 * @param {string} albumId - Optional source album ID
 * @param {string} imageId - Optional source image ID
 * @param {object} crop - Optional crop parameters { x, y, width, height } in percentages
 * @returns {object} .repic file data
 */
export function createRepicData(url, name, albumId = null, imageId = null, crop = null) {
  const data = {
    v: REPIC_VERSION,
    type: 'virtual-image',
    url,
    name: name || extractNameFromUrl(url),
    albumId,
    imageId,
    createdAt: Date.now()
  };

  // Include crop if present
  if (crop) {
    data.crop = crop;
  }

  return data;
}

/**
 * Extract a reasonable name from a URL
 * @param {string} url - The image URL
 * @returns {string} Extracted name
 */
export function extractNameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    // Remove extension and clean up
    const name = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    return name || 'image';
  } catch {
    return 'image';
  }
}

/**
 * Generate a safe filename from a name
 * @param {string} name - The display name
 * @param {number} index - Optional index for numbering
 * @param {boolean} useIndex - Whether to prefix with index
 * @returns {string} Safe filename with .repic extension
 */
export function generateRepicFilename(name, index = 0, useIndex = false) {
  // Sanitize the name for filesystem
  let safeName = name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .substring(0, 100); // Limit length

  if (!safeName) {
    safeName = 'image';
  }

  if (useIndex) {
    const paddedIndex = String(index + 1).padStart(3, '0');
    return `${paddedIndex}-${safeName}.repic`;
  }

  return `${safeName}.repic`;
}

/**
 * Validate .repic file data
 * @param {object} data - The parsed .repic file content
 * @returns {boolean} Whether the data is valid
 */
export function validateRepicData(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.type !== 'virtual-image') return false;
  if (!data.url || typeof data.url !== 'string') return false;
  if (!data.url.startsWith('http://') && !data.url.startsWith('https://')) return false;
  return true;
}

/**
 * Check if a file path is a .repic file
 * @param {string} filePath - The file path
 * @returns {boolean}
 */
export function isRepicFile(filePath) {
  return filePath?.toLowerCase().endsWith('.repic');
}

/**
 * Prepare album images for batch export
 * @param {Array} images - Array of album images
 * @param {string} albumId - The album ID
 * @param {boolean} useIndex - Whether to prefix filenames with index
 * @returns {Array} Array of { filename, data } objects ready for export
 */
export function prepareAlbumExport(images, albumId, useIndex = false) {
  return images.map((image, index) => {
    const name = image.name || extractNameFromUrl(image.url);
    const filename = generateRepicFilename(name, index, useIndex);
    // Include crop parameters if present
    const data = createRepicData(image.url, name, albumId, image.id, image.crop);

    return { filename, data };
  });
}
