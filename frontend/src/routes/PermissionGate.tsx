import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { hasAnyPermission } from '../utils/permissions'

export function PermissionGate({
  anyOf,
  children,
}: {
  anyOf: string[]
  children: ReactNode
}) {
  const user = useAuthStore((state) => state.user)
  return hasAnyPermission(user, anyOf) ? <>{children}</> : <Navigate to="/unauthorized" replace />
}
