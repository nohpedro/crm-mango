import { LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'idle' || status === 'bootstrapping') {
    return (
      <main
        className="grid min-h-screen place-items-center bg-slate-50"
        aria-live="polite"
      >
        <div className="text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin text-brand-600" />
          <p className="mt-3 text-sm text-slate-500">Verificando tu sesión…</p>
        </div>
      </main>
    )
  }

  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return <Outlet />
}
