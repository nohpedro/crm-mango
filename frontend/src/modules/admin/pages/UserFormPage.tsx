import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../components/AdminFormActions'
import { getAdminErrorMessage, getFieldErrors } from '../components/AdminError'
import { useListFilters } from '../hooks/useListFilters'
import { useRoles, useUser, useUserMutations } from '../hooks/useAdminQueries'
import { userSchema, type UserFormValues } from '../schemas/admin.schemas'

const emptyValues: UserFormValues = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  role: null,
  is_active: true,
}

export function UserFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const userQuery = useUser(id)
  const { filters } = useListFilters()
  const rolesQuery = useRoles({ ...filters, search: '', ordering: 'name', page: 1 })
  const { create, update } = useUserMutations()
  const mutation = isEditing ? update : create
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (userQuery.data)
      reset({
        username: userQuery.data.username,
        email: userQuery.data.email,
        first_name: userQuery.data.first_name,
        last_name: userQuery.data.last_name,
        password: '',
        role: userQuery.data.role?.id ?? null,
        is_active: userQuery.data.is_active,
      })
  }, [reset, userQuery.data])

  const onSubmit = (values: UserFormValues) => {
    if (!isEditing && !values.password) {
      setError('password', {
        message: 'La contraseña es obligatoria al crear un usuario.',
      })
      return
    }
    const payload = { ...values, password: values.password || undefined }
    const action = isEditing
      ? update.mutateAsync({ id: id ?? '', payload })
      : create.mutateAsync(payload)
    void action
      .then(() => {
        toast.success(isEditing ? 'Usuario actualizado.' : 'Usuario creado.')
        navigate('/users')
      })
      .catch((error: unknown) => {
        const fieldErrors = getFieldErrors(error)
        Object.entries(fieldErrors).forEach(([field, messages]) =>
          setError(field as keyof UserFormValues, { message: messages[0] }),
        )
        if (!Object.keys(fieldErrors).length)
          toast.error(getAdminErrorMessage(error, 'No se pudo guardar el usuario.'))
      })
  }

  const loading = userQuery.isLoading || rolesQuery.isLoading
  if (loading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Cargando formulario…
      </div>
    )
  if (userQuery.isError)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {getAdminErrorMessage(userQuery.error, 'No se pudo cargar el usuario.')}
      </div>
    )

  return (
    <>
      <PageHeading
        title={isEditing ? 'Editar usuario' : 'Nuevo usuario'}
        description={
          isEditing
            ? 'Actualiza los datos y el estado de la cuenta.'
            : 'Registra una nueva cuenta para acceder al CRM.'
        }
      />
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre de usuario" error={errors.username?.message} required>
            <input
              {...register('username')}
              className={inputClass(Boolean(errors.username))}
              autoComplete="username"
            />
          </Field>
          <Field label="Correo electrónico" error={errors.email?.message} required>
            <input
              {...register('email')}
              type="email"
              className={inputClass(Boolean(errors.email))}
              autoComplete="email"
            />
          </Field>
          <Field label="Nombre" error={errors.first_name?.message}>
            <input
              {...register('first_name')}
              className={inputClass(Boolean(errors.first_name))}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Apellido" error={errors.last_name?.message}>
            <input
              {...register('last_name')}
              className={inputClass(Boolean(errors.last_name))}
              autoComplete="family-name"
            />
          </Field>
          <Field
            label={isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            error={errors.password?.message}
            required={!isEditing}
          >
            <input
              {...register('password')}
              type="password"
              className={inputClass(Boolean(errors.password))}
              autoComplete={isEditing ? 'new-password' : 'new-password'}
            />
          </Field>
          <Field label="Rol" error={errors.role?.message}>
            <select {...register('role')} className={inputClass(Boolean(errors.role))}>
              <option value="">Sin rol</option>
              {rolesQuery.data?.results
                .filter((role) => role.is_active)
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.code})
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-700">
          <input
            {...register('is_active')}
            type="checkbox"
            className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />{' '}
          Usuario activo
        </label>
        <div className="mt-7">
          <AdminFormActions
            pending={mutation.isPending}
            cancelTo="/users"
            label={isEditing ? 'Guardar cambios' : 'Crear usuario'}
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
