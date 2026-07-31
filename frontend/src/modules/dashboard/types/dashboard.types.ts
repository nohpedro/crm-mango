export type DashboardPeriod = 'day' | 'week' | 'month' | 'custom'
export type StandardDashboardPeriod = Exclude<DashboardPeriod, 'custom'>

export interface DashboardRange {
  start_date?: string
  end_date?: string
}

export interface SalesSummary {
  count: number
  total: string
  average: string
}

export interface DashboardSeriesItem {
  date: string
  label: string
  count: number
  total: string
}

export interface TopProduct {
  product_id: string | null
  sku: string
  name: string
  quotation_count: number
  quantity: number
  total: string
}

export interface TopClient {
  client_id: number | null
  client_name: string
  client_tax_id: string
  quotation_count: number
  total: string
}

export interface DashboardData {
  generated_at: string
  period: {
    key: DashboardPeriod
    label: string
    start: string
    end: string
  }
  sales: Record<StandardDashboardPeriod, SalesSummary>
  selected: SalesSummary
  series: DashboardSeriesItem[]
  top_products: TopProduct[]
  top_clients: TopClient[]
  definition: string
}
