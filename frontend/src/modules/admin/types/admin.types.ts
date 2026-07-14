import type { PaginatedResponse } from '../../../types/api'

export interface Permission {
  id: number
  name: string
  codename: string
  app_label: string
  model: string
}

export interface RoleSummary {
  id: string
  name: string
  code: string
}

export interface Role {
  id: string
  name: string
  code: string
  description: string
  permissions: number[]
  permission_details: Permission[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  is_active: boolean
  is_staff: boolean
  is_admin: boolean
  role: RoleSummary | null
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface UserWriteRequest {
  username: string
  email: string
  first_name: string
  last_name: string
  password?: string
  role: string | null
  is_active: boolean
}

export interface RoleWriteRequest {
  name: string
  code: string
  description: string
  permissions: number[]
  is_active: boolean
}

export interface ListFilters {
  search: string
  ordering: string
  page: number
}

export type PaginatedUsers = PaginatedResponse<User>
export type PaginatedRoles = PaginatedResponse<Role>
