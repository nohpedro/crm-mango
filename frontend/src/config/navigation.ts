import {
  Boxes,
  ChartNoAxesCombined,
  ContactRound,
  FileText,
  PackageSearch,
  ShieldCheck,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react'
export interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
  adminOnly?: boolean
  requiredAnyPermissions?: string[]
}
export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}
export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Inicio',
    items: [{ label: 'Panel principal', path: '/dashboard', icon: ChartNoAxesCombined }],
  },
  {
    label: 'Operación diaria',
    items: [
      {
        label: 'Clientes',
        path: '/clients',
        icon: ContactRound,
        requiredAnyPermissions: ['clients.view_client', 'clients.add_client'],
      },
      {
        label: 'Cotizaciones',
        path: '/quotations',
        icon: FileText,
        requiredAnyPermissions: ['quotations.add_quotation', 'quotations.change_quotation'],
      },
      {
        label: 'Historial de cotizaciones',
        path: '/quotations/history',
        icon: FileText,
        requiredAnyPermissions: ['quotations.view_quotation'],
      },
      {
        label: 'Productos',
        path: '/products',
        icon: PackageSearch,
        requiredAnyPermissions: ['products.view_product', 'products.add_product'],
      },
      {
        label: 'Inventario',
        path: '/inventory',
        icon: Boxes,
        requiredAnyPermissions: [
          'inventory.view_stock',
          'inventory.view_stockmovement',
          'inventory.view_warehouse',
        ],
      },
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
