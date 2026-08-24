import type { Config } from './config.js'
import { validateConfig } from './config.js'
import type { OpenRouterEndpoint, ProviderScore, RankedProvider, RankedProviders } from './types.js'

const MAX_CONTEXT = 1_048_576

function finite(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function scale(value: number, min: number, max: number, invert = false): number {
  if (max === min) return 100
  const score = 100 * (value - min) / (max - min)
  return invert ? 100 - score : score
}

function quantizationScore(value?: string | null): number {
  switch (value?.toLowerCase()) {
    case 'bf16':
    case 'fp16': return 100
    case 'fp8': return 80
    case 'fp4': return 45
    default: return 40
  }
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function uptimeMultiplier(uptime: number | null, config: Config): number {
  const safety = uptime === null ? 0.7
    : uptime >= 99.5 ? 1
      : uptime >= 99 ? 0.85
        : uptime >= 97 ? 0.6
          : uptime >= 90 ? 0.3
            : 0.05
  const configured = uptime !== null && uptime < config.uptimePenaltyThreshold ? config.uptimePenaltyFactor : 1
  return Math.min(safety, configured)
}

export function rankEndpoints(endpoints: readonly OpenRouterEndpoint[], config: Config, currentTag?: string): RankedProviders {
  validateConfig(config)
  const eligible = endpoints.filter(endpoint => endpoint.status === 0 && endpoint.context_length >= config.minContextTokens)
  const raw = eligible.map(endpoint => {
    const input = finite(endpoint.pricing.prompt) * 1_000_000
    const output = finite(endpoint.pricing.completion) * 1_000_000
    const cache = finite(endpoint.pricing.input_cache_read) * 1_000_000
    return {
      endpoint,
      tps: finite(endpoint.throughput_last_30m?.p50),
      price: { input, output, cache },
      cost: config.priceBlend.input * input + config.priceBlend.output * output + config.priceBlend.cache * cache,
    }
  })
  const speeds = raw.map(item => item.tps)
  const costs = raw.map(item => item.cost)
  const minSpeed = Math.min(...speeds)
  const maxSpeed = Math.max(...speeds)
  const minCost = Math.min(...costs)
  const maxCost = Math.max(...costs)

  const ranked: RankedProvider[] = raw.map(item => {
    const dimensions: ProviderScore = {
      quantization: quantizationScore(item.endpoint.quantization),
      speed: scale(item.tps, minSpeed, maxSpeed),
      price: scale(item.cost, minCost, maxCost, true),
      context: 100 * Math.min(1, Math.max(0, (item.endpoint.context_length - config.minContextTokens) / (MAX_CONTEXT - config.minContextTokens))),
    }
    let score = config.weights.quantization * dimensions.quantization
      + config.weights.speed * dimensions.speed
      + config.weights.price * dimensions.price
      + config.weights.context * dimensions.context
    const uptime = item.endpoint.uptime_last_30m ?? null
    score *= uptimeMultiplier(uptime, config)
    const quant = item.endpoint.quantization?.toLowerCase() || 'unknown'
    return {
      rank: 0,
      score: round(score, 1),
      providerName: item.endpoint.provider_name,
      tag: item.endpoint.tag,
      quantization: quant,
      tps: item.tps,
      latency: item.endpoint.latency_last_30m?.p50 ?? null,
      price: { input: round(item.price.input, 6), output: round(item.price.output, 6), cache: round(item.price.cache, 6) },
      contextLength: item.endpoint.context_length,
      uptime,
      current: item.endpoint.tag === currentTag,
      reasons: [quant, `${round(item.tps, 1)} t/s`, `${uptime === null ? 'unknown' : round(uptime, 2)}% uptime`],
      dimensions,
    }
  }).sort((a, b) => b.score - a.score || b.dimensions.speed - a.dimensions.speed || b.dimensions.price - a.dimensions.price || a.providerName.localeCompare(b.providerName))

  ranked.forEach((item, index) => { item.rank = index + 1 })
  return { recommended: ranked.slice(0, config.recommendedCount), rest: ranked.slice(config.recommendedCount) }
}
