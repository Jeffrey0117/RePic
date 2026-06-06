/**
 * Shared upload "wall" for the trio's virtualization.
 *
 * Virtualization uploads go to urusai (the "u-host") — external, zero-burden, anonymous.
 * A local file is uploaded here to obtain a public URL, which then becomes the `url` of a
 * refile-v2 pointer (.repic / .revid / .refile). This module is the single source of truth
 * for that contract so RePic / ReVid / MemoryGuy all upload the same way.
 */

const URUSAI_ENDPOINT = 'https://api.urusai.cc/v1/upload';

/**
 * Read a local image source (file:// or data: or http) into a Blob.
 * @param {string} src
 * @param {object} electronAPI - window.electronAPI (needed for file:// reads)
 * @returns {Promise<Blob|null>}
 */
export async function imageSrcToBlob(src, electronAPI) {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('http')) {
    return (await fetch(src)).blob();
  }
  if (src.startsWith('file://')) {
    if (!electronAPI) return null;
    const cleanPath = src.replace('file://', '').split('?')[0];
    const dataUrl = electronAPI.readFile(cleanPath);
    if (!dataUrl) return null;
    return (await fetch(dataUrl)).blob();
  }
  return null;
}

/**
 * Re-encode WebP to PNG for upload/social compatibility. Other types pass through.
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
export async function toPngIfWebp(blob) {
  if (blob.type !== 'image/webp') return blob;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * SHA-256 of a Blob, formatted as the refile-v2 `sha256:<hex>` string.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function sha256(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return 'sha256:' + Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Upload a blob to urusai. Returns { url, id, filename }. Throws on failure.
 * @param {Blob} blob
 * @param {string} filename
 */
export async function uploadToUrusai(blob, filename) {
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await fetch(URUSAI_ENDPOINT, { method: 'POST', body: form });
  const text = await res.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response: ${text.slice(0, 100)}`);
  }
  if (result.status === 'success' && result.data) {
    const url = result.data.url_direct || result.data.url_preview || `https://i.urusai.cc/${result.data.id}`;
    return { url, id: result.data.id, filename: result.data.filename };
  }
  throw new Error(result.error || result.message || 'Upload failed');
}
