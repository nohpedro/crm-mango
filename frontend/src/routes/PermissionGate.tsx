import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { hasAnyPermission, hasPermission } from '../utils/permissions'

export function PermissionGate({
  anyOf,
  allOf,
  children,
}: {
  anyOf?: string[]
  allOf?: string[]
  children: ReactNode
}) {
  const user = useAuthStore((state) => state.user)
  const hasAny = hasAnyPermission(user, anyOf)
  const hasAll = (allOf ?? []).every((permission) => hasPermission(user, permission))
  return hasAny && hasAll ? <>{children}</> : <Navigate to="/unauthorized" replace />
}
