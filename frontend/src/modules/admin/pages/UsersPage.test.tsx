import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { adminUser } from '../../../test/factories'
import { server } from '../../../test/server'
import { UsersPage } from './UsersPage'

describe('UsersPage', () => {
  it('renderiza la respuesta paginada del backend', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/users/', () =>
        HttpResponse.json({ count: 1, next: null, previous: null, results: [adminUser] }),
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Admin IDESEM')).toBeInTheDocument()
    expect(screen.getByText('admin@idesem.com')).toBeInTheDocument()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText(/1.*de 1/)).toBeInTheDocument()
  })
})
