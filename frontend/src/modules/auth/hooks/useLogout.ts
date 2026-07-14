import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { queryClient } from '../../../app/queryClient'
import { useAuthStore } from '../../../store/authStore'
import { authService } from '../services/auth.service'
import { tokenStorage } from '../services/tokenStorage'

export function useLogout() {
  const navigate = useNavigate()
  const clearSession = useAuthStore((state) => state.clearSession)

  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      tokenStorage.clear()
      clearSession()
      queryClient.clear()
      toast.success('Sesión cerrada correctamente.')
      navigate('/login', { replace: true })
    },
  })
}
