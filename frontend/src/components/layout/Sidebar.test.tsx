import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../../store/authStore'
import { adminUser } from '../../test/factories'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  afterEach(cleanup)

  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', user: adminUser })
  })

  it('marca únicamente la ruta más específica como activa', () => {
    const client = new QueryClient()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/quotations/history']}>
          <Sidebar
            isOpen
            isCollapsed={false}
            onClose={() => undefined}
            onToggleCollapsed={() => undefined}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const quotations = screen.getByRole('link', { name: 'Cotizaciones' })
    const history = screen.getByRole('link', {
      name: 'Historial de cotizaciones',
    })

    expect(history.className).toContain('bg-brand-500')
    expect(quotations.className).not.toContain('bg-brand-500')
  })
})
