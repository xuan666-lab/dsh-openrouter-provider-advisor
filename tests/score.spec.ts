import { describe, expect, it } from 'vitest'
import { configForStrategy, DEFAULT_CONFIG, validateConfig } from '../src/config.js'
import { rankEndpoints, uptimeMultiplier } from '../src/score.js'
import { endpoints } from './fixtures/endpoints.js'

describe('rankEndpoints', () => {
  it('applies non-bypassable reliability safety bands', () => {
    expect(uptimeMultiplier(99.95, DEFAULT_CONFIG)).toBe(1)
    expect(uptimeMultiplier(99.6, DEFAULT_CONFIG)).toBe(1)
    expect(uptimeMultiplier(99.48, DEFAULT_CONFIG)).toBe(0.85)
    expect(uptimeMultiplier(98.9, DEFAULT_CONFIG)).toBe(0.6)
    expect(uptimeMultiplier(95, DEFAULT_CONFIG)).toBe(0.3)
    expect(uptimeMultiplier(80, DEFAULT_CONFIG)).toBe(0.05)
    expect(uptimeMultiplier(null, DEFAULT_CONFIG)).toBe(0.7)
    expect(uptimeMultiplier(99.95, { ...DEFAULT_CONFIG, uptimePenaltyThreshold: 100, uptimePenaltyFactor: 0.2 })).toBe(0.2)
  })

  it('moderately discounts a provider just below 99.5 percent uptime', () => {
    const degraded = { ...endpoints[1]!, provider_name: 'Degraded', tag: 'degraded/fp8', uptime_last_30m: 99.48 }
    const healthy = { ...degraded, provider_name: 'Healthy', tag: 'healthy/fp8', uptime_last_30m: 99.95 }
    const degradedScore = rankEndpoints([degraded], DEFAULT_CONFIG).recommended[0]!.score
    const healthyScore = rankEndpoints([healthy], DEFAULT_CONFIG).recommended[0]!.score
    expect(degradedScore).toBeCloseTo(healthyScore * 0.85, 1)
  })
  it('filters unavailable and short endpoints without padding recommendations', () => {
    const result = rankEndpoints(endpoints, DEFAULT_CONFIG)
    expect([...result.recommended, ...result.rest].map(item => item.tag)).not.toContain('short/fp16')
    expect([...result.recommended, ...result.rest].map(item => item.tag)).not.toContain('down/fp16')
    expect(result.recommended).toHaveLength(3)
    expect(result.rest).toHaveLength(0)
  })

  it('marks current tag and exposes prices in USD per million tokens', () => {
    const result = rankEndpoints(endpoints, DEFAULT_CONFIG, 'alpha/fp16')
    const alpha = result.recommended.find(item => item.tag === 'alpha/fp16')!
    expect(alpha.current).toBe(true)
    expect(alpha.price).toEqual({ input: 0.2, output: 0.4, cache: 0.05 })
    expect(alpha.reasons.length).toBeLessThanOrEqual(3)
  })

  it('honors configurable recommendation count', () => {
    const result = rankEndpoints(endpoints, { ...DEFAULT_CONFIG, recommendedCount: 1 })
    expect(result.recommended).toHaveLength(1)
    expect(result.rest).toHaveLength(2)
  })
})

describe('validateConfig', () => {
  it('defaults price blending to cache-heavy code-agent traffic', () => {
    expect(DEFAULT_CONFIG.priceBlend).toEqual({ input: 0.02, output: 0.08, cache: 0.9 })
  })

  it('derives ranking presets while balanced preserves configured weights', () => {
    expect(configForStrategy(DEFAULT_CONFIG, 'balanced').weights).toEqual(DEFAULT_CONFIG.weights)
    expect(configForStrategy(DEFAULT_CONFIG, 'price').weights).toEqual({ quantization: 0.1, speed: 0.1, price: 0.7, context: 0.1 })
    expect(configForStrategy(DEFAULT_CONFIG, 'speed').weights).toEqual({ quantization: 0.15, speed: 0.65, price: 0.1, context: 0.1 })
    expect(configForStrategy(DEFAULT_CONFIG, 'context').weights).toEqual({ quantization: 0.15, speed: 0.1, price: 0.1, context: 0.65 })
  })

  it('rejects invalid score sums, price sums, and recommendation bounds', () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, weights: { ...DEFAULT_CONFIG.weights, context: 0.2 } })).toThrow(/weights/i)
    expect(() => validateConfig({ ...DEFAULT_CONFIG, priceBlend: { ...DEFAULT_CONFIG.priceBlend, cache: 0.2 } })).toThrow(/priceBlend/i)
    expect(() => validateConfig({ ...DEFAULT_CONFIG, recommendedCount: 11 })).toThrow(/recommendedCount/i)
  })
})
