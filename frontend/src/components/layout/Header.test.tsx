import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../../store/authStore'
import { adminUser } from '../../test/factories'
import { server } from '../../test/server'
import { Header } from './Header'

describe('Header', () => {
  afterEach(cleanup)

  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', user: adminUser })
    server.use(
      http.get('http://localhost:8000/api/v1/notifications/', () =>
        HttpResponse.json({
          count: 1,
          items: [
            {
              id: 'pending-quotations',
              title: 'Cotizaciones pendientes',
              message: '1 cotización en borrador.',
              path: '/quotations/history?status=pending',
              tone: 'warning',
            },
          ],
        }),
      ),
    )
  })

  function renderHeader() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Header onOpenMenu={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('busca accesos del sistema y muestra notificaciones reales', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: /buscar en el sistema/i }))
    await user.type(
      screen.getByRole('textbox', { name: /buscar una pantalla/i }),
      'Clientes',
    )
    expect(screen.getByRole('button', { name: /Clientes/ })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /cerrar búsqueda/i })[1])
    await user.click(screen.getByRole('button', { name: /ver notificaciones/i }))
    expect(await screen.findByText('1 cotización en borrador.')).toBeInTheDocument()
  })

  it('abre la búsqueda con Ctrl+K y la cierra con Escape', async () => {
    const user = userEvent.setup()
    renderHeader()
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('textbox', { name: /buscar una pantalla/i })).toHaveFocus()
    expect(screen.getByRole('button', { name: /buscar en el sistema/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('textbox', { name: /buscar una pantalla/i }),
    ).not.toBeInTheDocument()
  })
})
