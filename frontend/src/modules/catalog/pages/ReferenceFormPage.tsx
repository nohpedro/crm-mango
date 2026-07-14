import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../../admin/components/AdminFormActions'
import { getAdminErrorMessage, getFieldErrors } from '../../admin/components/AdminError'
import { catalogWriteSchema, type CatalogWriteValues } from '../schemas/catalog.schemas'
import {
  useCategory,
  useCategoryMutations,
  usePriceLevel,
  usePriceLevelMutations,
} from '../hooks/useCatalogQueries'

interface ReferenceFormPageProps {
  kind: 'category' | 'price-level'
}
const empty: CatalogWriteValues = { name: '', code: '', description: '', is_active: true }

export function ReferenceFormPage({ kind }: ReferenceFormPageProps) {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const isCategory = kind === 'category'
  const categoryQuery = useCategory(isCategory ? id : undefined)
  const levelQuery = usePriceLevel(!isCategory ? id : undefined)
  const query = isCategory ? categoryQuery : levelQuery
  const categoryMutation = useCategoryMutations()
  const levelMutation = usePriceLevelMutations()
  const pending = editing
    ? isCategory
      ? categoryMutation.update.isPending
      : levelMutation.update.isPending
    : isCategory
      ? categoryMutation.create.isPending
      : levelMutation.create.isPending
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CatalogWriteValues>({
    resolver: zodResolver(catalogWriteSchema),
    defaultValues: empty,
  })

  useEffect(() => {
    if (query.data)
      reset({
        name: query.data.name,
        code: query.data.code,
        description: query.data.description,
        is_active: query.data.is_active,
      })
  }, [query.data, reset])
  const onSubmit = (values: CatalogWriteValues) => {
    const payload = { ...values, code: values.code.toUpperCase() }
    const action = editing
      ? isCategory
        ? categoryMutation.update.mutateAsync({ id: id ?? '', payload })
        : levelMutation.update.mutateAsync({ id: id ?? '', payload })
      : isCategory
        ? categoryMutation.create.mutateAsync(payload)
        : levelMutation.create.mutateAsync(payload)
    void action
      .then(() => {
        toast.success(`${isCategory ? 'Categoría' : 'Nivel'} guardado.`)
        navigate(isCategory ? '/categories' : '/price-levels')
      })
      .catch((error: unknown) => {
        const fields = getFieldErrors(error)
        Object.entries(fields).forEach(([field, messages]) =>
          setError(field as keyof CatalogWriteValues, { message: messages[0] }),
        )
        if (!Object.keys(fields).length)
          toast.error(getAdminErrorMessage(error, 'No se pudo guardar el registro.'))
      })
  }
  if (query.isLoading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Cargando formulario…
      </div>
    )
  if (query.isError)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {getAdminErrorMessage(query.error, 'No se pudo cargar el registro.')}
      </div>
    )
  return (
    <>
      <PageHeading
        title={`${editing ? 'Editar' : 'Nueva'} ${isCategory ? 'categoría' : 'nivel de precio'}`}
        description="Mantén los datos identificadores y el estado del registro."
      />
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.name?.message}>
            <input {...register('name')} className={inputClass(Boolean(errors.name))} />
          </Field>
          <Field label="Código" required error={errors.code?.message}>
            <input
              {...register('code')}
              className={`${inputClass(Boolean(errors.code))} font-mono uppercase`}
            />
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            <textarea
              {...register('description')}
              rows={4}
              className={`${inputClass(Boolean(errors.description))} resize-y`}
            />
          </Field>
          <label className="flex items-start gap-3 pt-7 text-sm font-semibold text-slate-700">
            <input
              {...register('is_active')}
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 text-brand-600"
            />{' '}
            Registro activo
          </label>
        </div>
        <div className="mt-7">
          <AdminFormActions
            pending={pending}
            cancelTo={isCategory ? '/categories' : '/price-levels'}
            label={editing ? 'Guardar cambios' : 'Crear registro'}
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
