import { useQuery } from '@tanstack/react-query'

import { dashboardService } from '../services/dashboard.service'
import type {
  ClientAnalyticsParams,
  DashboardPeriod,
  DashboardRange,
  DashboardStatus,
} from '../types/dashboard.types'

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

export function useClientAnalytics(
  id: string | undefined,
  params: ClientAnalyticsParams,
) {
  return useQuery({
    queryKey: [
      'client-analytics',
      id,
      params.status,
      params.start_date,
      params.end_date,
      params.page,
    ],
    queryFn: () => dashboardService.getClientAnalytics(id ?? '', params),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}
