import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { adminUser } from '../test/factories'
import { HomeRedirect } from './HomeRedirect'

describe('HomeRedirect', () => {
  it('envía al panel solamente cuando el usuario tiene su permiso', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { ...adminUser, is_admin: false, permissions: ['quotations.view_dashboard'] },
    })
    renderRoutes()
    expect(await screen.findByText('Destino panel')).toBeInTheDocument()
  })

  it('envía al primer módulo disponible si no puede ver el panel', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { ...adminUser, is_admin: false, permissions: ['clients.view_client'] },
    })
    renderRoutes()
    expect(await screen.findByText('Destino clientes')).toBeInTheDocument()
  })
})

function renderRoutes() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<p>Destino panel</p>} />
        <Route path="/clients" element={<p>Destino clientes</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
