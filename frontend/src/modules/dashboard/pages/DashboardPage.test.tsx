import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'
import { server } from '../../../test/server'
import { DashboardPage } from './DashboardPage'

const dashboardResponse = {
  generated_at: '2026-07-26T10:00:00-04:00',
  period: {
    key: 'month',
    label: 'Este mes',
    start: '2026-07-01',
    end: '2026-07-26',
  },
  status: { key: 'all', label: 'Todos los estados' },
  sales: {
    day: { count: 3, total: '1200.00', average: '400.00' },
    week: { count: 8, total: '3500.00', average: '437.50' },
    month: { count: 15, total: '8000.00', average: '533.33' },
  },
  selected: { count: 15, total: '8000.00', average: '533.33' },
  series: [
    { date: '2026-07-25', label: '25/07', count: 5, total: '2400.00' },
    { date: '2026-07-26', label: '26/07', count: 3, total: '1200.00' },
  ],
  top_products: [
    {
      product_id: 'product-1',
      sku: 'CAL-10',
      name: 'Calefón 10L',
      quotation_count: 6,
      quantity: 14,
      total: '2800.00',
    },
  ],
  top_clients: [
    {
      client_id: 1,
      client_name: 'Constructora Andina',
      client_tax_id: '10203040',
      quotation_count: 5,
      total: '3600.00',
    },
  ],
  definition: 'Se muestran cotizaciones pendientes y pagadas.',
}

