import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { ProtectedRoute } from './ProtectedRoute'

describe('ProtectedRoute', () => {
  it('redirige al login cuando no existe una sesión', () => {
    useAuthStore.setState({ status: 'anonymous', user: null })
    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/login" element={<p>Inicio de sesión</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<p>Contenido privado</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })
})
