import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { adminUser } from '../test/factories'
import { PermissionGate } from './PermissionGate'

afterEach(cleanup)

describe('PermissionGate', () => {
  it('permite solo cuando se cumplen todos los permisos requeridos', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        ...adminUser,
        is_admin: false,
        permissions: ['products.view_product'],
      },
    })

    render(
      <MemoryRouter initialEntries={['/protegida']}>
        <Routes>
          <Route
            path="/protegida"
            element={
              <PermissionGate
                allOf={['products.view_product', 'products.change_product']}
              >
                <p>Contenido protegido</p>
              </PermissionGate>
            }
          />
          <Route path="/unauthorized" element={<p>Sin permiso</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Sin permiso')).toBeInTheDocument()
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
  })
})
