import '@testing-library/jest-dom/vitest'

import { afterAll, afterEach, beforeAll } from 'vitest'

import { tokenStorage } from '../modules/auth/services/tokenStorage'
import { useAuthStore } from '../store/authStore'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  server.resetHandlers()
  tokenStorage.clear()
  useAuthStore.setState({ status: 'idle', user: null })
})

afterAll(() => server.close())
