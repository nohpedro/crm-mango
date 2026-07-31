import { LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import idesemLogo from '../../assets/IDESEM_sin_fondo.png'
import { navigationGroups } from '../../config/navigation'
import { useLogout } from '../../modules/auth/hooks/useLogout'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../utils/cn'
import { hasAnyPermission } from '../../utils/permissions'

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapsed: () => void
}

export function Sidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapsed,
}: SidebarProps) {
  const user = useAuthStore((state) => state.user)
  const { pathname } = useLocation()
  const logout = useLogout()
  const displayName = user?.full_name || user?.username || 'Usuario'
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const visiblePaths = navigationGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        (!item.adminOnly || user?.is_admin) &&
        hasAnyPermission(user, item.requiredAnyPermissions),
    )
    .map((item) => item.path)
  const activePath = [...visiblePaths]
    .sort((left, right) => right.length - left.length)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`))

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
          'fixed inset-y-0 left-0 z-40 flex h-dvh w-72 flex-col overflow-hidden bg-brand-900 text-white shadow-2xl transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0 lg:shadow-none',
          isCollapsed ? 'lg:w-24' : 'lg:w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-20 items-center gap-3 border-b border-white/10 px-4',
            isCollapsed && 'lg:justify-between lg:gap-1 lg:px-2',
          )}
        >
          <div
            className={cn(
              'grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-brand-950/30 transition-transform duration-200 hover:scale-[1.03]',
              isCollapsed && 'lg:size-9',
            )}
          >
            <img
              src={idesemLogo}
              alt="Logo IDESEM"
              className="size-full object-contain"
            />
          </div>
          <div
            className={cn(
              'min-w-0 overflow-hidden transition-all duration-200',
              isCollapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-40 opacity-100',
            )}
          >
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
          <button
            type="button"
            aria-label={isCollapsed ? 'Expandir menÃº' : 'Contraer menÃº'}
            title={isCollapsed ? 'Expandir menÃº' : 'Contraer menÃº'}
            className={cn(
              'hidden rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex',
              isCollapsed ? 'lg:ml-0 lg:p-1.5' : 'ml-auto',
            )}
            onClick={onToggleCollapsed}
          >
            {isCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>

        <nav
          aria-label="Navegación principal"
          className="sidebar-navigation min-h-0 flex-1 overflow-y-auto px-3 py-5"
        >
          {navigationGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) =>
                (!item.adminOnly || user?.is_admin) &&
                hasAnyPermission(user, item.requiredAnyPermissions),
            )
            if (!visibleItems.length) return null
            return (
            <div key={group.label} className="mb-6">
              <p
                className={cn(
                  'mb-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400 transition-opacity duration-200',
                  isCollapsed && 'lg:h-0 lg:overflow-hidden lg:opacity-0',
                )}
              >
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        title={isCollapsed ? item.label : undefined}
                        className={() =>
                          cn(
                            'group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:translate-x-0.5 hover:bg-white/8 hover:text-white',
                            isCollapsed && 'lg:justify-center lg:px-2 lg:hover:translate-x-0',
                            activePath === item.path &&
                              'border-white/10 bg-brand-500 text-white shadow-sm shadow-brand-950/20',
                          )
                        }
                      >
                        <span
                          className={cn(
                            'grid size-7 place-items-center rounded-lg transition-colors group-hover:bg-white/10',
                            activePath === item.path && 'bg-white/12',
                          )}
                        >
                          <Icon className="size-[1.05rem]" aria-hidden="true" />
                        </span>
                        <span
                          className={cn(
                            'min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200',
                            isCollapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-44 opacity-100',
                          )}
                        >
                          {item.label}
                        </span>
                        {item.adminOnly && (
                          <span
                            className={cn(
                              'ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide',
                              isCollapsed && 'lg:hidden',
                            )}
                          >
                            Admin
                          </span>
                        )}
                      </NavLink>
                    )
                  })}
              </div>
            </div>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl bg-white/6 p-3 transition-colors duration-200 hover:bg-white/10',
              isCollapsed && 'lg:justify-center lg:p-2',
            )}
          >
            <div className="grid size-9 place-items-center rounded-full bg-brand-700 text-xs font-bold">
              {initials}
            </div>
            <div
              className={cn(
                'min-w-0 flex-1 overflow-hidden transition-all duration-200',
                isCollapsed && 'lg:max-w-0 lg:opacity-0',
              )}
            >
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
              className={cn(
                'rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50',
                isCollapsed && 'lg:hidden',
              )}
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
