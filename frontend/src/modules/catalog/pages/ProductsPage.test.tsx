import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { server } from '../../../test/server'
import { ProductsPage } from './ProductsPage'

describe('ProductsPage', () => {
  it('muestra stock, categoría y estado del producto', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/catalog/products/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 'product-1',
              name: 'Producto demo',
              sku: 'SKU-001',
              barcode: null,
              category: { id: 'cat-1', name: 'General', code: 'GEN' },
              is_active: true,
              deleted_at: null,
              primary_image: null,
              total_stock: 12,
              available_stock: 9,
              created_at: '2026-07-13T00:00:00Z',
              updated_at: '2026-07-13T00:00:00Z',
            },
          ],
        }),
      ),
      http.get('http://localhost:8000/api/v1/catalog/categories/', () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProductsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Producto demo')).toBeInTheDocument()
    expect(screen.getByText('SKU-001')).toBeInTheDocument()
    expect(screen.getByText('9 disponibles')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
  })
})
