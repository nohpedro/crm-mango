import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { DataTransferPanel } from './DataTransferPanel'

afterEach(() => cleanup())

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
})
