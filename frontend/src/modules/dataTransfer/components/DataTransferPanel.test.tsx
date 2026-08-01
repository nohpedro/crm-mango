import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DataTransferPanel } from './DataTransferPanel'
import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'

afterEach(() => cleanup())
beforeEach(() => useAuthStore.setState({ status: 'authenticated', user: adminUser }))

describe('DataTransferPanel', () => {
  it('rechaza extensiones que no son Excel', async () => {
    const { container } = render(<DataTransferPanel resource="clients" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['contenido'], 'clientes.csv', { type: 'text/csv' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('extensión .xls o .xlsx')
  })

  it('muestra confirmación antes de procesar un archivo válido', async () => {
    const user = userEvent.setup()
    const { container } = render(<DataTransferPanel resource="products" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: {
        files: [
          new File(['contenido'], 'productos.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ],
      },
    })
    await user.click(
      screen.getByRole('button', { name: 'Procesar archivo seleccionado', hidden: true }),
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('¿Procesar este archivo?')).toBeInTheDocument()
  })

  it('oculta la importación cuando el rol solo puede consultar y exportar', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        ...adminUser,
        is_admin: false,
        permissions: ['clients.view_client'],
      },
    })

    const { container } = render(<DataTransferPanel resource="clients" />)

    expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Procesar archivo seleccionado' })).not.toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument()
  })
})
