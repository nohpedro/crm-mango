import { create } from 'zustand'

import type { User } from '../modules/auth/types/auth.types'

export type AuthStatus = 'idle' | 'bootstrapping' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  user: User | null
  setStatus: (status: AuthStatus) => void
  setAuthenticated: (user: User) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  setStatus: (status) => set({ status }),
  setAuthenticated: (user) => set({ status: 'authenticated', user }),
  clearSession: () => set({ status: 'anonymous', user: null }),
}))
