import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { server } from '../../../test/server'
import { RoleFormPage } from './RoleFormPage'

describe('RoleFormPage', () => {
  it('envía permisos seleccionados al crear un rol', async () => {
    let requestBody: Record<string, unknown> | null = null
    server.use(
      http.get('http://localhost:8000/api/v1/permissions/', () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Can view user',
            codename: 'view_user',
            app_label: 'users',
            model: 'user',
          },
          {
            id: 2,
            name: 'Can add user',
            codename: 'add_user',
            app_label: 'users',
            model: 'user',
          },
        ]),
      ),
      http.post('http://localhost:8000/api/v1/roles/', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 'role-1',
            ...requestBody,
            permission_details: [],
            created_at: '',
            updated_at: '',
          },
          { status: 201 },
        )
      }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/roles/new']}>
          <Routes>
            <Route path="/roles/new" element={<RoleFormPage />} />
            <Route path="/roles" element={<p>Roles</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(await screen.findByLabelText(/nombre/i), 'Comercial')
    await user.type(screen.getByLabelText(/código/i), 'sales')
    await user.click(await screen.findByRole('button', { name: 'Ver' }))
    await user.click(screen.getByRole('button', { name: 'Crear' }))
    await user.click(screen.getByRole('button', { name: /crear rol/i }))

    expect(await screen.findByText('Roles')).toBeInTheDocument()
    expect(requestBody).toMatchObject({
      name: 'Comercial',
      code: 'SALES',
      permissions: [1, 2],
      is_active: true,
    })
  })

  it('desbloquea permisos dependientes y los retira al quitar el permiso principal', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/permissions/', () =>
        HttpResponse.json([
          { id: 1, name: 'Can view product', codename: 'view_product', app_label: 'products', model: 'product' },
          { id: 2, name: 'Can view category', codename: 'view_category', app_label: 'products', model: 'category' },
          { id: 3, name: 'Can delete category', codename: 'delete_category', app_label: 'products', model: 'category' },
        ]),
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/roles/new']}>
          <Routes>
            <Route path="/roles/new" element={<RoleFormPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const productsCard = (await screen.findByRole('heading', { name: 'Productos' })).closest('section')
    const categoriesCard = screen.getByRole('heading', { name: 'Categorías' }).closest('section')
    if (!productsCard || !categoriesCard) throw new Error('No se encontraron los recursos')
    const productView = within(productsCard).getByRole('button', { name: 'Ver' })
    const categoryView = within(categoriesCard).getByRole('button', { name: /Ver/ })
    const deleteCategory = within(categoriesCard).getByRole('button', { name: /Eliminar/ })

    expect(categoryView).toBeDisabled()
    expect(deleteCategory).toBeDisabled()
    await user.click(productView)
    expect(categoryView).toBeEnabled()
    await user.click(categoryView)
    expect(deleteCategory).toBeEnabled()
    await user.click(deleteCategory)
    await user.click(productView)

    expect(categoryView).toBeDisabled()
    expect(categoryView).toHaveAttribute('aria-pressed', 'false')
    expect(deleteCategory).toBeDisabled()
    expect(deleteCategory).toHaveAttribute('aria-pressed', 'false')
  })
})
