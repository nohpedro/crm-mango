const REFRESH_TOKEN_KEY = 'crm_idesem_refresh_token'

let accessToken: string | null = null

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  return window.sessionStorage
}

export const tokenStorage = {
  getAccessToken: () => accessToken,

  setAccessToken: (token: string) => {
    accessToken = token
  },

  getRefreshToken: () => getSessionStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null,

  setRefreshToken: (token: string) => {
    getSessionStorage()?.setItem(REFRESH_TOKEN_KEY, token)
  },

  setTokens: (tokens: { access: string; refresh: string }) => {
    accessToken = tokens.access
    getSessionStorage()?.setItem(REFRESH_TOKEN_KEY, tokens.refresh)
  },

  clear: () => {
    accessToken = null
    getSessionStorage()?.removeItem(REFRESH_TOKEN_KEY)
  },
}
