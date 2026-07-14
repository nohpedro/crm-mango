import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { PageHeading } from '../../../components/common/PageHeading'
import { getAdminErrorMessage } from '../components/AdminError'
import { AdminTable, Pagination } from '../components/AdminTable'
import { useListFilters } from '../hooks/useListFilters'
import { useRoleMutations, useRoles } from '../hooks/useAdminQueries'

export function RolesPage() {
  const { filters, update } = useListFilters()
  const query = useRoles(filters)
  const { update: updateRole } = useRoleMutations()
  const [pendingRole, setPendingRole] = useState<{
    id: string
    activate: boolean
    name: string
  } | null>(null)
  const roles = query.data?.results ?? []
  const confirmRole = () => {
    if (!pendingRole) return
    void updateRole
      .mutateAsync({ id: pendingRole.id, payload: { is_active: pendingRole.activate } })
      .then(() =>
        toast.success(pendingRole.activate ? 'Rol activado.' : 'Rol desactivado.'),
      )
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo actualizar el rol.')),
      )
      .finally(() => setPendingRole(null))
  }
  return (
    <>
      <PageHeading
        title="Roles y permisos"
        description="Define perfiles de acceso y asigna permisos del sistema."
        action={
          <Link
            to="/roles/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" /> Nuevo rol
          </Link>
        }
      />
      <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar roles</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(event) => update({ search: event.target.value, page: 1 })}
            placeholder="Buscar por nombre, código o descripción…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
        <select
          aria-label="Ordenar roles"
          value={filters.ordering}
          onChange={(event) => update({ ordering: event.target.value, page: 1 })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand-500"
        >
          <option value="">Orden predeterminado</option>
          <option value="name">Nombre A–Z</option>
          <option value="-created_at">Más recientes</option>
        </select>
      </section>
      <AdminTable
        headers={['Rol', 'Código', 'Permisos', 'Estado', 'Actualizado', 'Acciones']}
        loading={query.isLoading}
        error={
          query.error
            ? getAdminErrorMessage(query.error, 'No se pudieron cargar los roles.')
            : undefined
        }
        empty={!roles.length}
        onRetry={() => void query.refetch()}
      >
        {roles.map((role) => (
          <tr key={role.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-800">{role.name}</p>
              <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                {role.description || 'Sin descripción'}
              </p>
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                {role.code}
              </span>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-600">
              {role.permission_details?.length ?? role.permissions.length}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <span
                className={
                  role.is_active
                    ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                    : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700'
                }
              >
                {role.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-500">
              {new Date(role.updated_at).toLocaleDateString('es-BO')}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <div className="flex items-center gap-3">
                <Link
                  to={`/roles/${role.id}/edit`}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  disabled={updateRole.isPending}
                  onClick={() =>
                    setPendingRole({
                      id: role.id,
                      activate: !role.is_active,
                      name: role.name,
                    })
                  }
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                >
                  {role.is_active ? 'Desactivar' : 'Activar'}
                </button>
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
        open={Boolean(pendingRole)}
        title={pendingRole?.activate ? '¿Activar este rol?' : '¿Desactivar este rol?'}
        description={`El cambio afectará el acceso de las personas que usan ${pendingRole?.name ?? 'este rol'}.`}
        confirmLabel={pendingRole?.activate ? 'Activar rol' : 'Desactivar rol'}
        danger={pendingRole ? !pendingRole.activate : false}
        pending={updateRole.isPending}
        onClose={() => setPendingRole(null)}
        onConfirm={confirmRole}
      />
    </>
  )
}
