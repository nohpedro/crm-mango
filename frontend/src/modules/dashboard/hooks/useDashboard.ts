import { useQuery } from '@tanstack/react-query'

import { dashboardService } from '../services/dashboard.service'
import type { DashboardPeriod, DashboardRange } from '../types/dashboard.types'

export function useDashboard(
  period: DashboardPeriod,
  range: DashboardRange = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['dashboard', period, range.start_date, range.end_date],
    queryFn: () => dashboardService.get(period, range),
    enabled,
    staleTime: 60_000,
  })
}
