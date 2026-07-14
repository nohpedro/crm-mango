import { LogOut, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { navigationGroups } from '../../config/navigation'
import { useLogout } from '../../modules/auth/hooks/useLogout'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../utils/cn'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const displayName = user?.full_name || user?.username || 'Usuario'
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] lg:hidden',
          isOpen ? 'block' : 'hidden',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-900 text-white shadow-2xl transition-transform duration-200 lg:static lg:w-64 lg:translate-x-0 lg:shadow-none',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-500 text-base font-bold shadow-lg shadow-brand-950/30">
            IS
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide">IDESEM S.R.L.</p>
            <p className="truncate text-xs text-slate-300">Gestión comercial</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <nav
          aria-label="Navegación principal"
          className="flex-1 overflow-y-auto px-3 py-5"
        >
          {navigationGroups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items
                  .filter((item) => !item.adminOnly || user?.is_admin)
                  .map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white',
                            isActive && 'bg-brand-500 text-white shadow-sm',
                          )
                        }
                      >
                        <Icon className="size-[1.1rem]" aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.adminOnly && (
                          <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide">
                            Admin
                          </span>
                        )}
                      </NavLink>
                    )
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
            <div className="grid size-9 place-items-center rounded-full bg-brand-700 text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{displayName}</p>
              <p className="truncate text-[0.68rem] text-slate-400">
                {user?.is_admin ? 'Administrador' : user?.role?.name || 'Usuario'}
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              disabled={logout.isPending}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
              onClick={() => logout.mutate()}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
