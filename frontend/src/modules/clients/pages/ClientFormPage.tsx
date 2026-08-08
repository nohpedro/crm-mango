import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminFormActions } from '../../admin/components/AdminFormActions'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { usePriceLevels } from '../../catalog/hooks/useCatalogQueries'
import { clientService } from '../services/client.service'
import { clientSchema, type ClientFormValues } from '../schemas/client.schemas'
import type { ClientType } from '../types/client.types'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'

const empty: ClientFormValues = {
  name: '',
  tax_id: '',
  department: '',
  city_zone: '',
  whatsapp: '',
  client_type: '',
  price_level: '',
  business_activity: '',
  observations: '',
  is_active: true,
}

export function ClientFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/clients'
  const editing = Boolean(id)
  const user = useAuthStore((state) => state.user)
  const canAddClientType = hasPermission(user, 'clients.add_clienttype')
  const [types, setTypes] = useState<ClientType[]>([])
  const [typeModal, setTypeModal] = useState(false)
  const [newType, setNewType] = useState('')
  const [typeError, setTypeError] = useState('')
  const levels = usePriceLevels({
    search: '',
    category: '',
    sku: '',
    is_active: 'true',
    include_deleted: false,
    ordering: 'name',
    page: 1,
  })
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: empty,
  })
  useEffect(() => {
    void clientService.listTypes().then((response) => setTypes(response.results))
  }, [])
  useEffect(() => {
    if (!id) return
    void clientService
      .get(id)
      .then((client) =>
        reset({
          name: client.name,
          tax_id: client.tax_id,
          department: client.department,
          city_zone: client.city_zone,
          whatsapp: client.whatsapp,
          client_type: client.client_type,
          price_level: client.price_level.id,
          business_activity: client.business_activity,
          observations: client.observations,
          is_active: client.is_active,
        }),
      )
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo cargar el cliente.')),
      )
  }, [id, reset])
  const submit = (values: ClientFormValues) =>
    void (editing ? clientService.update(id ?? '', values) : clientService.create(values))
      .then(() => {
        toast.success(editing ? 'Cliente actualizado.' : 'Cliente creado.')
        navigate(returnTo)
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo crear el cliente.')),
      )
  const saveType = () =>
    void clientService
      .createType(newType.trim())
      .then((created) => {
        setTypes((current) => [...current, created])
        setValue('client_type', created.name, { shouldValidate: true })
        setNewType('')
        setTypeModal(false)
        setTypeError('')
      })
      .catch((error: unknown) =>
        setTypeError(getAdminErrorMessage(error, 'No se pudo crear el tipo.')),
      )
  return (
    <>
      <PageHeading
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        description="Registra la información comercial y de contacto del cliente."
      />
      <form
        noValidate
        onSubmit={handleSubmit(submit)}
        className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ['name', 'Nombre o razón social'],
              ['tax_id', 'NIT/CI'],
              ['department', 'Departamento'],
              ['city_zone', 'Ciudad/Zona'],
              ['whatsapp', 'WhatsApp'],
              ['business_activity', 'Rubro o actividad'],
            ] as const
          ).map(([field, label]) => (
            <Field key={field} label={label} error={errors[field]?.message}>
              <input
                {...register(field)}
                className={inputClass(Boolean(errors[field]))}
              />
            </Field>
          ))}
          <Field label="Tipo de cliente" error={errors.client_type?.message}>
            <div className="mt-2 flex gap-2">
              <select
                {...register('client_type')}
                className={inputClass(Boolean(errors.client_type))}
              >
                <option value="">Selecciona un tipo</option>
                {types.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
              {canAddClientType && <button
                type="button"
                title="Crear tipo de cliente"
                onClick={() => setTypeModal(true)}
                className="rounded-xl border border-brand-200 px-3 text-brand-700 hover:bg-brand-50"
              >
                <Plus className="size-4" />
              </button>}
            </div>
          </Field>
          <Field label="Nivel de precio" error={errors.price_level?.message}>
            <select
              {...register('price_level')}
              className={inputClass(Boolean(errors.price_level))}
            >
              <option value="">Selecciona un nivel</option>
              {levels.data?.results.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} ({level.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Observaciones" error={errors.observations?.message}>
            <textarea
              {...register('observations')}
              rows={4}
              className={inputClass(Boolean(errors.observations))}
            />
          </Field>
          <label className="flex items-start gap-3 pt-7 text-sm font-semibold text-slate-700">
            <input {...register('is_active')} type="checkbox" className="mt-0.5 size-4" />{' '}
            Cliente activo
          </label>
        </div>
        <div className="mt-7">
          <AdminFormActions
            pending={isSubmitting}
            cancelTo={returnTo}
            label={editing ? 'Guardar cambios' : 'Crear cliente'}
          />
        </div>
      </form>
      {typeModal && canAddClientType && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <h3 className="font-bold">Nuevo tipo de cliente</h3>
              <button
                type="button"
                onClick={() => setTypeModal(false)}
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>
            <input
              autoFocus
              value={newType}
              onChange={(event) => setNewType(event.target.value)}
              className={inputClass(Boolean(typeError))}
              placeholder="Ej. Hotel"
            />
            {typeError && <p className="mt-1 text-xs text-red-600">{typeError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTypeModal(false)}
                className="rounded-xl border px-4 py-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveType}
                disabled={!newType.trim()}
                className="rounded-xl bg-brand-600 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                Crear tipo
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-normal text-red-600">
          {error}
        </span>
      )}
    </label>
  )
}
const inputClass = (error: boolean) =>
  `mt-2 w-full rounded-xl border ${error ? 'border-red-400' : 'border-slate-300'} bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100`
