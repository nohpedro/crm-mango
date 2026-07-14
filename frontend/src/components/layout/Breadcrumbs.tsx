import { ChevronRight, House } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const segmentLabels: Record<string, string> = {
  dashboard: 'Panel principal',
  products: 'Productos',
  categories: 'Categorías',
  'price-levels': 'Niveles de precio',
  inventory: 'Inventario',
  warehouses: 'Almacenes',
  movements: 'Movimientos',
  users: 'Usuarios',
  roles: 'Roles',
  new: 'Nuevo',
  edit: 'Editar',
  prices: 'Precios',
  images: 'Imágenes',
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav
      aria-label="Migas de pan"
      className="flex items-center gap-1.5 text-xs text-slate-500"
    >
      <Link
        to="/dashboard"
        aria-label="Panel principal"
        className="rounded p-1 hover:text-brand-600"
      >
        <House className="size-3.5" />
      </Link>
      {segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join('/')}`
        const label =
          segmentLabels[segment] ?? (index === segments.length - 1 ? 'Detalle' : segment)
        const isLast = index === segments.length - 1
        return (
          <span key={path} className="flex items-center gap-1.5">
            <ChevronRight className="size-3" aria-hidden="true" />
            {isLast ? (
              <span className="font-medium text-slate-700">{label}</span>
            ) : (
              <Link to={path} className="hover:text-brand-600">
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
