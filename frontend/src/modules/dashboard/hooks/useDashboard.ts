import { useQuery } from '@tanstack/react-query'

import { dashboardService } from '../services/dashboard.service'
import type { DashboardPeriod, DashboardRange, DashboardStatus } from '../types/dashboard.types'

export function useDashboard(
  period: DashboardPeriod,
  range: DashboardRange = {},
  status: DashboardStatus = 'all',
  enabled = true,
) {
  return useQuery({
    queryKey: ['dashboard', period, range.start_date, range.end_date, status],
    queryFn: () => dashboardService.get(period, range, status),
    enabled,
    staleTime: 60_000,
  })
}
