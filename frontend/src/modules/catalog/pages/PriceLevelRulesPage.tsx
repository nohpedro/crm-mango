import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { usePriceLevel } from '../hooks/useCatalogQueries'
import { catalogService } from '../services/catalog.service'
import type { PriceTier } from '../types/catalog.types'

type EditingTier = {
  id: string
  value: string
}

export function PriceLevelRulesPage() {
  const { id } = useParams()
  const level = usePriceLevel(id)
  const cache = useQueryClient()
  const tiers = useQuery({
    queryKey: ['price-tiers', id],
    queryFn: () =>
      catalogService.listPriceTiers({
        price_level: id,
        ordering: 'minimum_quantity',
      }),
    enabled: Boolean(id),
  })
  const [quantity, setQuantity] = useState('2')
  const [createError, setCreateError] = useState('')
  const [editError, setEditError] = useState('')
  const [editing, setEditing] = useState<EditingTier | null>(null)
  const [tierToDelete, setTierToDelete] = useState<PriceTier | null>(null)
  const [pending, setPending] = useState<'create' | string | null>(null)

  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ['price-tiers', id] })
    void level.refetch()
  }

  const validateQuantity = (
    value: string,
    excludedTierId?: string,
  ): number | null => {
    const normalized = value.trim()
    if (!/^\d+$/.test(normalized)) {
      return null
    }
    const parsed = Number(normalized)
    if (!Number.isSafeInteger(parsed) || parsed < 2) {
      return null
    }
    const duplicated = tiers.data?.results.some(
      (tier) =>
        tier.id !== excludedTierId && tier.minimum_quantity === parsed,
    )
    return duplicated ? -1 : parsed
  }

  const create = () => {
    if (!id) return
    const parsed = validateQuantity(quantity)
    if (parsed === null) {
      setCreateError(
        'Ingresa una cantidad mínima válida, usando sólo números enteros desde 2.',
      )
      return
    }
    if (parsed === -1) {
      setCreateError('Ya existe un nivel con esa cantidad mínima.')
      return
    }
    setCreateError('')
    setPending('create')
    void catalogService
      .createPriceTier({
        price_level: id,
        minimum_quantity: parsed,
        is_active: true,
      })
      .then(() => {
        toast.success(`Nivel x${parsed} creado.`)
        refresh()
        setQuantity(String(parsed + 1))
      })
      .catch((error: unknown) =>
        setCreateError(
          getAdminErrorMessage(error, 'No se pudo crear el nivel.'),
        ),
      )
      .finally(() => setPending(null))
  }

  const startEditing = (tier: PriceTier) => {
    setEditing({ id: tier.id, value: String(tier.minimum_quantity) })
    setEditError('')
  }

  const saveEditing = () => {
    if (!editing) return
    const parsed = validateQuantity(editing.value, editing.id)
    if (parsed === null) {
      setEditError(
        'Ingresa una cantidad mínima válida, usando sólo números enteros desde 2.',
      )
      return
    }
    if (parsed === -1) {
      setEditError('Ya existe un nivel con esa cantidad mínima.')
      return
    }
    setEditError('')
    setPending(editing.id)
    void catalogService
      .updatePriceTier(editing.id, { minimum_quantity: parsed })
      .then(() => {
        toast.success(`Cantidad mínima actualizada a ${parsed}.`)
        setEditing(null)
        refresh()
      })
      .catch((error: unknown) =>
        setEditError(
          getAdminErrorMessage(error, 'No se pudo actualizar la cantidad.'),
        ),
      )
      .finally(() => setPending(null))
  }

  const deleteTier = () => {
    if (!tierToDelete) return
    setPending(tierToDelete.id)
    void catalogService
      .deletePriceTier(tierToDelete.id)
      .then(() => {
        toast.success(`${tierToDelete.label} fue eliminado.`)
        setTierToDelete(null)
        refresh()
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo eliminar el nivel.')),
      )
      .finally(() => setPending(null))
  }

  return (
    <>
      <PageHeading
        title={`Niveles · ${level.data?.name ?? ''}`}
        description="x1 corresponde al precio normal y siempre existe. Agrega o modifica las cantidades desde las que se aplicará cada precio especial."
        action={
          <Link
            to="/price-levels"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
          >
            <ArrowLeft className="size-4" /> Tipos de precio
          </Link>
        }
      />

      <section className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <h3 className="font-bold text-brand-900">
          Agregar nivel por cantidad
        </h3>
        <p className="mt-1 text-sm text-brand-900/75">
          Ejemplo: al agregar x3, cada producto podrá definir un precio especial
          para compras desde 3 unidades.
        </p>
        <div className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold text-slate-800">
            Cantidad mínima
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={quantity}
              aria-invalid={Boolean(createError)}
              onChange={(event) => {
                setQuantity(event.target.value)
                setCreateError('')
              }}
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2.5 outline-none focus:ring-4 ${
                createError
                  ? 'border-red-400 focus:ring-red-100'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
              }`}
            />
          </label>
          <button
            type="button"
            disabled={pending !== null}
            onClick={create}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus className="size-4" /> Agregar
          </button>
        </div>
        {createError && (
          <p className="mt-2 text-sm font-semibold text-red-700">
            {createError}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-bold text-slate-900">Cantidades configuradas</h3>
          <p className="mt-1 text-sm text-slate-500">
            Usa Editar para cambiar desde cuántas unidades se aplica un nivel.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Nivel</th>
                <th className="px-5 py-4">Aplicable desde</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tiers.data?.results.map((tier) => {
                const isEditing = editing?.id === tier.id
                return (
                  <tr key={tier.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-bold">
                      {isEditing
                        ? `${tier.price_level_detail.name} x${editing.value || '…'}`
                        : tier.label}
                    </td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div>
                          <label className="sr-only" htmlFor={`tier-${tier.id}`}>
                            Nueva cantidad mínima
                          </label>
                          <input
                            id={`tier-${tier.id}`}
                            type="text"
                            inputMode="numeric"
                            autoFocus
                            value={editing.value}
                            aria-invalid={Boolean(editError)}
                            onChange={(event) => {
                              setEditing({
                                ...editing,
                                value: event.target.value,
                              })
                              setEditError('')
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') saveEditing()
                              if (event.key === 'Escape') setEditing(null)
                            }}
                            className={`w-32 rounded-lg border px-3 py-2 outline-none ${
                              editError
                                ? 'border-red-400'
                                : 'border-slate-300 focus:border-brand-500'
                            }`}
                          />
                          {editError && (
                            <p className="mt-1 max-w-xs text-xs font-semibold text-red-700">
                              {editError}
                            </p>
                          )}
                        </div>
                      ) : (
                        `${tier.minimum_quantity} ${
                          tier.minimum_quantity === 1 ? 'unidad' : 'unidades'
                        }`
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {tier.minimum_quantity === 1 ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          Precio normal
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {tier.minimum_quantity === 1 ? (
                        <span className="text-xs text-slate-400">
                          No editable
                        </span>
                      ) : isEditing ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={saveEditing}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            <Check className="size-3.5" /> Guardar
                          </button>
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => {
                              setEditing(null)
                              setEditError('')
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                          >
                            <X className="size-3.5" /> Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => startEditing(tier)}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                          >
                            <Pencil className="size-3.5" /> Editar
                          </button>
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => setTierToDelete(tier)}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" /> Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(tierToDelete)}
        title="¿Eliminar nivel por cantidad?"
        description={`Se eliminará ${tierToDelete?.label ?? 'este nivel'}. Los precios especiales asociados dejarán de aplicarse para esa cantidad.`}
        confirmLabel="Eliminar nivel"
        pending={pending === tierToDelete?.id}
        danger
        onClose={() => {
          if (pending === null) setTierToDelete(null)
        }}
        onConfirm={deleteTier}
      />
    </>
  )
}
