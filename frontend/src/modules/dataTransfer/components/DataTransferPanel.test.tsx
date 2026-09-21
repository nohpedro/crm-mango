import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DataTransferPanel } from './DataTransferPanel'
import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'
import { transferService } from '../services/transfer.service'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => useAuthStore.setState({ status: 'authenticated', user: adminUser }))

describe('DataTransferPanel', () => {
  it('permite importar cotizaciones sin conceder exportación', async () => {
    useAuthStore.setState({
      user: {
        ...adminUser,
        is_admin: false,
        permissions: ['quotations.import_quotation'],
      },
    })
    const user = userEvent.setup()
    const imported = vi
      .spyOn(transferService, 'importFile')
      .mockResolvedValue({ mode: 'partial', created: 1, rejected: 0, errors: [] })
    const { container } = render(<DataTransferPanel resource="quotations" />)
    expect(
      screen.queryByRole('button', { name: 'Exportar Excel' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Descargar plantilla Excel' }),
    ).toBeInTheDocument()
    const file = new File(['test'], 'cotizaciones.xlsx')
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    })
    await user.click(
      screen.getByRole('button', { name: 'Procesar archivo seleccionado' }),
    )
    expect(imported).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Si una fila falla, se rechaza toda su cotización/),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /^Procesar archivo$/ }),
    )
    expect(imported).toHaveBeenCalledWith(
      'quotations',
      file,
      'partial',
      expect.any(Object),
    )
    expect(await screen.findByText(/1 creados/)).toBeInTheDocument()
  })

  it('permite exportar cotizaciones sin controles de importación', () => {
    useAuthStore.setState({
      user: {
        ...adminUser,
        is_admin: false,
        permissions: ['quotations.export_quotation'],
      },
    })
    const { container } = render(<DataTransferPanel resource="quotations" />)
    expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })

  it('los permisos ordinarios no conceden transferencia masiva', () => {
    useAuthStore.setState({
      user: {
        ...adminUser,
        is_admin: false,
        permissions: ['quotations.view_quotation', 'quotations.add_quotation'],
      },
    })
    render(<DataTransferPanel resource="quotations" />)
    expect(
      screen.queryByRole('button', { name: 'Exportar Excel' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Descargar plantilla Excel' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['clients', 'Observaciones'],
    ['products', 'Código de barras'],
    ['warehouses', 'Dirección'],
    ['quotations', 'Precio_unitario_Bs'],
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
        screen.getByText(
          resource === 'quotations'
            ? /incluye una hoja de instrucciones/
            : /no se agregará dentro del archivo Excel/i,
        ),
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
