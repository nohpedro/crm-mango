import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../../admin/components/AdminFormActions'
import { getAdminErrorMessage, getFieldErrors } from '../../admin/components/AdminError'
import { useWarehouse, useWarehouseMutations } from '../hooks/useInventory'
const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(150),
  code: z.string().trim().min(1, 'El código es obligatorio.').max(40),
  description: z.string().max(2000),
  address: z.string().max(250),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>
const empty: Values = {
  name: '',
  code: '',
  description: '',
  address: '',
  is_active: true,
}
export function WarehouseFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const nav = useNavigate()
  const q = useWarehouse(id)
  const m = useWarehouseMutations()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })
  useEffect(() => {
    if (q.data) reset(q.data)
  }, [q.data, reset])
  const submit = (v: Values) =>
    void (
      editing ? m.update.mutateAsync({ id: id!, payload: v }) : m.create.mutateAsync(v)
    )
      .then(() => {
        toast.success('Almacén guardado.')
        nav('/inventory/warehouses')
      })
      .catch((e: unknown) => {
        const f = getFieldErrors(e)
        Object.entries(f).forEach(([k, msg]) =>
          setError(k as keyof Values, { message: msg[0] }),
        )
        if (!Object.keys(f).length)
          toast.error(getAdminErrorMessage(e, 'No se pudo guardar el almacén.'))
      })
  return (
    <>
      <PageHeading
        title={`${editing ? 'Editar' : 'Nuevo'} almacén`}
        description="Define una ubicación física para tus existencias."
      />
      <form
        onSubmit={handleSubmit(submit)}
        className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            ['name', 'Nombre'],
            ['code', 'Código'],
            ['address', 'Dirección'],
          ].map(([f, l]) => (
            <label key={f} className="text-sm font-semibold">
              {l}
              <input
                {...register(f as keyof Values)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
              />
              {errors[f as keyof Values] && (
                <span className="text-xs text-red-600">
                  {errors[f as keyof Values]?.message}
                </span>
              )}
            </label>
          ))}
          <label className="text-sm font-semibold">
            Descripción
            <textarea
              {...register('description')}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
            />
          </label>
          <label className="pt-7 text-sm font-semibold">
            <input type="checkbox" {...register('is_active')} className="mr-2" /> Activo
          </label>
        </div>
        <div className="mt-7">
          <AdminFormActions
            pending={m.create.isPending || m.update.isPending}
            cancelTo="/inventory/warehouses"
            label={editing ? 'Guardar cambios' : 'Crear almacén'}
          />
        </div>
      </form>
    </>
  )
}
