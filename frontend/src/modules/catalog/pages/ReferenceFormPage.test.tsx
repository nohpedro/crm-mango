import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { server } from '../../../test/server'
import { ReferenceFormPage } from './ReferenceFormPage'

describe('ReferenceFormPage', () => {
  it('normaliza el código a mayúsculas al crear una categoría', async () => {
    let requestBody: Record<string, unknown> | null = null
    server.use(
      http.post(
        'http://localhost:8000/api/v1/catalog/categories/',
        async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            { id: 'cat-1', ...requestBody, created_at: '', updated_at: '' },
            { status: 201 },
          )
        },
      ),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/categories/new']}>
          <Routes>
            <Route
              path="/categories/new"
              element={<ReferenceFormPage kind="category" />}
            />
            <Route path="/categories" element={<p>Categorías</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText(/nombre/i), 'Bebidas')
    await user.type(screen.getByLabelText(/código/i), 'beb')
    await user.click(screen.getByRole('button', { name: /crear registro/i }))

    expect(await screen.findByText('Categorías')).toBeInTheDocument()
    expect(requestBody).toMatchObject({ name: 'Bebidas', code: 'BEB', is_active: true })
  })
})
