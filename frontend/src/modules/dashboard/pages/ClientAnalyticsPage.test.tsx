import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'
import { server } from '../../../test/server'
import { ClientAnalyticsPage } from './ClientAnalyticsPage'

const analyticsResponse = {
  generated_at: '2026-08-01T12:00:00-04:00',
  client: {
    id: 'client-1',
    name: 'Constructora Andina',
    tax_id: '10203040',
    whatsapp: '70000000',
    department: 'La Paz',
    city_zone: 'Centro',
    client_type: 'Empresa o constructora',
    price_level: { id: 'level-1', name: 'Mayorista', code: 'MAY' },
    business_activity: 'Construcción',
  },
  status: 'all',
  range: { start: '2025-09-01', end: '2026-08-01' },
  lifetime: {
    all: { count: 5, quantity: 20, total: '5000.00' },
    paid: { count: 3, quantity: 12, total: '3200.00' },
    pending: { count: 2, quantity: 8, total: '1800.00' },
  },
  selected: { count: 5, quantity: 20, total: '5000.00' },
  frequency: { label: 'Frecuente', average_days: 20 },
  last_purchase_at: '2026-07-25T12:00:00-04:00',
  last_activity_at: '2026-07-30T12:00:00-04:00',
  monthly: [
    { month: '2026-07-01', label: '07/2026', count: 5, quantity: 20, total: '5000.00' },
  ],
  top_products: [
    {
      product_id: 'product-1',
      sku: 'CAL-10',
      name: 'Calefón 10L',
      quotation_count: 4,
      quantity: 10,
      total: '2000.00',
    },
  ],
  history: {
    count: 2,
    page: 1,
    page_size: 10,
    total_pages: 1,
    results: [
      {
        id: 1,
        number: 'COT-000001',
        status: 'paid',
        created_at: '2026-07-25T12:00:00-04:00',
        products_count: 1,
        quantity: 2,
        total: '400.00',
      },
      {
        id: 2,
        number: 'COT-000002',
        status: 'pending',
        created_at: '2026-07-30T12:00:00-04:00',
        products_count: 2,
        quantity: 3,
        total: '600.00',
      },
    ],
  },
}

function NavigationStateProbe() {
  const location = useLocation()
  return <p>{(location.state as { returnTo?: string } | null)?.returnTo}</p>
}

describe('ClientAnalyticsPage', () => {
  afterEach(cleanup)

  it('diferencia compras pagadas y cotizaciones pendientes y permite filtrarlas', async () => {
    let lastUrl = ''
    server.use(
      http.get(
        'http://localhost:8000/api/v1/clients/client-1/analytics/',
        ({ request }) => {
          lastUrl = request.url
          const status = new URL(request.url).searchParams.get('status') ?? 'all'
          return HttpResponse.json({ ...analyticsResponse, status })
        },
      ),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/dashboard/clients/client-1']}>
          <Routes>
            <Route path="/dashboard/clients/:id" element={<ClientAnalyticsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Compras pagadas')).toBeInTheDocument()
    expect(screen.getByText('Cotizaciones pendientes')).toBeInTheDocument()
    expect(screen.getByText('Calefón 10L')).toBeInTheDocument()
    expect(screen.getByText('COT-000001')).toBeInTheDocument()
    expect(screen.getByText('COT-000002')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pendientes' }))
    await waitFor(() => {
      expect(new URL(lastUrl).searchParams.get('status')).toBe('pending')
    })
  })

  it('conserva el panel de origen al abrir la edición del cliente', async () => {
    useAuthStore.setState({ status: 'authenticated', user: adminUser })
    server.use(
      http.get('http://localhost:8000/api/v1/clients/client-1/analytics/', () =>
        HttpResponse.json(analyticsResponse),
      ),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/dashboard/clients/client-1',
              state: { returnTo: '/dashboard?client_search=Andina&status=paid' },
            },
          ]}
        >
          <Routes>
            <Route path="/dashboard/clients/:id" element={<ClientAnalyticsPage />} />
            <Route path="/clients/:id/edit" element={<NavigationStateProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(await screen.findByRole('link', { name: /editar cliente/i }))
    expect(
      screen.getByText('/dashboard?client_search=Andina&status=paid'),
    ).toBeInTheDocument()
  })
})
