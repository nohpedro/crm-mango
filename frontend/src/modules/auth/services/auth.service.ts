import { RequestHandler } from '../../../services/RequestHandler'
import { tokenStorage } from './tokenStorage'
import type { LoginRequest, LoginResponse, User } from '../types/auth.types'

export const requestHandler = new RequestHandler()

export const authService = {
  async login(credentials: LoginRequest): Promise<User> {
    const response = await requestHandler.post<LoginResponse, LoginRequest>(
      'auth/login/',
      credentials,
      { skipAuthRefresh: true },
    )
    tokenStorage.setTokens(response)
    return response.user
  },

  getMe: () => requestHandler.get<User>('auth/me/'),

  async logout(): Promise<void> {
    const refresh = tokenStorage.getRefreshToken()
    if (!refresh) return
    await requestHandler.post<void, { refresh: string }>('auth/logout/', { refresh })
  },
}
