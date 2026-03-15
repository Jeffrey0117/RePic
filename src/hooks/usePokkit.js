import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLetMeUse } from './useLetMeUse'
import { createPokkitApi } from '../lib/pokkitApi'

export function usePokkit() {
  const { user, token, isLoading: authLoading, isAuthenticated, login, logout } = useLetMeUse()

  const [albums, setAlbums] = useState([])
  const [selectedAlbumId, setSelectedAlbumId] = useState(null)
  const [photos, setPhotos] = useState([])
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false)
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)
  const [error, setError] = useState(null)

  // Create API client when token changes
  const api = useMemo(
    () => (token ? createPokkitApi(token) : null),
    [token]
  )

  // Handle unauthorized responses
  const handleUnauthorized = useCallback(() => {
    logout()
    setAlbums([])
    setPhotos([])
    setSelectedAlbumId(null)
    setError('unauthorized')
  }, [logout])

  // Fetch albums when authenticated
  const refreshAlbums = useCallback(async () => {
    if (!api) return

    setIsLoadingAlbums(true)
    setError(null)

    const result = await api.fetchAlbums()

    if (!result.success) {
      if (result.error === 'unauthorized') {
        handleUnauthorized()
      } else {
        setError(result.error)
      }
      setIsLoadingAlbums(false)
      return
    }

    setAlbums(result.data || [])
    setIsLoadingAlbums(false)
  }, [api, handleUnauthorized])

  // Auto-fetch albums when authenticated
  useEffect(() => {
    if (isAuthenticated && api) {
      refreshAlbums()
    } else if (!isAuthenticated) {
      setAlbums([])
      setPhotos([])
      setSelectedAlbumId(null)
    }
  }, [isAuthenticated, api, refreshAlbums])

  // Fetch album photos when album selected
  const selectAlbum = useCallback(async (albumId) => {
    if (!api || !albumId) return

    setSelectedAlbumId(albumId)
    setIsLoadingPhotos(true)
    setError(null)

    const result = await api.fetchAlbumPhotos(albumId)

    if (!result.success) {
      if (result.error === 'unauthorized') {
        handleUnauthorized()
      } else {
        setError(result.error)
      }
      setIsLoadingPhotos(false)
      return
    }

    // Map photos to include thumb/photo URLs
    const albumData = result.data
    const mappedPhotos = (albumData.photos || []).map(photo => ({
      ...photo,
      thumbUrl: api.getThumbUrl(photo.id),
      photoUrl: api.getPhotoUrl(photo.id)
    }))

    setPhotos(mappedPhotos)
    setIsLoadingPhotos(false)
  }, [api, handleUnauthorized])

  // Selected album object
  const selectedAlbum = useMemo(
    () => albums.find(a => a.id === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  )

  return {
    // Auth
    isAuthenticated,
    user,
    isAuthLoading: authLoading,
    login,
    logout,

    // Albums
    albums,
    selectedAlbumId,
    selectedAlbum,
    isLoadingAlbums,

    // Photos
    photos,
    isLoadingPhotos,

    // Actions
    selectAlbum,
    refreshAlbums,

    // Error
    error
  }
}
