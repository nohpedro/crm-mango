import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { server } from '../../../test/server'
import { PriceLevelRulesPage } from './PriceLevelRulesPage'

const level = {
  id: 'level-1',
  name: 'Preferencial',
  code: 'PREF',
  description: '',
  is_active: true,
  tiers: [],
  created_at: '',
  updated_at: '',
}

const tiers = [
  {
    id: 'tier-1',
    price_level: 'level-1',
    price_level_detail: {
      id: 'level-1',
      name: 'Preferencial',
      code: 'PREF',
    },
    minimum_quantity: 1,
    label: 'Preferencial x1',
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'tier-3',
    price_level: 'level-1',
    price_level_detail: {
      id: 'level-1',
      name: 'Preferencial',
      code: 'PREF',
    },
    minimum_quantity: 3,
    label: 'Preferencial x3',
    is_active: true,
    created_at: '',
    updated_at: '',
  },
]

describe('PriceLevelRulesPage', () => {
  afterEach(cleanup)

  it('valida en español y permite editar una cantidad mínima', async () => {
    let patchBody: Record<string, unknown> | null = null
    server.use(
      http.get(
        'http://localhost:8000/api/v1/catalog/price-levels/level-1/',
        () => HttpResponse.json(level),
      ),
      http.get(
        'http://localhost:8000/api/v1/catalog/price-tiers/',
        () =>
          HttpResponse.json({
            count: tiers.length,
            next: null,
            previous: null,
            results: tiers,
          }),
      ),
      http.patch(
        'http://localhost:8000/api/v1/catalog/price-tiers/tier-3/',
        async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            ...tiers[1],
            minimum_quantity: 5,
            label: 'Preferencial x5',
          })
        },
      ),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/price-levels/level-1/rules']}>
          <Routes>
            <Route
              path="/price-levels/:id/rules"
              element={<PriceLevelRulesPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText('Preferencial x3')
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const input = screen.getByRole('textbox', {
      name: 'Nueva cantidad mínima',
    })
    await user.clear(input)
    await user.type(input, 'tres')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(
      screen.getByText(/usando sólo números enteros desde 2/i),
    ).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(patchBody).toEqual({ minimum_quantity: 5 }),
    )
  })
})
