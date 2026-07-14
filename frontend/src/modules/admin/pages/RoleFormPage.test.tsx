import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
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
    await user.click(screen.getByLabelText(/can add user/i))
    await user.click(screen.getByRole('button', { name: /crear rol/i }))

    expect(await screen.findByText('Roles')).toBeInTheDocument()
    expect(requestBody).toMatchObject({
      name: 'Comercial',
      code: 'SALES',
      permissions: [1],
      is_active: true,
    })
  })
})
