import { Bell, Menu, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { navigationGroups } from '../../config/navigation'
import { Breadcrumbs } from './Breadcrumbs'

interface HeaderProps {
  onOpenMenu: () => void
}

export function Header({ onOpenMenu }: HeaderProps) {
  const { pathname } = useLocation()
  const items = navigationGroups.flatMap((group) => group.items)
  const current = [...items]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))

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
          aria-label="Buscar"
          className="rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <Search className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <Bell className="size-5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-500 ring-2 ring-white" />
        </button>
      </div>
    </header>
  )
}
