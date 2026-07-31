import { describe, expect, it } from 'vitest'

import {
  quotationPricingRequests,
  totalQuotationQuantity,
} from './QuotationFormPage'

describe('precio grupal de la cotización', () => {
  const items = [
    { product: 'producto-a', quantity: 2 },
    { product: 'producto-b', quantity: 1 },
  ]

  it('suma las unidades de todos los productos', () => {
    expect(totalQuotationQuantity(items)).toBe(3)
  })

  it('envía la cantidad total a la consulta de precio de cada producto', () => {
    const requests = quotationPricingRequests(items, 'cliente-mayorista')

    expect(requests).toEqual([
      {
        product: 'producto-a',
        params: {
          quantity: 2,
          total_quantity: 3,
          client: 'cliente-mayorista',
        },
      },
      {
        product: 'producto-b',
        params: {
          quantity: 1,
          total_quantity: 3,
          client: 'cliente-mayorista',
        },
      },
    ])
  })
})
