import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../../../store/authStore'
import { server } from '../../../test/server'
import type { Quotation, QuotationStatus } from '../types/quotation.types'
import { QuotationsPage } from './QuotationsPage'

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: toastMocks }))

const quotation = (status: QuotationStatus): Quotation => ({
  id: 60,
  number: 'COT-000060',
  client: null,
  client_name: 'Cliente de prueba',
  client_tax_id: '',
  client_phone: '',
  client_address: '',
  template: null,
  template_name: '',
  valid_days: 15,
  notes: '',
  status,
  quotation_date: '2026-07-31',
  items: [],
  total: '100.00',
  created_by: null,
  created_by_name: '',
  created_at: '2026-07-31T12:00:00Z',
  updated_at: '2026-07-31T12:00:00Z',
})

describe('QuotationsPage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    toastMocks.success.mockClear()
    toastMocks.error.mockClear()
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'qa',
        email: 'qa@idesem.test',
        first_name: 'QA',
        last_name: 'IDESEM',
        full_name: 'QA IDESEM',
        is_active: true,
        is_staff: false,
        is_admin: false,
        permissions: [
          'quotations.view_quotation',
          'quotations.change_quotation_status',
          'clients.view_client',
        ],
        role: null,
        last_login: null,
        created_at: '2026-07-31T12:00:00Z',
        updated_at: '2026-07-31T12:00:00Z',
      },
    })
  })

  it('cambia una cotización pagada a pendiente y confirma el estado guardado', async () => {
    const user = userEvent.setup()
    let currentStatus: QuotationStatus = 'paid'
    let receivedStatus: string | undefined

    server.use(
      http.get('http://localhost:8000/api/v1/quotations/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [quotation(currentStatus)],
        }),
      ),
      http.patch('http://localhost:8000/api/v1/quotations/60/', async ({ request }) => {
        const payload = (await request.json()) as { status: QuotationStatus }
        receivedStatus = payload.status
        currentStatus = payload.status
        return HttpResponse.json(quotation(currentStatus))
      }),
    )

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <QuotationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const statusSelect = await screen.findByRole('combobox', {
      name: 'Cambiar estado de COT-000060',
    })
    expect(statusSelect).toHaveValue('paid')

    await user.selectOptions(statusSelect, 'pending')

    await waitFor(() => expect(receivedStatus).toBe('pending'))
    await waitFor(() => expect(statusSelect).toHaveValue('pending'))
    expect(toastMocks.success).toHaveBeenCalledWith('Cotización marcada como pendiente.')
    expect(toastMocks.success).not.toHaveBeenCalledWith('Cotización marcada como pagada.')
  })

  it('filtra el historial por un cliente seleccionado', async () => {
    const user = userEvent.setup()
    let selectedClient = ''
    server.use(
      http.get('http://localhost:8000/api/v1/clients/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 'client-1',
              name: 'Constructora Andina',
              tax_id: '10203040',
              whatsapp: '70000000',
              department: 'La Paz',
              city_zone: 'Centro',
              client_type: 'Empresa',
              price_level: null,
              business_activity: 'Construcción',
              observations: '',
              is_active: true,
              created_at: '2026-07-31T12:00:00Z',
              updated_at: '2026-07-31T12:00:00Z',
            },
          ],
        }),
      ),
      http.get('http://localhost:8000/api/v1/quotations/', ({ request }) => {
        selectedClient = new URL(request.url).searchParams.get('client') ?? ''
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] })
      }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <QuotationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Filtrar por cliente'), 'Andina')
    await user.click(await screen.findByRole('button', { name: /Constructora Andina/i }))

    await waitFor(() => expect(selectedClient).toBe('client-1'))
    expect(screen.getByText('Constructora Andina')).toBeInTheDocument()
  })
})
