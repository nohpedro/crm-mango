import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuotationPaymentDialog } from './QuotationPaymentDialog'
import { quotationService } from '../services/quotation.service'
import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'
import type { Quotation } from '../types/quotation.types'

const quotation = {
  id: 1,
  number: 'COT-000001',
  client_name: 'Cliente',
  items: [
    {
      id: 3,
      name: 'Equipo',
      sku: 'EQ1',
      quantity: 2,
      serial_numbers: [],
      unit_price: '20.00',
    },
  ],
}
const paid: Quotation = {
  ...quotation,
  status: 'paid',
  client: null,
  client_tax_id: '',
  client_phone: '',
  client_address: '',
  template: null,
  template_name: '',
  valid_days: 7,
  notes: '',
  quotation_date: '2026-09-21',
  total: '40.00',
  created_by: null,
  created_by_name: '',
  created_at: '',
  updated_at: '',
  items: quotation.items.map((item) => ({
    ...item,
    product: null,
    normal_unit_price: '20.00',
    special_unit_price: null,
    applied_price_level: '',
    additional_discount_percent: '0',
    unit_price: '20.00',
    price_manually_set: false,
    savings: '0',
    total: '40.00',
  })),
}
const close = vi.fn()
function setup(value = quotation) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuotationPaymentDialog quotation={value} onClose={close} />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}
beforeEach(() => {
  useAuthStore.setState({ user: adminUser })
  vi.spyOn(quotationService, 'markPaid').mockResolvedValue(paid)
  vi.spyOn(quotationService, 'downloadPdf').mockResolvedValue(new Blob(['pdf']))
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    }),
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  close.mockReset()
})

describe('QuotationPaymentDialog', () => {
  it('distingue precio unitario, cantidad, subtotales y total con varios productos', async () => {
    const user = setup({
      ...quotation,
      items: [
        { ...quotation.items[0], quantity: 3, unit_price: '1180.00' },
        {
          ...quotation.items[0],
          id: 4,
          name: 'Accesorio',
          quantity: 2,
          unit_price: '25.00',
        },
      ],
    })
    expect(screen.getByLabelText('Subtotal de Equipo')).toHaveTextContent('Bs 3540.00')
    expect(screen.getByLabelText('Subtotal de Accesorio')).toHaveTextContent('Bs 50.00')
    expect(screen.getByRole('status')).toHaveTextContent('Bs 3590.00')
    await user.click(
      screen.getByRole('checkbox', { name: 'Modificar precios de la cotización' }),
    )
    const price = screen.getByLabelText('Precio unitario de Equipo (Bs)')
    expect(price).toHaveValue(1180)
    expect(screen.getByText('3 unidades')).toBeInTheDocument()
    await user.clear(price)
    expect(screen.getByLabelText('Subtotal de Equipo')).toHaveTextContent(
      'Revisa el precio',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Revisa los precios')
    await user.type(price, '1000.50')
    expect(screen.getByLabelText('Subtotal de Equipo')).toHaveTextContent('Bs 3001.50')
    expect(screen.getByRole('status')).toHaveTextContent('Bs 3051.50')
  })
  it('habilita precios con check, recalcula el total y envía el nuevo precio', async () => {
    const user = setup()
    expect(
      screen.queryByLabelText('Precio unitario de Equipo (Bs)'),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('checkbox', { name: 'Modificar precios de la cotización' }),
    )
    const price = screen.getByLabelText('Precio unitario de Equipo (Bs)')
    await user.clear(price)
    await user.type(price, '12.50')
    expect(screen.getByText('Total cotización: Bs 25.00')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Número de serie 1 de Equipo'), 'S1')
    await user.type(screen.getByLabelText('Número de serie 2 de Equipo'), 'S2')
    await user.click(screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }))
    expect(quotationService.markPaid).toHaveBeenCalledWith('1', [
      { id: 3, serial_numbers: ['S1', 'S2'], manual_unit_price: 12.5 },
    ])
  })
  it('al desmarcar conserva los precios originales y no envía cambios', async () => {
    const user = setup()
    const checkbox = screen.getByRole('checkbox', {
      name: 'Modificar precios de la cotización',
    })
    await user.click(checkbox)
    await user.clear(screen.getByLabelText('Precio unitario de Equipo (Bs)'))
    expect(
      screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }),
    ).toBeDisabled()
    await user.click(checkbox)
    expect(screen.getByText('Total cotización: Bs 40.00')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Número de serie 1 de Equipo'), 'S1')
    await user.type(screen.getByLabelText('Número de serie 2 de Equipo'), 'S2')
    await user.click(screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }))
    expect(quotationService.markPaid).toHaveBeenCalledWith('1', [
      { id: 3, serial_numbers: ['S1', 'S2'] },
    ])
  })
  it('oculta la modificación de precios sin permiso', () => {
    useAuthStore.setState({
      user: {
        ...adminUser,
        is_admin: false,
        permissions: ['quotations.change_quotation_status'],
      },
    })
    setup()
    expect(
      screen.queryByRole('checkbox', { name: 'Modificar precios de la cotización' }),
    ).not.toBeInTheDocument()
  })
  it('cancelar no cambia el estado ni genera documentos', async () => {
    const user = setup()
    expect(
      screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(close).toHaveBeenCalled()
    expect(quotationService.markPaid).not.toHaveBeenCalled()
    expect(quotationService.downloadPdf).not.toHaveBeenCalled()
  })
  it('guarda todas las series y después descarga la plantilla elegida', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Número de serie 1 de Equipo'), ' S1 ')
    expect(
      screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }),
    ).toBeDisabled()
    await user.type(screen.getByLabelText('Número de serie 2 de Equipo'), 'S2')
    await user.selectOptions(screen.getByLabelText('Formato de hoja de venta'), 'roll')
    await user.click(screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }))
    expect(quotationService.markPaid).toHaveBeenCalledWith('1', [
      { id: 3, serial_numbers: ['S1', 'S2'] },
    ])
    expect(quotationService.downloadPdf).toHaveBeenCalledWith('1', 'roll')
    expect(close).toHaveBeenCalledWith(paid)
  })
  it('permite reintentar el PDF sin volver a registrar el pago', async () => {
    vi.mocked(quotationService.downloadPdf).mockRejectedValueOnce(new Error('PDF error'))
    const user = setup()
    await user.type(screen.getByLabelText('Número de serie 1 de Equipo'), 'S1')
    await user.type(screen.getByLabelText('Número de serie 2 de Equipo'), 'S2')
    await user.click(screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('quedó Pagada')
    expect(close).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Reintentar descarga' }))
    expect(quotationService.markPaid).toHaveBeenCalledTimes(1)
    expect(quotationService.downloadPdf).toHaveBeenCalledTimes(2)
  })
  it('no genera la hoja si falla el guardado', async () => {
    vi.mocked(quotationService.markPaid).mockRejectedValueOnce(new Error('save error'))
    const user = setup()
    await user.type(screen.getByLabelText('Número de serie 1 de Equipo'), 'S1')
    await user.type(screen.getByLabelText('Número de serie 2 de Equipo'), 'S2')
    await user.click(screen.getByRole('button', { name: 'Marcar Pagada y generar hoja' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(quotationService.downloadPdf).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})
