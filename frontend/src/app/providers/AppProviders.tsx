import { QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { Toaster } from 'sonner'

import { queryClient } from '../queryClient'
import { AuthProvider } from './AuthProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  )
}
