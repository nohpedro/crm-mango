import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { PageHeading } from '../../../components/common/PageHeading'
import { getAdminErrorMessage } from '../components/AdminError'
import { AdminTable, Pagination } from '../components/AdminTable'
import { useListFilters } from '../hooks/useListFilters'
import { useUserMutations, useUsers } from '../hooks/useAdminQueries'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'

export function UsersPage() {
  const { filters, update } = useListFilters()
  const currentUser = useAuthStore((state) => state.user)
  const currentUserId = currentUser?.id
  const canAdd = hasPermission(currentUser, 'users.add_user')
  const canChange = hasPermission(currentUser, 'users.change_user')
  const query = useUsers(filters)
  const { update: updateUser } = useUserMutations()
  const [pendingUser, setPendingUser] = useState<{
    id: string
    activate: boolean
    name: string
  } | null>(null)
  const users = query.data?.results ?? []
  const confirmUser = () => {
    if (!pendingUser) return
    void updateUser
      .mutateAsync({ id: pendingUser.id, payload: { is_active: pendingUser.activate } })
      .then(() =>
        toast.success(
          pendingUser.activate ? 'Usuario activado.' : 'Usuario desactivado.',
        ),
      )
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo actualizar el usuario.')),
      )
      .finally(() => setPendingUser(null))
  }

  return (
    <>
      <PageHeading
        title="Usuarios"
        description="Administra cuentas, estados y roles de acceso del CRM."
        action={
          canAdd ? <Link
            to="/users/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
          >
            <UserPlus className="size-4" /> Nuevo usuario
          </Link> : null
        }
      />
      <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar usuarios</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(event) => update({ search: event.target.value, page: 1 })}
            placeholder="Buscar por nombre, usuario, correo o rol…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
        <select
          aria-label="Ordenar usuarios"
          value={filters.ordering}
          onChange={(event) => update({ ordering: event.target.value, page: 1 })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand-500"
        >
          <option value="">Orden predeterminado</option>
          <option value="username">Usuario A–Z</option>
          <option value="-created_at">Más recientes</option>
          <option value="last_login">Último acceso</option>
        </select>
      </section>
      <AdminTable
        headers={['Usuario', 'Correo', 'Rol', 'Estado', 'Último acceso', 'Acciones']}
        loading={query.isLoading}
        error={
          query.error
            ? getAdminErrorMessage(query.error, 'No se pudieron cargar los usuarios.')
            : undefined
        }
        empty={!users.length}
        onRetry={() => void query.refetch()}
      >
        {users.map((user) => (
          <tr key={user.id} className="hover:bg-slate-50/70">
            <td className="whitespace-nowrap px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {(user.full_name || user.username).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    {user.full_name || user.username}
                  </p>
                  <p className="text-xs text-slate-500">@{user.username}</p>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-600">{user.email}</td>
            <td className="whitespace-nowrap px-5 py-4">
              {user.role ? (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {user.role.name}
                </span>
              ) : (
                <span className="text-slate-400">Sin rol</span>
              )}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <span
                className={
                  user.is_active
                    ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                    : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700'
                }
              >
                {user.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-500">
              {user.last_login
                ? new Date(user.last_login).toLocaleDateString('es-BO')
                : 'Nunca'}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <div className="flex items-center gap-3">
                {canChange && <Link
                  to={`/users/${user.id}/edit`}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800"
                >
                  Editar
                </Link>}
                {canChange && (user.id === currentUserId && user.is_active ? (
                  <span
                    title="No puedes desactivar tu propio usuario."
                    className="text-xs font-semibold text-slate-400"
                  >
                    Tu cuenta
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={updateUser.isPending}
                    onClick={() =>
                      setPendingUser({
                        id: user.id,
                        activate: !user.is_active,
                        name: user.full_name || user.username,
                      })
                    }
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                  >
                    {user.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {query.data && (
        <Pagination
          page={filters.page}
          count={query.data.count}
          onPageChange={(page) => update({ page })}
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingUser)}
        title={
          pendingUser?.activate ? '¿Activar este usuario?' : '¿Desactivar este usuario?'
        }
        description={`El cambio afectará el acceso de ${pendingUser?.name ?? 'esta persona'} al CRM.`}
        confirmLabel={pendingUser?.activate ? 'Activar usuario' : 'Desactivar usuario'}
        danger={pendingUser ? !pendingUser.activate : false}
        pending={updateUser.isPending}
        onClose={() => setPendingUser(null)}
        onConfirm={confirmUser}
      />
    </>
  )
}
