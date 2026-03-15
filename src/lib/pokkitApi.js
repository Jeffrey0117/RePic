const BASE_URL = 'https://pokkit.isnowfriend.com'
const REQUEST_TIMEOUT_MS = 30000

export function createPokkitApi(token) {
  const headers = () => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  })

  async function request(path) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: headers(),
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (response.status === 401) {
        return { success: false, error: 'unauthorized' }
      }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      clearTimeout(timeout)
      if (error.name === 'AbortError') {
        return { success: false, error: 'timeout' }
      }
      return { success: false, error: error.message }
    }
  }

  return {
    fetchAlbums() {
      return request('/api/albums')
    },

    fetchAlbumPhotos(albumId, limit = 200, offset = 0) {
      return request(`/api/albums/${albumId}?limit=${limit}&offset=${offset}`)
    },

    getPhotoUrl(photoId) {
      return `${BASE_URL}/photos/${photoId}/photo.webp`
    },

    getThumbUrl(photoId) {
      return `${BASE_URL}/photos/${photoId}/thumb.webp`
    }
  }
}
