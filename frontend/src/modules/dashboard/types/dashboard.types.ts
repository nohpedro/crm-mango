export type DashboardPeriod = 'day' | 'week' | 'month' | 'custom'
export type StandardDashboardPeriod = Exclude<DashboardPeriod, 'custom'>
export type DashboardStatus = 'all' | 'pending' | 'paid'

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
  status: {
    key: DashboardStatus
    label: string
  }
  sales: Record<StandardDashboardPeriod, SalesSummary>
  selected: SalesSummary
  series: DashboardSeriesItem[]
  top_products: TopProduct[]
  top_clients: TopClient[]
  definition: string
}

export interface ClientAnalyticsSummary {
  count: number
  quantity: number
  total: string
}

export interface ClientAnalyticsHistoryItem {
  id: number
  number: string
  status: Exclude<DashboardStatus, 'all'>
  created_at: string
  quotation_date: string
  products_count: number
  quantity: number
  total: string
}

export interface ClientAnalyticsData {
  generated_at: string
  client: {
    id: string
    name: string
    tax_id: string
    whatsapp: string
    department: string
    city_zone: string
    client_type: string
    price_level: { id: string; name: string; code: string }
    business_activity: string
  }
  status: DashboardStatus
  range: { start: string | null; end: string | null }
  lifetime: Record<DashboardStatus, ClientAnalyticsSummary>
  selected: ClientAnalyticsSummary
  frequency: { label: string; average_days: number | null }
  last_purchase_at: string | null
  last_activity_at: string | null
  monthly: Array<{
    month: string
    label: string
    count: number
    quantity: number
    total: string
  }>
  top_products: Array<{
    product_id: string | null
    sku: string
    name: string
    quotation_count: number
    quantity: number
    total: string
  }>
  history: {
    count: number
    page: number
    page_size: number
    total_pages: number
    results: ClientAnalyticsHistoryItem[]
  }
}

export interface ClientAnalyticsParams extends DashboardRange {
  status: DashboardStatus
  page: number
  page_size?: number
}
