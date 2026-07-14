export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  status: number | null
  message: string
  fieldErrors: Record<string, string[]>
  nonFieldErrors: string[]
  isNetworkError: boolean
  original: unknown
}
