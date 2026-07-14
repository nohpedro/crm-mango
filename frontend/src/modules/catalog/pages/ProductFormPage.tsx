import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../../admin/components/AdminFormActions'
import { getAdminErrorMessage, getFieldErrors } from '../../admin/components/AdminError'
import {
  useCategories,
  useProduct,
  useProductImageMutations,
  useProductMutations,
} from '../hooks/useCatalogQueries'
import { productSchema, type ProductFormValues } from '../schemas/catalog.schemas'

const empty: ProductFormValues = {
  category: '',
  name: '',
  sku: '',
  barcode: null,
  description: '',
  is_active: true,
}

export function ProductFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const productQuery = useProduct(id)
  const categoriesQuery = useCategories({
    search: '',
    category: '',
    sku: '',
    is_active: 'true',
    include_deleted: false,
    ordering: 'name',
    page: 1,
  })
  const { create, update } = useProductMutations()
  const imageMutations = useProductImageMutations(id)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imageError, setImageError] = useState('')
  const mutation = editing ? update : create
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: empty,
  })
  useEffect(() => {
    if (productQuery.data)
      reset({
        category: productQuery.data.category.id,
        name: productQuery.data.name,
        sku: productQuery.data.sku,
        barcode: productQuery.data.barcode,
        description: productQuery.data.description,
        is_active: productQuery.data.is_active,
      })
  }, [productQuery.data, reset])
  const onSubmit = (values: ProductFormValues) => {
    const payload = {
      ...values,
      name: values.name.trim(),
      sku: values.sku.trim().toUpperCase(),
      barcode: values.barcode?.trim() || null,
    }
    const action = editing
      ? update.mutateAsync({ id: id ?? '', payload })
      : create.mutateAsync(payload)
    void action
      .then(async (savedProduct) => {
        if (selectedImages.length) {
          const hasPrimary =
            savedProduct.images?.some((image) => image.is_primary) ?? false
          await Promise.all(
            selectedImages.map((image, index) =>
              imageMutations.upload.mutateAsync({
                product: savedProduct.id,
                image,
                position: index,
                is_primary: !hasPrimary && index === 0,
              }),
            ),
          )
        }
        toast.success(
          selectedImages.length
            ? `${editing ? 'Producto actualizado' : 'Producto creado'} con imágenes.`
            : editing
              ? 'Producto actualizado.'
              : 'Producto creado.',
        )
        navigate(`/products/${savedProduct.id}`)
      })
      .catch((error: unknown) => {
        const fields = getFieldErrors(error)
        if (selectedImages.length && !Object.keys(fields).length)
          setImageError(getAdminErrorMessage(error, 'No se pudieron subir las imágenes.'))
        Object.entries(fields).forEach(([field, messages]) =>
          setError(field as keyof ProductFormValues, { message: messages[0] }),
        )
        if (!Object.keys(fields).length)
          toast.error(getAdminErrorMessage(error, 'No se pudo guardar el producto.'))
      })
  }
  if (productQuery.isLoading || categoriesQuery.isLoading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Cargando formulario…
      </div>
    )
  if (productQuery.isError)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {getAdminErrorMessage(productQuery.error, 'No se pudo cargar el producto.')}
      </div>
    )
  return (
    <>
      <PageHeading
        title={`${editing ? 'Editar' : 'Nuevo'} producto`}
        description="Registra la información comercial y el estado del producto."
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
          <Field label="SKU" error={errors.sku?.message} required>
            <input
              {...register('sku')}
              className={`${inputClass(Boolean(errors.sku))} font-mono uppercase`}
            />
          </Field>
          <Field label="Categoría" error={errors.category?.message} required>
            <select
              {...register('category')}
              className={inputClass(Boolean(errors.category))}
            >
              <option value="">Selecciona una categoría</option>
              {categoriesQuery.data?.results.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Código de barras" error={errors.barcode?.message}>
            <input
              {...register('barcode')}
              className={inputClass(Boolean(errors.barcode))}
            />
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            <textarea
              {...register('description')}
              rows={5}
              className={`${inputClass(Boolean(errors.description))} resize-y`}
            />
          </Field>
          <label className="flex items-start gap-3 pt-7 text-sm font-semibold text-slate-700">
            <input
              {...register('is_active')}
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 text-brand-600"
            />{' '}
            Producto activo
          </label>
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <label className="block text-sm font-semibold text-slate-700">
            Imágenes del producto{' '}
            <span className="font-normal text-slate-500">(opcional)</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                const invalid = files.find(
                  (file) =>
                    !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024,
                )
                if (invalid) {
                  setImageError('Usa imágenes JPG, PNG o WebP de máximo 5 MB cada una.')
                  setSelectedImages([])
                  return
                }
                setImageError('')
                setSelectedImages(files)
              }}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Puedes seleccionar varias imágenes. La primera se usará como portada cuando el
            producto todavía no tenga una.
          </p>
          {selectedImages.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {selectedImages.map((file) => (
                <div key={`${file.name}-${file.lastModified}`} className="w-24">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="size-24 rounded-xl object-cover"
                  />
                  <p className="mt-1 truncate text-[11px] text-slate-500">{file.name}</p>
                </div>
              ))}
            </div>
          )}
          {imageError && (
            <p className="mt-2 text-xs font-semibold text-red-600">{imageError}</p>
          )}
          {editing && id && (
            <p className="mt-3 text-xs text-slate-500">
              Para cambiar la portada o quitar imágenes, usa{' '}
              <Link className="font-bold text-brand-700" to={`/products/${id}/images`}>
                Administrar imágenes
              </Link>
              .
            </p>
          )}
        </div>
        <div className="mt-7">
          <AdminFormActions
            pending={mutation.isPending}
            cancelTo="/products"
            label={editing ? 'Guardar cambios' : 'Crear producto'}
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
