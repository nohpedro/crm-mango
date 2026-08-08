import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../../../store/authStore'
import { server } from '../../../test/server'
import {
  QuotationFormPage,
  localDateValue,
  quotationPricingRequests,
  totalQuotationQuantity,
} from './QuotationFormPage'

describe('precio grupal de la cotización', () => {
  const items = [
    { product: 'producto-a', quantity: 2 },
    { product: 'producto-b', quantity: 1 },
  ]

  it('suma las unidades de todos los productos', () => {
    expect(totalQuotationQuantity(items)).toBe(3)
  })

  it('envía la cantidad total a la consulta de precio de cada producto', () => {
    const requests = quotationPricingRequests(items, 'cliente-mayorista')

    expect(requests).toEqual([
      {
        product: 'producto-a',
        params: {
          quantity: 2,
          total_quantity: 3,
          client: 'cliente-mayorista',
        },
      },
      {
        product: 'producto-b',
        params: {
          quantity: 1,
          total_quantity: 3,
          client: 'cliente-mayorista',
        },
      },
    ])
  })
})

describe('creación rápida de clientes', () => {
  it('usa la fecha local de hoy como fecha predeterminada', () => {
    expect(localDateValue(new Date('2026-08-07T23:30:00-04:00'))).toBe('2026-08-07')
  })

  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'cotizador',
        email: 'cotizador@idesem.test',
        first_name: 'Usuario',
        last_name: 'Cotizador',
        full_name: 'Usuario Cotizador',
        is_active: true,
        is_staff: false,
        is_admin: false,
        permissions: ['quotations.add_quotation', 'clients.add_client'],
        role: null,
        last_login: null,
        created_at: '2026-08-01T12:00:00Z',
        updated_at: '2026-08-01T12:00:00Z',
      },
    })
  })

  it('crea el cliente con los datos mínimos y lo selecciona en la cotización', async () => {
    const user = userEvent.setup()
    let createdPayload: Record<string, unknown> | undefined
    server.use(
      http.get('http://localhost:8000/api/v1/clients/', () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
      http.get('http://localhost:8000/api/v1/catalog/products/', () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
      http.get('http://localhost:8000/api/v1/clients/types/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 'type-1', name: 'Tienda o comercio', is_active: true }],
        }),
      ),
      http.get('http://localhost:8000/api/v1/catalog/price-levels/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              name: 'Minorista',
              code: 'MINORISTA',
              description: '',
              tiers: [],
              is_active: true,
              created_at: '2026-08-01T12:00:00Z',
              updated_at: '2026-08-01T12:00:00Z',
            },
          ],
        }),
      ),
      http.post('http://localhost:8000/api/v1/clients/', async ({ request }) => {
        createdPayload = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 'client-1',
            ...createdPayload,
            price_level: {
              id: '11111111-1111-1111-1111-111111111111',
              name: 'Minorista',
              code: 'MINORISTA',
            },
            created_at: '2026-08-01T12:00:00Z',
            updated_at: '2026-08-01T12:00:00Z',
          },
          { status: 201 },
        )
      }),
    )

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <QuotationFormPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Crear cliente rápido' })
    await user.type(
      within(dialog).getByLabelText('Nombre o razón social'),
      'Cliente rápido',
    )
    await user.type(within(dialog).getByLabelText('NIT/CI'), '1234567')
    await user.type(within(dialog).getByLabelText('Teléfono o WhatsApp'), '70000000')

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Nivel de precio')).toHaveValue(
        '11111111-1111-1111-1111-111111111111',
      ),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Crear y seleccionar' }))

    await waitFor(() => expect(createdPayload?.name).toBe('Cliente rápido'))
    expect(createdPayload).toMatchObject({
      tax_id: '1234567',
      whatsapp: '70000000',
      client_type: 'Tienda o comercio',
      price_level: '11111111-1111-1111-1111-111111111111',
      department: 'No especificado',
      city_zone: 'No especificado',
      business_activity: 'No especificado',
    })
    await waitFor(() =>
      expect(screen.getByLabelText('Cliente')).toHaveValue('Cliente rápido'),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
