import { useSearchParams } from 'react-router-dom'

import type { ProductFilters } from '../types/catalog.types'

const defaults: ProductFilters = {
  search: '',
  category: '',
  sku: '',
  is_active: '',
  include_deleted: false,
  ordering: '',
  page: 1,
}

export function useCatalogFilters() {
  const [params, setParams] = useSearchParams()
  const filters: ProductFilters = {
    search: params.get('search') ?? '',
    category: params.get('category') ?? '',
    sku: params.get('sku') ?? '',
    is_active: params.get('is_active') ?? '',
    include_deleted: params.get('include_deleted') === 'true',
    ordering: params.get('ordering') ?? '',
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
  }
  const update = (changes: Partial<ProductFilters>) => {
    const next = { ...defaults, ...filters, ...changes }
    const nextParams = new URLSearchParams()
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== 1) nextParams.set(key, String(value))
    })
    setParams(nextParams)
  }
  return { filters, update }
}
