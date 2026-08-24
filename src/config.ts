export interface Config {
  minContextTokens: number
  cacheTtlMs: number
  recommendedCount: number
  weights: { quantization: number; speed: number; price: number; context: number }
  priceBlend: { input: number; output: number; cache: number }
  uptimePenaltyThreshold: number
  uptimePenaltyFactor: number
}

export type RankingStrategy = 'balanced' | 'price' | 'speed' | 'context'

export const STRATEGY_WEIGHTS: Readonly<Record<Exclude<RankingStrategy, 'balanced'>, Config['weights']>> = {
  price: { quantization: 0.1, speed: 0.1, price: 0.7, context: 0.1 },
  speed: { quantization: 0.15, speed: 0.65, price: 0.1, context: 0.1 },
  context: { quantization: 0.15, speed: 0.1, price: 0.1, context: 0.65 },
}

export const DEFAULT_CONFIG: Readonly<Config> = Object.freeze({
  minContextTokens: 100_000,
  cacheTtlMs: 300_000,
  recommendedCount: 5,
  weights: Object.freeze({ quantization: 0.3, speed: 0.3, price: 0.3, context: 0.1 }),
  priceBlend: Object.freeze({ input: 0.02, output: 0.08, cache: 0.9 }),
  uptimePenaltyThreshold: 99,
  uptimePenaltyFactor: 0.85,
})

function assertUnitSum(label: string, values: readonly number[]): void {
  if (values.some(value => !Number.isFinite(value) || value < 0) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.001) {
    throw new Error(`${label} must contain non-negative values summing to 1`)
  }
}

export function validateConfig(config: Config): void {
  if (!Number.isInteger(config.recommendedCount) || config.recommendedCount < 1 || config.recommendedCount > 10) {
    throw new Error('recommendedCount must be an integer from 1 to 10')
  }
  if (!Number.isFinite(config.minContextTokens) || config.minContextTokens < 1) throw new Error('minContextTokens must be positive')
  if (!Number.isFinite(config.cacheTtlMs) || config.cacheTtlMs < 0) throw new Error('cacheTtlMs must be non-negative')
  if (config.uptimePenaltyThreshold < 0 || config.uptimePenaltyThreshold > 100) throw new Error('uptimePenaltyThreshold must be from 0 to 100')
  if (config.uptimePenaltyFactor < 0 || config.uptimePenaltyFactor > 1) throw new Error('uptimePenaltyFactor must be from 0 to 1')
  assertUnitSum('weights', Object.values(config.weights))
  assertUnitSum('priceBlend', Object.values(config.priceBlend))
}

export function configForStrategy(config: Config, strategy: RankingStrategy): Config {
  return strategy === 'balanced' ? config : { ...config, weights: STRATEGY_WEIGHTS[strategy] }
}
