import { describe, expect, it } from 'vitest'
import { percent, rebalanceWeights } from '../src/client/linked-weights.js'

describe('rebalanceWeights', () => {
  it('redistributes the remainder across unlocked peers proportionally', () => {
    expect(rebalanceWeights({ quality: 0.3, speed: 0.3, price: 0.3, context: 0.1 }, 'price', 0.5, new Set())).toEqual({
      quality: 0.214286, speed: 0.214286, price: 0.5, context: 0.071428,
    })
  })

  it('preserves locked peers and redistributes only unlocked peers', () => {
    expect(rebalanceWeights({ input: 0.02, output: 0.08, cache: 0.9 }, 'cache', 0.8, new Set(['input']))).toEqual({
      input: 0.02, output: 0.18, cache: 0.8,
    })
  })

  it('clamps the changed value to capacity left by locked peers', () => {
    expect(rebalanceWeights({ a: 0.4, b: 0.4, c: 0.2 }, 'c', 0.8, new Set(['a', 'b']))).toEqual({ a: 0.4, b: 0.4, c: 0.2 })
  })

  it('splits remainder equally when adjustable peers are all zero', () => {
    expect(rebalanceWeights({ a: 1, b: 0, c: 0 }, 'a', 0.4, new Set())).toEqual({ a: 0.4, b: 0.3, c: 0.3 })
  })

  it('formats unit values as whole percentages', () => {
    expect(percent(0.9)).toBe('90%')
    expect(percent(0.125)).toBe('12.5%')
  })
})
