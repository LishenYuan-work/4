import { describe, expect, it } from 'vitest'
import { calculateOrderTotal } from './commerce'
import { products } from '../data/products'

describe('fresh shop business rules', () => {
  it('contains six categories and 32 demo products', () => {
    expect(new Set(products.map(product => product.category)).size).toBe(6)
    expect(products).toHaveLength(32)
  })

  it('waives delivery at 29 yuan and charges 3 yuan below the threshold', () => {
    expect(calculateOrderTotal(28).deliveryFee).toBe(3)
    expect(calculateOrderTotal(29).deliveryFee).toBe(0)
  })

  it('applies the demo coupon without allowing a negative total', () => {
    expect(calculateOrderTotal(19.8, 3).totalAmount).toBe(19.8)
    expect(calculateOrderTotal(2, 99).totalAmount).toBe(0)
  })
})
