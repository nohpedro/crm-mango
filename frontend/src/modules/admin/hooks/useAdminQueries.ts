import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { adminService } from '../services/admin.service'
import type {
  ListFilters,
  RoleWriteRequest,
  UserWriteRequest,
} from '../types/admin.types'

export const adminQueryKeys = {
  users: (filters: ListFilters) => ['users', filters] as const,
  user: (id: string) => ['user', id] as const,
  roles: (filters: ListFilters) => ['roles', filters] as const,
  role: (id: string) => ['role', id] as const,
  permissions: ['permissions'] as const,
}

export function useUsers(filters: ListFilters) {
  return useQuery({
    queryKey: adminQueryKeys.users(filters),
    queryFn: () => adminService.listUsers(filters),
  })
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: adminQueryKeys.user(id ?? ''),
    queryFn: () => adminService.getUser(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useUserMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const create = useMutation({
    mutationFn: adminService.createUser,
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UserWriteRequest> }) =>
      adminService.updateUser(id, payload),
    onSuccess: (_, variables) => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.user(variables.id) })
    },
  })

  return { create, update }
}

export function useRoles(filters: ListFilters) {
  return useQuery({
    queryKey: adminQueryKeys.roles(filters),
    queryFn: () => adminService.listRoles(filters),
  })
}

export function useRole(id: string | undefined) {
  return useQuery({
    queryKey: adminQueryKeys.role(id ?? ''),
    queryFn: () => adminService.getRole(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useRoleMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['roles'] })

  const create = useMutation({
    mutationFn: adminService.createRole,
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RoleWriteRequest> }) =>
      adminService.updateRole(id, payload),
    onSuccess: (_, variables) => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.role(variables.id) })
    },
  })

  return { create, update }
}

export function usePermissions() {
  return useQuery({
    queryKey: adminQueryKeys.permissions,
    queryFn: adminService.listPermissions,
    staleTime: 5 * 60_000,
  })
}
