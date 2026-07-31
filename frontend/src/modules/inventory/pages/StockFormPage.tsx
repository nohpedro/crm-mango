import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../../admin/components/AdminFormActions'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useProducts } from '../../catalog/hooks/useCatalogQueries'
import { useStock, useStockMutations, useWarehouses } from '../hooks/useInventory'
const schema = z.object({
  product: z.string().min(1, 'Selecciona un producto.'),
  warehouse: z.string().min(1, 'Selecciona un almacén.'),
  minimum_stock: z.number().int().min(0, 'No puede ser negativo.'),
})
type Values = z.infer<typeof schema>
export function StockFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const nav = useNavigate()
  const stock = useStock(id)
  const warehouses = useWarehouses({ is_active: true, page: 1 })
  const products = useProducts({
    search: '',
    category: '',
    sku: '',
    is_active: 'true',
    include_deleted: false,
    ordering: 'name',
    page: 1,
  })
  const m = useStockMutations()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (stock.data)
      reset({
        product: stock.data.product.id,
        warehouse: stock.data.warehouse.id,
        minimum_stock: stock.data.minimum_stock,
      })
  }, [stock.data, reset])
  const submit = (v: Values) =>
    void (
      editing
        ? m.update.mutateAsync({ id: id!, minimum_stock: v.minimum_stock })
        : m.create.mutateAsync(v)
    )
      .then(() => {
        toast.success('Existencia guardada.')
        nav('/inventory/stocks')
      })
      .catch((e: unknown) =>
        toast.error(getAdminErrorMessage(e, 'No se pudo guardar la existencia.')),
      )
  return (
    <>
      <PageHeading
        title={`${editing ? 'Editar' : 'Nueva'} existencia`}
        description="Relaciona un producto con un almacén y define su stock mínimo."
      />
      <form
        onSubmit={handleSubmit(submit)}
        className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Producto
            <select
              disabled={editing}
              {...register('product')}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            >
              <option value="">Selecciona un producto</option>
              {products.data?.results.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            {errors.product && (
              <span className="text-xs text-red-600">{errors.product.message}</span>
            )}
          </label>
          <label className="text-sm font-semibold">
            Almacén
            <select
              disabled={editing}
              {...register('warehouse')}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            >
              <option value="">Selecciona un almacén</option>
              {warehouses.data?.results.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            {errors.warehouse && (
              <span className="text-xs text-red-600">{errors.warehouse.message}</span>
            )}
          </label>
          <label className="text-sm font-semibold">
            Stock mínimo
            <input
              type="number"
              min="0"
              {...register('minimum_stock', { valueAsNumber: true })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            />
            {errors.minimum_stock && (
              <span className="text-xs text-red-600">{errors.minimum_stock.message}</span>
            )}
          </label>
        </div>
        <div className="mt-7">
          <AdminFormActions
            pending={m.create.isPending || m.update.isPending}
            cancelTo="/inventory/stocks"
            label={editing ? 'Guardar cambios' : 'Crear existencia'}
          />
        </div>
      </form>
    </>
  )
}
