import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY_USER = 'repic-pokkit-user'
const STORAGE_KEY_TOKEN = 'repic-pokkit-token'

function loadCachedAuth() {
  try {
    const userStr = localStorage.getItem(STORAGE_KEY_USER)
    const token = localStorage.getItem(STORAGE_KEY_TOKEN)
    if (userStr && token) {
      return { user: JSON.parse(userStr), token }
    }
  } catch {
    // ignore corrupted cache
  }
  return { user: null, token: null }
}

function persistAuth(user, token) {
  try {
    if (user && token) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user))
      localStorage.setItem(STORAGE_KEY_TOKEN, token)
    } else {
      localStorage.removeItem(STORAGE_KEY_USER)
      localStorage.removeItem(STORAGE_KEY_TOKEN)
    }
  } catch {
    // localStorage may be full or disabled
  }
}

export function useLetMeUse() {
  const cached = loadCachedAuth()
  const [user, setUser] = useState(cached.user)
  const [token, setToken] = useState(cached.token)
  const [isLoading, setIsLoading] = useState(true)
  const sdkInitialized = useRef(false)

  useEffect(() => {
    let unsubscribe
    let attempts = 0
    const maxAttempts = 50 // 5 seconds max

    const tryInit = () => {
      const sdk = window.letmeuse
      if (!sdk || !sdk.ready) {
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(tryInit, 100)
        } else {
          // SDK failed to load — degrade to guest
          setIsLoading(false)
        }
        return
      }

      // SDK is ready — read current state
      const currentUser = sdk.user
      const currentToken = sdk.getToken()
      setUser(currentUser)
      setToken(currentToken)
      persistAuth(currentUser, currentToken)
      setIsLoading(false)
      sdkInitialized.current = true

      unsubscribe = sdk.onAuthChange((newUser) => {
        // SDK fires null during init before session restore.
        // Only clear auth if SDK has been initialized (avoids wiping cache during init).
        if (!newUser) {
          if (sdkInitialized.current) {
            setUser(null)
            setToken(null)
            persistAuth(null, null)
          }
          return
        }
        const newToken = sdk.getToken()
        setUser(newUser)
        setToken(newToken)
        persistAuth(newUser, newToken)
      })
    }

    tryInit()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const login = useCallback(() => {
    window.letmeuse?.login()
  }, [])

  const logout = useCallback(() => {
    window.letmeuse?.logout()
    setUser(null)
    setToken(null)
    persistAuth(null, null)
  }, [])

  const isAuthenticated = !!user && !!token

  return { user, token, isLoading, isAuthenticated, login, logout }
}
