export type TransferResource =
  'clients' | 'products' | 'warehouses' | 'stocks' | 'quotations'
export type ImportMode = 'partial' | 'total'

export interface ImportErrorRow {
  fila: number
  columna: string
  valor: string
  motivo: string
}

export interface ImportResult {
  mode: ImportMode
  created: number
  rejected: number
  errors: ImportErrorRow[]
  created_client_types?: string[]
  created_price_levels?: string[]
  created_categories?: string[]
}

export interface ImportOptions {
  createMissingClientTypes?: boolean
  createMissingPriceLevels?: boolean
  createMissingCategories?: boolean
}
