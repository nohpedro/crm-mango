import { zodResolver } from '@hookform/resolvers/zod'
import { Check, LockKeyhole, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../components/AdminFormActions'
import { getAdminErrorMessage, getFieldErrors } from '../components/AdminError'
import { usePermissions, useRole, useRoleMutations } from '../hooks/useAdminQueries'
import { roleSchema, type RoleFormValues } from '../schemas/admin.schemas'
import { getFriendlyPermission, type FriendlyPermission } from '../utils/permissionCatalog'
import {
  dependenciesFor,
  includeDependencies,
  permissionCode,
  removeWithDependents,
} from '../utils/permissionDependencies'

const emptyValues: RoleFormValues = {
  name: '',
  code: '',
  description: '',
  permissions: [],
  is_active: true,
}

type PermissionGroup = {
  area: string
  resourceLabel: string
  resourceDescription: string
  order: number
  permissions: FriendlyPermission[]
}

const permissionOrder = (permission: FriendlyPermission) => {
  if (permission.codename.startsWith('view_')) return 0
  if (permission.codename.startsWith('add_')) return 1
  if (permission.codename.startsWith('change_')) return 2
  if (permission.codename.startsWith('delete_')) return 3
  return 4
}

export function RoleFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const roleQuery = useRole(id)
  const permissionsQuery = usePermissions()
  const { create, update } = useRoleMutations()
  const mutation = isEditing ? update : create
  const [search, setSearch] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: emptyValues,
  })
  const selectedPermissions = useWatch({ control, name: 'permissions' }) ?? []

  const allFriendlyPermissions = useMemo(
    () =>
      permissionsQuery.data
        ?.map(getFriendlyPermission)
        .filter((permission): permission is FriendlyPermission => Boolean(permission)) ?? [],
    [permissionsQuery.data],
  )
  const permissionByCode = useMemo(
    () =>
      new Map(
        allFriendlyPermissions.map((permission) => [permissionCode(permission), permission]),
      ),
    [allFriendlyPermissions],
  )

  useEffect(() => {
    if (roleQuery.data && allFriendlyPermissions.length)
      reset({
        name: roleQuery.data.name,
        code: roleQuery.data.code,
        description: roleQuery.data.description,
        permissions: includeDependencies(
          roleQuery.data.permissions,
          allFriendlyPermissions,
        ),
        is_active: roleQuery.data.is_active,
      })
  }, [allFriendlyPermissions, reset, roleQuery.data])

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionGroup>()
    const normalizedSearch = search.trim().toLocaleLowerCase('es')

    permissionsQuery.data?.forEach((permission) => {
      const friendly = getFriendlyPermission(permission)
      if (!friendly) return
      const searchable = `${friendly.area} ${friendly.resourceLabel} ${friendly.actionLabel}`
        .toLocaleLowerCase('es')
      if (normalizedSearch && !searchable.includes(normalizedSearch)) return

      const key = `${friendly.area}.${friendly.resourceLabel}`
      const current = groups.get(key)
      if (current) current.permissions.push(friendly)
      else
        groups.set(key, {
          area: friendly.area,
          resourceLabel: friendly.resourceLabel,
          resourceDescription: friendly.resourceDescription,
          order: friendly.order,
          permissions: [friendly],
        })
    })

    return [...groups.values()]
      .map((group) => ({
        ...group,
        permissions: group.permissions.sort(
          (a, b) => permissionOrder(a) - permissionOrder(b),
        ),
      }))
      .sort((a, b) => a.order - b.order)
  }, [permissionsQuery.data, search])

  const groupedByArea = useMemo(() => {
    const areas = new Map<string, PermissionGroup[]>()
    permissionGroups.forEach((group) => {
      areas.set(group.area, [...(areas.get(group.area) ?? []), group])
    })
    return [...areas.entries()]
  }, [permissionGroups])

  const setPermissions = (next: number[]) =>
    setValue('permissions', [...new Set(next)], { shouldDirty: true, shouldValidate: true })

  const togglePermission = (permission: FriendlyPermission) => {
    if (selectedPermissions.includes(permission.id)) {
      setPermissions(
        removeWithDependents(
          selectedPermissions,
          permission.id,
          allFriendlyPermissions,
        ),
      )
      return
    }
    const missing = dependenciesFor(permission).filter((code) => {
      const required = permissionByCode.get(code)
      return required && !selectedPermissions.includes(required.id)
    })
    if (!missing.length) setPermissions([...selectedPermissions, permission.id])
  }

  const toggleResource = (permissions: FriendlyPermission[]) => {
    const ids = permissions.map((permission) => permission.id)
    const allSelected = ids.every((permissionId) => selectedPermissions.includes(permissionId))
    setPermissions(
      allSelected
        ? ids.reduce(
            (current, permissionId) =>
              removeWithDependents(current, permissionId, allFriendlyPermissions),
            selectedPermissions,
          )
        : includeDependencies(
            [...selectedPermissions, ...ids],
            allFriendlyPermissions,
          ),
    )
  }

  const onSubmit = (values: RoleFormValues) => {
    const payload = { ...values, code: values.code.trim().toUpperCase() }
    const action = isEditing
      ? update.mutateAsync({ id: id ?? '', payload })
      : create.mutateAsync(payload)
    void action
      .then(() => {
        toast.success(isEditing ? 'Rol actualizado.' : 'Rol creado.')
        navigate('/roles')
      })
      .catch((error: unknown) => {
        const fieldErrors = getFieldErrors(error)
        Object.entries(fieldErrors).forEach(([field, messages]) =>
          setError(field as keyof RoleFormValues, { message: messages[0] }),
        )
        if (!Object.keys(fieldErrors).length)
          toast.error(getAdminErrorMessage(error, 'No se pudo guardar el rol.'))
      })
  }

  if (roleQuery.isLoading || permissionsQuery.isLoading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Cargando formulario…
      </div>
    )
  if (roleQuery.isError)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {getAdminErrorMessage(roleQuery.error, 'No se pudo cargar el rol.')}
      </div>
    )

  return (
    <>
      <PageHeading
        title={isEditing ? 'Editar rol' : 'Nuevo rol'}
        description="Define qué partes del sistema podrá consultar y administrar este perfil."
      />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="max-w-5xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nombre" error={errors.name?.message} required>
              <input {...register('name')} className={inputClass(Boolean(errors.name))} />
            </Field>
            <Field label="Código" error={errors.code?.message} required>
              <input
                {...register('code')}
                onChange={(event) =>
                  setValue('code', event.target.value.toUpperCase(), { shouldDirty: true })
                }
                className={`${inputClass(Boolean(errors.code))} font-mono uppercase`}
              />
            </Field>
            <Field label="Descripción" error={errors.description?.message}>
              <textarea
                {...register('description')}
                rows={3}
                className={`${inputClass(Boolean(errors.description))} resize-y`}
              />
            </Field>
            <div className="flex items-start pt-7">
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <input
                  {...register('is_active')}
                  type="checkbox"
                  className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Rol activo
              </label>
            </div>
          </div>
        </section>

        <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <legend className="text-base font-bold text-slate-900">Accesos del rol</legend>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Empieza habilitando “Ver”. Las demás acciones se desbloquearán únicamente
            cuando el rol tenga todos los accesos necesarios.
          </p>
          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-950">
            <p className="font-bold">{selectedPermissions.length} acciones seleccionadas</p>
            <p className="mt-1 text-brand-900/75">
              “Ver” permite consultar información y desbloquea las acciones que dependen
              de ella. Al quitarlo, también se retiran automáticamente esos accesos.
            </p>
            <p className="mt-2 text-brand-900/75">
              Para elaborar cotizaciones, asigna además “Ver” en Clientes y Productos.
            </p>
          </div>
          <label className="relative mt-5 block">
            <span className="sr-only">Buscar una función</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar, por ejemplo: productos, inventario o editar…"
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <div className="mt-6 space-y-7">
            {groupedByArea.map(([area, groups]) => (
              <section key={area}>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{area}</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {groups.map((group) => {
                    const allSelected = group.permissions.every((permission) =>
                      selectedPermissions.includes(permission.id),
                    )
                    const lockedRequirements = [
                      ...new Map(
                        group.permissions
                          .flatMap(dependenciesFor)
                          .map((code) => permissionByCode.get(code))
                          .filter(
                            (required): required is FriendlyPermission =>
                              Boolean(
                                required &&
                                  !selectedPermissions.includes(required.id),
                              ),
                          )
                          .map((required) => [permissionCode(required), required]),
                      ).values(),
                    ]
                    return (
                      <section key={group.resourceLabel} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-800">{group.resourceLabel}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {group.resourceDescription}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleResource(group.permissions)}
                            className="shrink-0 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
                          >
                            {allSelected ? 'Quitar todo' : 'Todo'}
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {group.permissions.map((permission) => {
                            const selected = selectedPermissions.includes(permission.id)
                            const missingDependencies = dependenciesFor(permission)
                              .map((code) => permissionByCode.get(code))
                              .filter(
                                (required): required is FriendlyPermission =>
                                  Boolean(
                                    required &&
                                      !selectedPermissions.includes(required.id),
                                  ),
                              )
                            const locked = !selected && missingDependencies.length > 0
                            const requirement = missingDependencies
                              .map(
                                (required) =>
                                  `${required.actionLabel} ${required.resourceLabel}`,
                              )
                              .join(', ')
                            return (
                              <button
                                key={permission.id}
                                type="button"
                                onClick={() => togglePermission(permission)}
                                disabled={locked}
                                title={locked ? `Primero habilita: ${requirement}` : undefined}
                                aria-pressed={selected}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                                  selected
                                    ? 'border-brand-600 bg-brand-600 text-white'
                                    : locked
                                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                                    : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50'
                                }`}
                              >
                                {selected && <Check className="size-3.5" />}
                                {locked && <LockKeyhole className="size-3.5" />}
                                {permission.actionLabel}
                              </button>
                            )
                          })}
                        </div>
                        {lockedRequirements.length > 0 && (
                          <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                            Para desbloquear: {lockedRequirements
                              .map(
                                (required) =>
                                  `${required.actionLabel} ${required.resourceLabel}`,
                              )
                              .join(', ')}.
                          </p>
                        )}
                      </section>
                    )
                  })}
                </div>
              </section>
            ))}
            {!permissionGroups.length && (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No encontramos funciones con esa búsqueda.
              </p>
            )}
          </div>
          {errors.permissions && (
            <span role="alert" className="mt-2 block text-xs text-red-600">
              {errors.permissions.message}
            </span>
          )}
        </fieldset>
        <AdminFormActions
          pending={mutation.isPending}
          cancelTo="/roles"
          label={isEditing ? 'Guardar cambios' : 'Crear rol'}
        />
      </form>
    </>
  )
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-xs font-normal text-red-600">
          {error}
        </span>
      )}
    </label>
  )
}

const inputClass = (error: boolean) =>
  `mt-2 w-full rounded-xl border ${error ? 'border-red-400' : 'border-slate-300'} bg-white px-3.5 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100`
