import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

export function AdminRoute() {
  const isAdmin = useAuthStore((state) => state.user?.is_admin ?? false)
  return isAdmin ? <Outlet /> : <Navigate to="/unauthorized" replace />
}
