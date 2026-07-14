import { HttpResponse, delay, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { tokenStorage } from '../modules/auth/services/tokenStorage'
import { server } from '../test/server'
import { RequestHandler } from './RequestHandler'

describe('RequestHandler', () => {
  it('comparte una sola renovación entre solicitudes 401 simultáneas', async () => {
    let refreshCount = 0
    server.use(
      http.get('http://api.test/first', ({ request }) =>
        request.headers.get('authorization') === 'Bearer renewed-access'
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 }),
      ),
      http.get('http://api.test/second', ({ request }) =>
        request.headers.get('authorization') === 'Bearer renewed-access'
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 }),
      ),
      http.post('http://api.test/auth/refresh/', async () => {
        refreshCount += 1
        await delay(20)
        return HttpResponse.json({ access: 'renewed-access', refresh: 'rotated-refresh' })
      }),
    )
    tokenStorage.setTokens({ access: 'expired-access', refresh: 'valid-refresh' })
    const handler = new RequestHandler({ baseURL: 'http://api.test/' })

    const responses = await Promise.all([
      handler.get<{ ok: boolean }>('first'),
      handler.get<{ ok: boolean }>('second'),
    ])

    expect(responses).toEqual([{ ok: true }, { ok: true }])
    expect(refreshCount).toBe(1)
    expect(tokenStorage.getRefreshToken()).toBe('rotated-refresh')
  })

  it('conserva el estado 403 normalizado', async () => {
    server.use(
      http.get('http://api.test/admin', () =>
        HttpResponse.json(
          { detail: 'Se requiere un usuario administrador.' },
          { status: 403 },
        ),
      ),
    )
    const handler = new RequestHandler({ baseURL: 'http://api.test/' })

    await expect(handler.get('admin')).rejects.toMatchObject({
      details: { status: 403, message: 'Se requiere un usuario administrador.' },
    })
  })
})
