export interface RoleSummary {
  id: string
  name: string
  code: string
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
  permissions: string[]
  role: RoleSummary | null
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse extends AuthTokens {
  token_type: 'Bearer'
  user: User
}

export type RefreshResponse = AuthTokens
