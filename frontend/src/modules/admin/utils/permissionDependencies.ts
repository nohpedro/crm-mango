import type { FriendlyPermission } from './permissionCatalog'

const resourceDependencies: Record<string, string[]> = {
  'clients.clienttype': ['clients.view_client'],
  'products.category': ['products.view_product'],
  'products.pricelevel': ['products.view_product'],
  'products.pricetier': ['products.view_product'],
  'products.productprice': ['products.view_product'],
  'products.productimage': ['products.view_product'],
  'inventory.stock': ['products.view_product'],
  'inventory.stockmovement': ['inventory.view_stock'],
  'inventory.warehouse': ['inventory.view_stock'],
}

const permissionDependencies: Record<string, string[]> = {
  'quotations.add_quotation': [
    'quotations.view_quotation',
    'clients.view_client',
    'products.view_product',
  ],
  'quotations.change_quotation': [
    'quotations.view_quotation',
    'clients.view_client',
    'products.view_product',
  ],
  'quotations.change_quotation_status': ['quotations.view_quotation'],
}

export const permissionCode = (permission: FriendlyPermission) =>
  `${permission.app_label}.${permission.codename}`

export function dependenciesFor(permission: FriendlyPermission) {
  const code = permissionCode(permission)
  const resource = `${permission.app_label}.${permission.model}`
  const dependencies = [
    ...(resourceDependencies[resource] ?? []),
    ...(permissionDependencies[code] ?? []),
  ]
  if (/^(add|change|delete)_/.test(permission.codename)) {
    dependencies.push(`${permission.app_label}.view_${permission.model}`)
  }
  return [...new Set(dependencies.filter((dependency) => dependency !== code))]
}

export function includeDependencies(
  permissionIds: number[],
  permissions: FriendlyPermission[],
) {
  const byCode = new Map(permissions.map((permission) => [permissionCode(permission), permission]))
  const selected = new Set(permissionIds)
  let changed = true
  while (changed) {
    changed = false
    for (const permission of permissions) {
      if (!selected.has(permission.id)) continue
      for (const dependency of dependenciesFor(permission)) {
        const required = byCode.get(dependency)
        if (required && !selected.has(required.id)) {
          selected.add(required.id)
          changed = true
        }
      }
    }
  }
  return [...selected]
}

export function removeWithDependents(
  permissionIds: number[],
  permissionId: number,
  permissions: FriendlyPermission[],
) {
  const byId = new Map(permissions.map((permission) => [permission.id, permission]))
  const selected = new Set(permissionIds)
  const removedCodes = new Set<string>()
  const target = byId.get(permissionId)
  if (target) removedCodes.add(permissionCode(target))
  selected.delete(permissionId)

  let changed = true
  while (changed) {
    changed = false
    for (const selectedId of [...selected]) {
      const permission = byId.get(selectedId)
      if (
        permission &&
        dependenciesFor(permission).some((dependency) => removedCodes.has(dependency))
      ) {
        selected.delete(selectedId)
        removedCodes.add(permissionCode(permission))
        changed = true
      }
    }
  }
  return [...selected]
}
