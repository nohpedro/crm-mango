import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

export function PublicOnlyRoute() {
  const status = useAuthStore((state) => state.status)
  return status === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />
}
