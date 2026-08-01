import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { server } from '../../../test/server'
import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'
import { ProductImagesPage } from './ProductImagesPage'

describe('ProductImagesPage', () => {
  it('muestra varias imágenes y permite elegir la portada', async () => {
    useAuthStore.setState({ status: 'authenticated', user: adminUser })
    let requestBody: Record<string, unknown> | null = null
    server.use(
      http.get('http://localhost:8000/api/v1/catalog/products/product-1/', () =>
        HttpResponse.json({
          id: 'product-1',
          name: 'Producto demo',
          sku: 'SKU-001',
          barcode: null,
          category: { id: 'cat-1', name: 'General', code: 'GEN' },
          is_active: true,
          deleted_at: null,
          primary_image: 'http://localhost:8000/media/one.jpg',
          total_stock: 1,
          available_stock: 1,
          description: '',
          images: [
            {
              id: 'image-1',
              product: 'product-1',
              image: 'http://localhost:8000/media/one.jpg',
              alt_text: 'Frente',
              is_primary: true,
              position: 0,
              created_at: '',
            },
            {
              id: 'image-2',
              product: 'product-1',
              image: 'http://localhost:8000/media/two.jpg',
              alt_text: 'Lateral',
              is_primary: false,
              position: 1,
              created_at: '',
            },
          ],
          prices: [],
          created_by: null,
          updated_by: null,
          created_at: '',
          updated_at: '',
        }),
      ),
      http.patch(
        'http://localhost:8000/api/v1/catalog/product-images/image-2/',
        async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({})
        },
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/products/product-1/images']}>
          <Routes>
            <Route path="/products/:id/images" element={<ProductImagesPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Galería')).toBeInTheDocument()
    expect(screen.getByText('2 imágenes guardadas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usar como portada' }))

    await waitFor(() => expect(requestBody).toEqual({ is_primary: true }))
  })
})
