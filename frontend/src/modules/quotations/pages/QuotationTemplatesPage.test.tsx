import { describe, expect, it } from 'vitest'

import type { QuotationTemplateSection } from '../types/quotation.types'
import {
  maximumHeaderHeightForSections,
  resolveTemplateSections,
} from './QuotationTemplatesPage'

const products = (): QuotationTemplateSection => ({
  key: 'items',
  type: 'system',
  title: 'Detalle de productos',
  visible: true,
  order: 10,
  content: '',
  grid_row: 1,
  grid_column: 1,
  column_span: 12,
  row_span: 14,
})

const totals = (): QuotationTemplateSection => ({
  key: 'totals',
  type: 'system',
  title: 'Totales',
  visible: true,
  order: 20,
  content: '',
  grid_row: 50,
  grid_column: 1,
  column_span: 12,
  row_span: 7,
})

describe('redimensionamiento de Detalle de productos', () => {
  it('permite ocupar toda la hoja cuando no existen otras cajas', () => {
    const result = resolveTemplateSections(
      [products()],
      'items',
      1,
      1,
      12,
      120,
      12,
    )

    expect(result[0].grid_row).toBe(1)
    expect(result[0].row_span).toBe(120)
  })

  it('se detiene antes de otra caja sin cambiar su posición', () => {
    const result = resolveTemplateSections(
      [products(), totals()],
      'items',
      1,
      1,
      12,
      120,
      12,
    )
    const resizedProducts = result.find((section) => section.key === 'items')
    const preservedTotals = result.find((section) => section.key === 'totals')

    expect(resizedProducts?.row_span).toBe(49)
    expect(preservedTotals?.grid_row).toBe(50)
    expect(preservedTotals?.row_span).toBe(7)
  })

  it('no limita el alto por una caja ubicada en otra columna', () => {
    const sideBox = {
      ...totals(),
      grid_column: 7,
      column_span: 6,
    }
    const halfWidthProducts = {
      ...products(),
      column_span: 6,
    }
    const result = resolveTemplateSections(
      [halfWidthProducts, sideBox],
      'items',
      1,
      1,
      6,
      120,
      12,
    )

    expect(result.find((section) => section.key === 'items')?.row_span).toBe(120)
    expect(result.find((section) => section.key === 'totals')?.grid_row).toBe(50)
  })

  it('no mueve otra caja cuando no existe espacio mínimo para crecer', () => {
    const closeTotals = {
      ...totals(),
      grid_row: 8,
    }
    const result = resolveTemplateSections(
      [products(), closeTotals],
      'items',
      1,
      1,
      12,
      120,
      12,
    )

    expect(result.find((section) => section.key === 'items')?.row_span).toBe(14)
    expect(result.find((section) => section.key === 'totals')?.grid_row).toBe(8)
  })
})

describe('alto máximo del encabezado', () => {
  it('disminuye cuando una sección ocupa la parte inferior de la hoja', () => {
    const upperSections = [products(), { ...totals(), grid_row: 35 }]
    const lowerSections = [products(), { ...totals(), grid_row: 105, row_span: 10 }]

    const upperMaximum = maximumHeaderHeightForSections(upperSections, 1)
    const lowerMaximum = maximumHeaderHeightForSections(lowerSections, 1)

    expect(lowerMaximum).toBeLessThan(upperMaximum)
    expect(lowerMaximum).toBeGreaterThanOrEqual(18)
  })

  it('también aprovecha el espacio vacío antes de la primera sección', () => {
    const sections = [{ ...products(), grid_row: 20 }, { ...totals(), grid_row: 55 }]
    const translated = sections.map((section) => ({
      ...section,
      grid_row: (section.grid_row ?? 1) + 30,
    }))

    expect(maximumHeaderHeightForSections(translated, 1)).toBe(
      maximumHeaderHeightForSections(sections, 1),
    )
  })
})
