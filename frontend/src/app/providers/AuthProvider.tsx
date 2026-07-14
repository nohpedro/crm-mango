import { useEffect, useRef, type PropsWithChildren } from 'react'

import { authService, requestHandler } from '../../modules/auth/services/auth.service'
import { subscribeToSessionExpired } from '../../modules/auth/services/sessionEvents'
import { tokenStorage } from '../../modules/auth/services/tokenStorage'
import { useAuthStore } from '../../store/authStore'
import { queryClient } from '../queryClient'

export function AuthProvider({ children }: PropsWithChildren) {
  const started = useRef(false)
  const setStatus = useAuthStore((state) => state.setStatus)
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const clearSession = useAuthStore((state) => state.clearSession)

  useEffect(() => {
    const unsubscribe = subscribeToSessionExpired(() => {
      clearSession()
      queryClient.clear()
    })
    return unsubscribe
  }, [clearSession])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const bootstrap = async () => {
      if (!tokenStorage.getRefreshToken()) {
        clearSession()
        return
      }

      setStatus('bootstrapping')
      try {
        await requestHandler.refreshSession()
        const user = await authService.getMe()
        queryClient.setQueryData(['auth', 'me'], user)
        setAuthenticated(user)
      } catch {
        tokenStorage.clear()
        clearSession()
      }
    }

    void bootstrap()
  }, [clearSession, setAuthenticated, setStatus])

  return children
}
