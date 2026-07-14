import { requestHandler } from '../../auth/services/auth.service'
import type { PaginatedResponse } from '../../../types/api'
import type {
  ListFilters,
  Permission,
  Role,
  RoleWriteRequest,
  User,
  UserWriteRequest,
} from '../types/admin.types'

const listParams = (filters: ListFilters) => ({
  search: filters.search || undefined,
  ordering: filters.ordering || undefined,
  page: filters.page,
})

export const adminService = {
  listUsers: (filters: ListFilters) =>
    requestHandler.get<PaginatedResponse<User>>('users/', {
      params: listParams(filters),
    }),

  getUser: (id: string) => requestHandler.get<User>(`users/${id}/`),

  createUser: (payload: UserWriteRequest) =>
    requestHandler.post<User, UserWriteRequest>('users/', payload),

  updateUser: (id: string, payload: Partial<UserWriteRequest>) =>
    requestHandler.patch<User, Partial<UserWriteRequest>>(`users/${id}/`, payload),

  listRoles: (filters: ListFilters) =>
    requestHandler.get<PaginatedResponse<Role>>('roles/', {
      params: listParams(filters),
    }),

  getRole: (id: string) => requestHandler.get<Role>(`roles/${id}/`),

  createRole: (payload: RoleWriteRequest) =>
    requestHandler.post<Role, RoleWriteRequest>('roles/', payload),

  updateRole: (id: string, payload: Partial<RoleWriteRequest>) =>
    requestHandler.patch<Role, Partial<RoleWriteRequest>>(`roles/${id}/`, payload),

  listPermissions: () => requestHandler.get<Permission[]>('permissions/'),
}
