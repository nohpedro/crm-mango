import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  CircleAlert,
  Menu,
  PackageSearch,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { navigationGroups } from '../../config/navigation'
import { requestHandler } from '../../modules/auth/services/auth.service'
import { useAuthStore } from '../../store/authStore'
import { hasAnyPermission } from '../../utils/permissions'
import { Breadcrumbs } from './Breadcrumbs'

interface HeaderProps {
  onOpenMenu: () => void
}

interface SystemNotification {
  id: string
  title: string
  message: string
  path: string
  tone: 'warning' | 'danger'
}

interface NotificationResponse {
  count: number
  items: SystemNotification[]
}

export function Header({ onOpenMenu }: HeaderProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const items = useMemo(
    () =>
      navigationGroups
        .flatMap((group) => group.items)
        .filter(
          (item) =>
            (!item.adminOnly || user?.is_admin) &&
            hasAnyPermission(user, item.requiredAnyPermissions),
        ),
    [user],
  )
  const current = [...items]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  const notifications = useQuery({
    queryKey: ['system-notifications'],
    queryFn: () => requestHandler.get<NotificationResponse>('notifications/'),
    enabled: Boolean(user),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const searchResults = items.filter((item) =>
    `${item.label} ${item.path}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const openSearch = () => {
    setNotificationsOpen(false)
    setSearchOpen(true)
  }

  const goTo = (path: string) => {
    setSearchOpen(false)
    setNotificationsOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex h-20 items-center gap-4">
        <button
          type="button"
          aria-label="Abrir menú"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          onClick={onOpenMenu}
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
            {current?.label ?? 'CRM IDESEM'}
          </h1>
          <div className="mt-1 hidden sm:block">
            <Breadcrumbs />
          </div>
        </div>
        <button
          type="button"
          aria-label="Buscar en el sistema"
          title="Buscar en el sistema"
          onClick={openSearch}
          className={`rounded-xl p-2.5 transition ${
            searchOpen
              ? 'bg-brand-50 text-brand-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <Search className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Ver notificaciones"
          title="Ver notificaciones"
          onClick={() => {
            setSearchOpen(false)
            setNotificationsOpen((value) => !value)
          }}
          className={`relative rounded-xl p-2.5 transition ${
            notificationsOpen
              ? 'bg-brand-50 text-brand-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <Bell className="size-5" />
          {(notifications.data?.count ?? 0) > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-5 text-white ring-2 ring-white">
              {Math.min(notifications.data?.count ?? 0, 9)}
            </span>
          )}
        </button>
      </div>

      {searchOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar búsqueda"
            onClick={() => setSearchOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-slate-950/25"
          />
          <section className="fixed left-1/2 top-24 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              <Search className="size-5 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false)
                  if (event.key === 'Enter' && searchResults.length === 1)
                    goTo(searchResults[0].path)
                }}
                placeholder="Buscar una pantalla o función..."
                aria-label="Buscar una pantalla o función"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Cerrar búsqueda"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <p className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                {query ? 'Resultados' : 'Accesos rápidos'}
              </p>
              {searchResults.length ? (
                searchResults.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => goTo(item.path)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-brand-50"
                    >
                      <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <b className="block text-sm text-slate-800">{item.label}</b>
                        <span className="text-xs text-slate-400">{item.path}</span>
                      </span>
                    </button>
                  )
                })
              ) : (
                <p className="p-6 text-center text-sm text-slate-500">
                  No encontramos una función con ese nombre.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {notificationsOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            onClick={() => setNotificationsOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-transparent"
          />
          <section className="fixed right-4 top-20 z-40 w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6 lg:right-8">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h2 className="font-bold text-slate-900">Notificaciones</h2>
                <p className="text-xs text-slate-500">Pendientes que requieren atención.</p>
              </div>
              <button
                type="button"
                aria-label="Actualizar notificaciones"
                onClick={() => void notifications.refetch()}
                disabled={notifications.isFetching}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-4 ${notifications.isFetching ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {notifications.isLoading ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Cargando notificaciones...
                </p>
              ) : notifications.isError ? (
                <p className="p-6 text-center text-sm text-red-600">
                  No se pudieron consultar las notificaciones.
                </p>
              ) : notifications.data?.items.length ? (
                notifications.data.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setNotificationsOpen(false)}
                    className="flex gap-3 rounded-xl p-3 hover:bg-slate-50"
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                        item.tone === 'danger'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {item.tone === 'danger' ? (
                        <PackageSearch className="size-4" />
                      ) : (
                        <CircleAlert className="size-4" />
                      )}
                    </span>
                    <span>
                      <b className="block text-sm text-slate-800">{item.title}</b>
                      <span className="text-xs leading-5 text-slate-500">
                        {item.message}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <Bell className="size-5" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-slate-800">Todo al día</p>
                  <p className="mt-1 text-xs text-slate-500">
                    No hay pendientes importantes.
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </header>
  )
}
