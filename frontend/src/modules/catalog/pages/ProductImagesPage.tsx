import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { PageHeading } from '../../../components/common/PageHeading'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useProduct, useProductImageMutations } from '../hooks/useCatalogQueries'

export function ProductImagesPage() {
  const { id } = useParams()
  const query = useProduct(id)
  const mutations = useProductImageMutations(id)
  const [files, setFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState('')
  const [imageToDelete, setImageToDelete] = useState<{ id: string; name: string } | null>(
    null,
  )

  if (query.isLoading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Cargando imágenes…
      </div>
    )
  if (query.isError || !query.data)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {getAdminErrorMessage(query.error, 'No se pudo cargar el catálogo de imágenes.')}
      </div>
    )

  const product = query.data
  const busy = Object.values(mutations).some((mutation) => mutation.isPending)
  const upload = () => {
    if (!files.length) return
    const hasPrimary = product.images.some((image) => image.is_primary)
    void Promise.all(
      files.map((file, index) =>
        mutations.upload.mutateAsync({
          product: product.id,
          image: file,
          position: product.images.length + index,
          is_primary: !hasPrimary && index === 0,
        }),
      ),
    )
      .then(() => {
        toast.success(files.length === 1 ? 'Imagen agregada.' : 'Imágenes agregadas.')
        setFiles([])
        setUploadError('')
      })
      .catch((error: unknown) =>
        setUploadError(getAdminErrorMessage(error, 'No se pudieron subir las imágenes.')),
      )
  }
  const setPrimary = (imageId: string) => {
    void mutations.update
      .mutateAsync({ id: imageId, payload: { is_primary: true } })
      .then(() => toast.success('Portada actualizada.'))
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo actualizar la portada.')),
      )
  }
  const remove = () => {
    if (!imageToDelete) return
    void mutations.remove
      .mutateAsync(imageToDelete.id)
      .then(() => {
        toast.success('Imagen quitada del producto.')
        setImageToDelete(null)
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo quitar la imagen.')),
      )
  }

  return (
    <>
      <PageHeading
        title="Imágenes del producto"
        description={`Organiza la galería de ${product.name}. Usa una imagen de portada para mostrar el producto en el catálogo.`}
        action={
          <Link
            to={`/products/${product.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            <ArrowLeft className="size-4" /> Volver al producto
          </Link>
        }
      />
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Agregar imágenes</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              Selecciona una o varias imágenes JPG, PNG o WebP. Cada archivo puede pesar
              hasta 5 MB.
            </p>
          </div>
          <button
            type="button"
            disabled={!files.length || busy}
            onClick={upload}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="size-4" /> Subir imágenes
          </button>
        </div>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? [])
            const invalid = selected.find(
              (file) => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024,
            )
            if (invalid) {
              setUploadError('Usa imágenes JPG, PNG o WebP de máximo 5 MB cada una.')
              setFiles([])
              return
            }
            setUploadError('')
            setFiles(selected)
          }}
          className="mt-4 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
        />
        {files.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-slate-600">
            {files.length}{' '}
            {files.length === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}
          </p>
        )}
        {uploadError && (
          <p className="mt-2 text-xs font-semibold text-red-600">{uploadError}</p>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Galería</h3>
            <p className="mt-1 text-sm text-slate-500">
              {product.images.length}{' '}
              {product.images.length === 1 ? 'imagen' : 'imágenes'} guardadas
            </p>
          </div>
        </div>
        {product.images.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {product.images.map((image) => (
              <article
                key={image.id}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="relative aspect-square bg-slate-100">
                  <img
                    src={image.image}
                    alt={image.alt_text || product.name}
                    className="size-full object-cover"
                  />
                  {image.is_primary && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-700 shadow-sm">
                      <Star className="size-3 fill-current" /> Portada
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  {!image.is_primary ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPrimary(image.id)}
                      className="text-xs font-bold text-brand-700 hover:text-brand-900 disabled:opacity-50"
                    >
                      Usar como portada
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">
                      Imagen principal
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Quitar imagen de ${product.name}`}
                    disabled={busy}
                    onClick={() => setImageToDelete({ id: image.id, name: product.name })}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
            Este producto todavía no tiene imágenes.
          </div>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(imageToDelete)}
        title="¿Quitar esta imagen?"
        description="La imagen se quitará de este producto. Esta acción no elimina las demás imágenes de la galería."
        confirmLabel="Quitar imagen"
        danger
        pending={mutations.remove.isPending}
        onClose={() => setImageToDelete(null)}
        onConfirm={remove}
      />
    </>
  )
}
