import {
  Boxes,
  Settings,
  ChartNoAxesCombined,
  ContactRound,
  FileText,
  PackageSearch,
  PanelsTopLeft,
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
    items: [
      {
        label: 'Panel principal',
        path: '/dashboard',
        icon: ChartNoAxesCombined,
        requiredAnyPermissions: ['quotations.view_dashboard'],
      },
    ],
  },
  {
    label: 'Operación diaria',
    items: [
      {
        label: 'Clientes',
        path: '/clients',
        icon: ContactRound,
        requiredAnyPermissions: ['clients.view_client'],
      },
      {
        label: 'Cotizaciones',
        path: '/quotations',
        icon: FileText,
        requiredAnyPermissions: ['quotations.add_quotation'],
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
        requiredAnyPermissions: ['products.view_product'],
      },
      {
        label: 'Inventario',
        path: '/inventory',
        icon: Boxes,
        requiredAnyPermissions: ['inventory.view_stock'],
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Configuración', path: '/settings', icon: Settings, adminOnly: true },
      {
        label: 'Plantillas de cotización',
        path: '/quotations/templates',
        icon: PanelsTopLeft,
        requiredAnyPermissions: ['quotations.manage_quotation_templates'],
      },
      {
        label: 'Usuarios',
        path: '/users',
        icon: UserRoundCog,
        requiredAnyPermissions: ['users.view_user'],
      },
      {
        label: 'Roles y permisos',
        path: '/roles',
        icon: ShieldCheck,
        requiredAnyPermissions: ['users.view_role'],
      },
    ],
  },
]
