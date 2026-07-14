const removeTrailingSlash = (value: string) => value.replace(/\/$/, '')

export function getApiUrl(): string {
  const value = import.meta.env.VITE_API_URL?.trim()
  if (!value) throw new Error('La variable VITE_API_URL no está configurada.')
  return removeTrailingSlash(value)
}
