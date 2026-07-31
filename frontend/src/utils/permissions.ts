import type { User } from '../modules/auth/types/auth.types'

export function hasPermission(user: User | null | undefined, permission: string) {
  return Boolean(
    user?.is_admin || user?.permissions?.includes('*') || user?.permissions?.includes(permission),
  )
}

export function hasAnyPermission(
  user: User | null | undefined,
  permissions: string[] | undefined,
) {
  if (!permissions?.length) return true
  return permissions.some((permission) => hasPermission(user, permission))
}
