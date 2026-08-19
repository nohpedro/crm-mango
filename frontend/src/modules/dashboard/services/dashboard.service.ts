import { requestHandler } from '../../auth/services/auth.service'
import type {
  DashboardData,
  DashboardDayData,
  ClientAnalyticsData,
  ClientAnalyticsParams,
  DashboardPeriod,
  DashboardRange,
  DashboardStatus,
} from '../types/dashboard.types'

const params = (
  period: DashboardPeriod,
  range: DashboardRange = {},
  status: DashboardStatus = 'all',
) => ({
  period,
  status,
  ...(period === 'custom' ? range : {}),
})

export const dashboardService = {
  get: (
    period: DashboardPeriod,
    range: DashboardRange = {},
    status: DashboardStatus = 'all',
  ) =>
    requestHandler.get<DashboardData>('quotations/dashboard/', {
      params: params(period, range, status),
    }),
  getDay: (date: string, status: DashboardStatus = 'all') =>
    requestHandler.get<DashboardDayData>('quotations/dashboard-day/', {
      params: { date, status },
    }),
  downloadPdf: (
    period: DashboardPeriod,
    range: DashboardRange = {},
    status: DashboardStatus = 'all',
  ) =>
    requestHandler.download('quotations/report-pdf/', {
      params: params(period, range, status),
    }),
  downloadCsv: (
    period: DashboardPeriod,
    range: DashboardRange = {},
    status: DashboardStatus = 'all',
  ) =>
    requestHandler.download('quotations/report-csv/', {
      params: params(period, range, status),
    }),
  getClientAnalytics: (id: string, analyticsParams: ClientAnalyticsParams) =>
    requestHandler.get<ClientAnalyticsData>(`clients/${id}/analytics/`, {
      params: { ...analyticsParams },
    }),
  downloadClientPdf: (
    id: string,
    analyticsParams: Pick<ClientAnalyticsParams, 'status' | 'start_date' | 'end_date'>,
  ) =>
    requestHandler.download(`clients/${id}/analytics-report-pdf/`, {
      params: { ...analyticsParams },
    }),
  downloadClientCsv: (
    id: string,
    analyticsParams: Pick<ClientAnalyticsParams, 'status' | 'start_date' | 'end_date'>,
  ) =>
    requestHandler.download(`clients/${id}/analytics-report-csv/`, {
      params: { ...analyticsParams },
    }),
}
