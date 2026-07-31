import { requestHandler } from '../../auth/services/auth.service'
import type {
  DashboardData,
  DashboardPeriod,
  DashboardRange,
} from '../types/dashboard.types'

const params = (period: DashboardPeriod, range: DashboardRange = {}) => ({
  period,
  ...(period === 'custom' ? range : {}),
})

export const dashboardService = {
  get: (period: DashboardPeriod, range: DashboardRange = {}) =>
    requestHandler.get<DashboardData>('quotations/dashboard/', {
      params: params(period, range),
    }),
  downloadPdf: (period: DashboardPeriod, range: DashboardRange = {}) =>
    requestHandler.download('quotations/report-pdf/', {
      params: params(period, range),
    }),
  downloadCsv: (period: DashboardPeriod, range: DashboardRange = {}) =>
    requestHandler.download('quotations/report-csv/', {
      params: params(period, range),
    }),
}