describe('DashboardPage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', user: adminUser })
  })

  it('muestra ventas, productos y clientes con datos de la API', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/quotations/dashboard/', () =>
        HttpResponse.json(dashboardResponse),
      ),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Calefón 10L')).toBeInTheDocument()
    expect(screen.getByText('Constructora Andina')).toBeInTheDocument()
    expect(screen.getByText('Ventas de hoy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generar reporte pdf/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /descargar datos csv/i })).toBeEnabled()
  })

  it('desglosa las cotizaciones al seleccionar una barra del gráfico', async () => {
    const user = userEvent.setup()
    let requestedStatus = ''
    server.use(
      http.get('http://localhost:8000/api/v1/quotations/dashboard/', () =>
        HttpResponse.json(dashboardResponse),
      ),
      http.get(
        'http://localhost:8000/api/v1/quotations/dashboard-day/',
        ({ request }) => {
          requestedStatus = new URL(request.url).searchParams.get('status') ?? ''
          return HttpResponse.json({
            date: '2026-07-25',
            label: '25/07/2026',
            status: 'all',
            count: 2,
            total: '2400.00',
            results: [
              {
                id: 60,
                number: 'COT-000060',
                client_name: 'Constructora Andina',
                client_tax_id: '10203040',
                status: 'paid',
                products_count: 3,
                units: 5,
                total: '1400.00',
              },
              {
                id: 61,
                number: 'COT-000061',
                client_name: 'Comercial Norte',
                client_tax_id: '554433',
                status: 'pending',
                products_count: 2,
                units: 4,
                total: '1000.00',
              },
            ],
          })
        },
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Ver cotizaciones del 25/07' }),
    )

    expect(await screen.findByText('Cotizaciones del 25/07/2026')).toBeInTheDocument()
    expect(screen.getByText('COT-000060')).toBeInTheDocument()
    expect(screen.getByText('Comercial Norte')).toBeInTheDocument()
    expect(requestedStatus).toBe('all')
  })

  it('explica el permiso requerido cuando el rol no puede ver cotizaciones', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        ...adminUser,
        is_admin: false,
        permissions: [],
        role: { ...adminUser.role!, code: 'WAREHOUSE', name: 'Almacén' },
      },
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Reportes comerciales no disponibles')).toBeInTheDocument()
  })

  it('aplica el rango personalizado a la consulta del panel', async () => {
    let lastUrl = ''
    server.use(
      http.get('http://localhost:8000/api/v1/quotations/dashboard/', ({ request }) => {
        lastUrl = request.url
        return HttpResponse.json({
          ...dashboardResponse,
          period: {
            key: 'custom',
            label: 'Rango personalizado',
            start: '2026-07-01',
            end: '2026-07-26',
          },
        })
      }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText('Constructora Andina')
    await user.click(screen.getByRole('button', { name: /elegir fechas/i }))
    await user.click(screen.getByRole('button', { name: /mostrar este rango/i }))

    await waitFor(() => {
      const url = new URL(lastUrl)
      expect(url.searchParams.get('period')).toBe('custom')
      expect(url.searchParams.get('start_date')).toBeTruthy()
      expect(url.searchParams.get('end_date')).toBeTruthy()
    })
  })

  it('filtra el panel y los reportes por estado de cotizaciÃ³n', async () => {
    const requestedStatuses: string[] = []
    server.use(
      http.get('http://localhost:8000/api/v1/quotations/dashboard/', ({ request }) => {
        const selectedStatus = new URL(request.url).searchParams.get('status') ?? 'all'
        requestedStatuses.push(selectedStatus)
        return HttpResponse.json({
          ...dashboardResponse,
          status: { key: selectedStatus, label: selectedStatus },
        })
      }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText('Constructora Andina')
    await user.click(screen.getByRole('button', { name: 'Pagadas' }))

    await waitFor(() => {
      expect(requestedStatuses.at(-1)).toBe('paid')
    })
    await user.click(screen.getByRole('button', { name: 'Todas' }))
    await waitFor(() => expect(requestedStatuses.at(-1)).toBe('all'))
    await user.click(screen.getByRole('button', { name: 'Pendientes' }))
    await waitFor(() => expect(requestedStatuses.at(-1)).toBe('pending'))
  })

  it('busca clientes desde el panel sin cargar la lista antes de escribir', async () => {
    let clientRequests = 0
    server.use(
      http.get('http://localhost:8000/api/v1/quotations/dashboard/', () =>
        HttpResponse.json(dashboardResponse),
      ),
      http.get('http://localhost:8000/api/v1/clients/', () => {
        clientRequests += 1
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 'client-1',
              name: 'Constructora Andina',
              tax_id: '10203040',
              department: 'La Paz',
              city_zone: 'Centro',
              whatsapp: '70000000',
              client_type: 'Empresa o constructora',
              price_level: { id: 'level-1', name: 'Mayorista', code: 'MAY' },
              business_activity: 'Construcción',
              observations: '',
              is_active: true,
              created_at: '2026-08-01T12:00:00Z',
              updated_at: '2026-08-01T12:00:00Z',
            },
          ],
        })
      }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText('Productos más cotizados')
    expect(clientRequests).toBe(0)
    await user.type(
      screen.getByRole('textbox', { name: 'Buscar cliente para analizar' }),
      'Andina',
    )

    const link = await screen.findByRole('link', { name: /Ver ficha/i })
    expect(link).toHaveAttribute('href', '/dashboard/clients/client-1')
    expect(clientRequests).toBeGreaterThan(0)
  })

  it('restaura la búsqueda y los filtros del panel desde la URL', async () => {
    let dashboardUrl = ''
    server.use(
      http.get('http://localhost:8000/api/v1/quotations/dashboard/', ({ request }) => {
        dashboardUrl = request.url
        return HttpResponse.json(dashboardResponse)
      }),
      http.get('http://localhost:8000/api/v1/clients/', () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={['/dashboard?client_search=Andina&period=week&status=paid']}
        >
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(
      screen.getByRole('textbox', { name: 'Buscar cliente para analizar' }),
    ).toHaveValue('Andina')
    await waitFor(() => {
      const url = new URL(dashboardUrl)
      expect(url.searchParams.get('period')).toBe('week')
      expect(url.searchParams.get('status')).toBe('paid')
    })
    expect(screen.getByText('Búsqueda de clientes')).toBeInTheDocument()
  })
})
