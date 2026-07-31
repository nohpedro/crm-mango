export type TransferResource = 'clients' | 'products' | 'warehouses' | 'stocks'
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
}
