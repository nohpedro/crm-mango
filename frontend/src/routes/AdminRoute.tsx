import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

export function AdminRoute() {
  const user = useAuthStore((state) => state.user)
  return user?.is_admin ? (
    <Outlet />
  ) : (
    <Navigate to={user ? '/unauthorized' : '/login'} replace />
  )
}
