import {
  Boxes,
  ChartNoAxesCombined,
  Layers3,
  PackageSearch,
  ShieldCheck,
  Tags,
  UserRoundCog,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
  adminOnly?: boolean
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'General',
    items: [{ label: 'Panel principal', path: '/dashboard', icon: ChartNoAxesCombined }],
  },
  {
    label: 'Catálogo',
    items: [
      { label: 'Productos', path: '/products', icon: PackageSearch },
      { label: 'Categorías', path: '/categories', icon: Tags },
      { label: 'Niveles de precio', path: '/price-levels', icon: Layers3 },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { label: 'Existencias', path: '/inventory', icon: Boxes },
      { label: 'Almacenes', path: '/inventory/warehouses', icon: Warehouse },
      { label: 'Movimientos', path: '/inventory/movements', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Usuarios', path: '/users', icon: UserRoundCog, adminOnly: true },
      { label: 'Roles y permisos', path: '/roles', icon: ShieldCheck, adminOnly: true },
    ],
  },
]
