import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DataTransferPanel } from './DataTransferPanel'
import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'

afterEach(() => cleanup())
beforeEach(() => useAuthStore.setState({ status: 'authenticated', user: adminUser }))

describe('DataTransferPanel', () => {
  it.each([
    ['clients', 'Observaciones'],
    ['products', 'Código de barras'],
    ['warehouses', 'Dirección'],
  ] as const)(
    'explica los campos opcionales antes de descargar la plantilla de %s',
    async (resource, optionalField) => {
      const user = userEvent.setup()
      render(<DataTransferPanel resource={resource} />)

      await user.click(screen.getByRole('button', { name: 'Descargar plantilla Excel' }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Campos opcionales')).toBeInTheDocument()
      expect(screen.getByText(optionalField)).toBeInTheDocument()
      if (resource === 'products') {
        expect(
          screen.getByText('Precio de venta normal (nivel x1) (Bs)'),
        ).toBeInTheDocument()
      }
      expect(
        screen.getByText(/no se agregará dentro del archivo Excel/i),
      ).toBeInTheDocument()
    },
  )

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
    const { container } = render(<DataTransferPanel resource="warehouses" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: {
        files: [
          new File(['contenido'], 'almacenes.xlsx', {
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

  it('permite crear categorías automáticamente al importar productos', async () => {
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

    expect(
      await screen.findByText('Preparar importación de productos'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: /Crear categorías que no existan/,
      }),
    ).toBeEnabled()
    expect(screen.queryByText('Categoría no encontrada')).not.toBeInTheDocument()
  })

  it('permite crear referencias faltantes al importar clientes', async () => {
    const user = userEvent.setup()
    const { container } = render(<DataTransferPanel resource="clients" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: {
        files: [
          new File(['contenido'], 'clientes.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ],
      },
    })

    await user.click(
      screen.getByRole('button', { name: 'Procesar archivo seleccionado', hidden: true }),
    )

    expect(
      await screen.findByText('Preparar importación de clientes'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: /Crear tipos de cliente que no existan/,
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole('checkbox', {
        name: /Crear niveles de precio que no existan/,
      }),
    ).toBeEnabled()
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
    expect(
      screen.queryByRole('button', { name: 'Procesar archivo seleccionado' }),
    ).not.toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument()
  })
})
