import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../../admin/components/AdminFormActions'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useStocks, useMovementMutation } from '../hooks/useInventory'
const schema = z.object({
  stock: z.string().min(1, 'Selecciona una existencia.'),
  movement_type: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT']),
  quantity: z.number().refine((v) => v !== 0, 'La cantidad no puede ser cero.'),
  reference: z.string().max(120),
  notes: z.string().max(2000),
})
type Values = z.infer<typeof schema>
export function MovementFormPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const stocks = useStocks({ page: 1, product: searchParams.get('product') || undefined })
  const m = useMovementMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      movement_type: searchParams.get('type') === 'ENTRY' ? 'ENTRY' : 'ENTRY',
      quantity: 1,
      reference: '',
      notes: '',
    },
  })
  useEffect(() => {
    if (stocks.data?.results.length === 1)
      reset((current) => ({ ...current, stock: stocks.data!.results[0].id }))
  }, [stocks.data, reset])
  const submit = (v: Values) =>
    void m
      .mutateAsync(v)
      .then(() => {
        toast.success('Movimiento registrado.')
        nav('/inventory/movements')
      })
      .catch((e: unknown) =>
        toast.error(getAdminErrorMessage(e, 'No se pudo registrar el movimiento.')),
      )
  return (
    <>
      <PageHeading
        title="Registrar movimiento"
        description="Registra una entrada, salida o ajuste y actualiza el stock en una sola operación."
      />
      <div className="mb-4">
        <Link to="/inventory/movements" className="text-sm font-bold text-brand-700">
          ← Regresar a movimientos
        </Link>
      </div>
      <form
        onSubmit={handleSubmit(submit)}
        className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">
            Existencia
            <select
              {...register('stock')}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            >
              <option value="">Selecciona producto y almacén</option>
              {stocks.data?.results.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.product.name} ({s.product.sku}) — {s.warehouse.name}
                </option>
              ))}
            </select>
            {errors.stock && (
              <span className="text-xs text-red-600">{errors.stock.message}</span>
            )}
          </label>
          <label className="text-sm font-semibold">
            Tipo
            <select
              {...register('movement_type')}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            >
              <option value="ENTRY">Entrada</option>
              <option value="EXIT">Salida</option>
              <option value="ADJUSTMENT">Ajuste</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Cantidad
            <input
              type="number"
              {...register('quantity', { valueAsNumber: true })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            />
            {errors.quantity && (
              <span className="text-xs text-red-600">{errors.quantity.message}</span>
            )}
          </label>
          <label className="text-sm font-semibold">
            Referencia
            <input
              {...register('reference')}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            />
          </label>
          <label className="text-sm font-semibold">
            Observaciones
            <textarea
              {...register('notes')}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            />
          </label>
        </div>
        <div className="mt-7">
          <AdminFormActions
            pending={m.isPending}
            cancelTo="/inventory/movements"
            label="Registrar movimiento"
          />
        </div>
      </form>
    </>
  )
}
