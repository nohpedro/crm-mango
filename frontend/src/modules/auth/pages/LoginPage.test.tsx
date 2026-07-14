import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'
import { server } from '../../../test/server'
import { LoginPage } from './LoginPage'

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<p>Panel autenticado</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('inicia sesión con credenciales válidas', async () => {
    server.use(
      http.post('http://localhost:8000/api/v1/auth/login/', () =>
        HttpResponse.json({
          access: 'access-token',
          refresh: 'refresh-token',
          token_type: 'Bearer',
          user: adminUser,
        }),
      ),
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'administrador')
    await user.type(screen.getByLabelText(/^contraseña/i), 'Password123!')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('Panel autenticado')).toBeInTheDocument()
    expect(useAuthStore.getState().user?.is_admin).toBe(true)
  })

  it('muestra el mensaje del backend cuando las credenciales son inválidas', async () => {
    server.use(
      http.post('http://localhost:8000/api/v1/auth/login/', () =>
        HttpResponse.json(
          { detail: 'El nombre de usuario o la contraseña no son válidos.' },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'administrador')
    await user.type(screen.getByLabelText(/^contraseña/i), 'incorrecta')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El nombre de usuario o la contraseña no son válidos.',
    )
  })
})
