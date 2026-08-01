import { requestHandler } from '../../auth/services/auth.service'
import type {
  DashboardData,
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
  get: (period: DashboardPeriod, range: DashboardRange = {}, status: DashboardStatus = 'all') =>
    requestHandler.get<DashboardData>('quotations/dashboard/', {
      params: params(period, range, status),
    }),
  downloadPdf: (period: DashboardPeriod, range: DashboardRange = {}, status: DashboardStatus = 'all') =>
    requestHandler.download('quotations/report-pdf/', {
      params: params(period, range, status),
    }),
  downloadCsv: (period: DashboardPeriod, range: DashboardRange = {}, status: DashboardStatus = 'all') =>
    requestHandler.download('quotations/report-csv/', {
      params: params(period, range, status),
    }),
}
