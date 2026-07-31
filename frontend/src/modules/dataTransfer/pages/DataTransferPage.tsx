import { Link, useLocation } from 'react-router-dom'

import { PageHeading } from '../../../components/common/PageHeading'
import { DataTransferPanel } from '../components/DataTransferPanel'
import type { TransferResource } from '../types/transfer.types'

export function DataTransferPage({ resource }: { resource: TransferResource }) {
  const location = useLocation()
  const label =
    resource === 'clients'
      ? 'clientes'
      : resource === 'products'
        ? 'productos'
        : resource === 'warehouses'
          ? 'almacenes'
          : 'vinculaciones de inventario'
  const filters = Object.fromEntries(new URLSearchParams(location.search).entries())
  return (
    <>
      <PageHeading
        title={`Importar y exportar ${label}`}
        description="Descarga una plantilla, carga tus datos y revisa cada observación antes de corregir o repetir el proceso."
        action={
          <Link
            to={
              resource === 'clients'
                ? '/clients'
                : resource === 'products'
                  ? '/products'
                  : '/inventory'
            }
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Volver
          </Link>
        }
      />
      <DataTransferPanel resource={resource} filters={filters} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
        <h3 className="font-bold text-slate-900">Antes de cargar</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Usa exactamente los encabezados de la plantilla y no cambies su orden.</li>
          <li>
            Los registros repetidos dentro del archivo o ya existentes se rechazan para
            proteger la información actual.
          </li>
          <li>
            El modo parcial es recomendado para corregir solo las filas observadas; el
            modo total sirve para cargas controladas.
          </li>
        </ul>
      </section>
    </>
  )
}
