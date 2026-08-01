import type { Permission } from '../types/admin.types'

type ResourceDefinition = {
  area: string
  label: string
  description: string
  order: number
}

const resources: Record<string, ResourceDefinition> = {
  'clients.client': {
    area: 'Comercial',
    label: 'Clientes',
    description: 'Consulta y administra la información de clientes.',
    order: 10,
  },
  'clients.clienttype': {
    area: 'Comercial',
    label: 'Tipos de cliente',
    description: 'Crea y administra las clasificaciones de clientes.',
    order: 20,
  },
  'products.product': {
    area: 'Catálogo',
    label: 'Productos',
    description: 'Consulta y administra el catálogo de productos.',
    order: 30,
  },
  'products.category': {
    area: 'Catálogo',
    label: 'Categorías',
    description: 'Organiza los productos por categoría.',
    order: 40,
  },
  'products.pricelevel': {
    area: 'Catálogo',
    label: 'Tipos de precio',
    description: 'Configura los tipos de precio asignables a clientes.',
    order: 50,
  },
  'products.pricetier': {
    area: 'Catálogo',
    label: 'Niveles por cantidad',
    description: 'Configura desde qué cantidad se aplica cada precio especial.',
    order: 60,
  },
  'products.productprice': {
    area: 'Catálogo',
    label: 'Precios de productos',
    description: 'Configura los precios especiales por cantidad.',
    order: 70,
  },
  'products.productimage': {
    area: 'Catálogo',
    label: 'Imágenes de productos',
    description: 'Administra las imágenes del catálogo.',
    order: 80,
  },
  'inventory.stock': {
    area: 'Inventario',
    label: 'Existencias',
    description: 'Consulta y ajusta el stock por producto y almacén.',
    order: 90,
  },
  'inventory.stockmovement': {
    area: 'Inventario',
    label: 'Movimientos de inventario',
    description: 'Registra entradas, salidas y ajustes de stock.',
    order: 100,
  },
  'inventory.warehouse': {
    area: 'Inventario',
    label: 'Almacenes',
    description: 'Administra los almacenes disponibles.',
    order: 110,
  },
  'quotations.quotation': {
    area: 'Comercial',
    label: 'Cotizaciones',
    description: 'Crea, consulta y administra cotizaciones.',
    order: 120,
  },
  'users.user': {
    area: 'Administración',
    label: 'Usuarios',
    description: 'Administra las cuentas de acceso.',
    order: 130,
  },
  'users.role': {
    area: 'Administración',
    label: 'Roles y permisos',
    description: 'Crea roles y configura sus accesos.',
    order: 140,
  },
}

const actionLabels: Record<string, string> = {
  add: 'Crear',
  change: 'Editar',
  delete: 'Eliminar',
  view: 'Ver',
}

const customPermissionLabels: Record<string, string> = {
  configure_quotation_document: 'Configurar documento',
  manage_quotation_templates: 'Administrar plantillas',
}

export type FriendlyPermission = Permission & {
  area: string
  resourceLabel: string
  resourceDescription: string
  actionLabel: string
  order: number
}

export function getFriendlyPermission(permission: Permission): FriendlyPermission | null {
  const resource = resources[`${permission.app_label}.${permission.model}`]
  const action = permission.codename.split('_')[0]
  const actionLabel = customPermissionLabels[permission.codename] ?? actionLabels[action]
  if (!resource || !actionLabel) return null

  return {
    ...permission,
    area: resource.area,
    resourceLabel: resource.label,
    resourceDescription: resource.description,
    actionLabel,
    order: resource.order,
  }
}
