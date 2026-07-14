import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../components/AdminFormActions'
import { getAdminErrorMessage, getFieldErrors } from '../components/AdminError'
import { usePermissions, useRole, useRoleMutations } from '../hooks/useAdminQueries'
import { roleSchema, type RoleFormValues } from '../schemas/admin.schemas'

const emptyValues: RoleFormValues = {
  name: '',
  code: '',
  description: '',
  permissions: [],
  is_active: true,
}

export function RoleFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const roleQuery = useRole(id)
  const permissionsQuery = usePermissions()
  const { create, update } = useRoleMutations()
  const mutation = isEditing ? update : create
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
  const selectedPermissions = useWatch({ control, name: 'permissions' })

  useEffect(() => {
    if (roleQuery.data)
      reset({
        name: roleQuery.data.name,
        code: roleQuery.data.code,
        description: roleQuery.data.description,
        permissions: roleQuery.data.permissions,
        is_active: roleQuery.data.is_active,
      })
  }, [reset, roleQuery.data])

  const groupedPermissions = (() => {
    const groups = new Map<string, typeof permissionsQuery.data>()
    permissionsQuery.data?.forEach((permission) => {
      const key = `${permission.app_label}.${permission.model}`
      groups.set(key, [...(groups.get(key) ?? []), permission])
    })
    return [...groups.entries()]
  })()

  const togglePermission = (permissionId: number) => {
    setValue(
      'permissions',
      selectedPermissions.includes(permissionId)
        ? selectedPermissions.filter((idValue) => idValue !== permissionId)
        : [...selectedPermissions, permissionId],
      { shouldDirty: true, shouldValidate: true },
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
        description="Configura el perfil y los permisos administrativos disponibles."
      />
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
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
              />{' '}
              Rol activo
            </label>
          </div>
        </div>
        <fieldset className="mt-7">
          <legend className="text-sm font-bold text-slate-800">Permisos asignados</legend>
          <p className="mt-1 text-xs text-slate-500">
            Selecciona los permisos Django que pertenecerán a este rol.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {groupedPermissions.map(([group, permissions]) => (
              <div key={group} className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 font-mono text-xs font-bold text-brand-700">{group}</p>
                <div className="space-y-2">
                  {permissions?.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex cursor-pointer items-start gap-2 text-xs text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                        className="mt-0.5 size-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>
                        {permission.name}{' '}
                        <span className="font-mono text-[0.65rem] text-slate-400">
                          ({permission.codename})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {errors.permissions && (
            <span role="alert" className="mt-2 block text-xs text-red-600">
              {errors.permissions.message}
            </span>
          )}
        </fieldset>
        <div className="mt-7">
          <AdminFormActions
            pending={mutation.isPending}
            cancelTo="/roles"
            label={isEditing ? 'Guardar cambios' : 'Crear rol'}
          />
        </div>
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
