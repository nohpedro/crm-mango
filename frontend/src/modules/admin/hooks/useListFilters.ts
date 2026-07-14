import { useSearchParams } from 'react-router-dom'

import type { ListFilters } from '../types/admin.types'

export function useListFilters() {
  const [params, setParams] = useSearchParams()
  const filters: ListFilters = {
    search: params.get('search') ?? '',
    ordering: params.get('ordering') ?? '',
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
  }

  const update = (changes: Partial<ListFilters>) => {
    const next = { ...filters, ...changes }
    const nextParams = new URLSearchParams()
    if (next.search) nextParams.set('search', next.search)
    if (next.ordering) nextParams.set('ordering', next.ordering)
    if (next.page > 1) nextParams.set('page', String(next.page))
    setParams(nextParams)
  }

  return { filters, update }
}
