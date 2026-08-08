import type { PaginatedResponse } from '../../../types/api'

export type QuotationStatus = 'pending' | 'paid'
export type PaperFormat = 'standard' | 'roll'

export type QuotationSectionKey = string

export interface QuotationTemplateLayout {
  page_width_mm: number
  page_height_mm: number
  roll_width_mm: number
  roll_height_mm: number
  box_padding_mm: number
  header_image_id: number | null
  header_height_mm: number
  header_image_width_mm: number
  header_image_height_mm: number
  header_company_font_size: number
  header_subtitle_font_size: number
  header_document_title: string
  header_document_title_font_size: number
  columns: number
  column_gap_mm: number
  row_gap_mm: number
  column_widths: number[]
}

export interface QuotationTemplateImage {
  id: number
  template: number
  image: string
  alt_text: string
  created_at: string
}

export interface QuotationTemplateSection {
  key: QuotationSectionKey
  title: string
  visible: boolean
  order: number
  content: string
  show_savings?: boolean
  type?: 'system' | 'text' | 'image'
  image_id?: number | null
  width_percent?: number
  min_height_mm?: number
  grid_row?: number
  grid_column?: number
  column_span?: number
  row_span?: number
  horizontal_align?: 'left' | 'center' | 'right'
  vertical_align?: 'top' | 'middle' | 'bottom'
  padding_mm?: number
  margin_mm?: number
  font_size?: number
  background_color?: string
  text_color?: string
  border_color?: string
  border_width?: number
  border_radius?: number
}

export interface QuotationTemplate {
  id: number
  name: string
  description: string
  sections: QuotationTemplateSection[]
  layout: QuotationTemplateLayout
  images: QuotationTemplateImage[]
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface QuotationTemplateWriteRequest {
  name: string
  description: string
  sections: QuotationTemplateSection[]
  layout: QuotationTemplateLayout
  is_active: boolean
  is_default: boolean
}

export interface QuotationItem {
  id: number
  product: string | null
  sku: string
  name: string
  quantity: number
  normal_unit_price: string
  special_unit_price: string | null
  applied_price_level: string
  additional_discount_percent: string
  unit_price: string
  savings: string
  total: string
}

export interface Quotation {
  id: number
  number: string
  client: string | null
  client_name: string
  client_tax_id: string
  client_phone: string
  client_address: string
  template: number | null
  template_name: string
  valid_days: number
  notes: string
  status: QuotationStatus
  quotation_date: string
  items: QuotationItem[]
  total: string
  created_by: string | null
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface QuotationWriteRequest {
  client: string | null
  client_name: string
  client_tax_id: string
  client_phone: string
  client_address: string
  template?: number | null
  valid_days?: number
  notes: string
  status: QuotationStatus
  quotation_date: string
  items: Array<{ product: string; quantity: number }>
}

export type PaginatedQuotations = PaginatedResponse<Quotation>
