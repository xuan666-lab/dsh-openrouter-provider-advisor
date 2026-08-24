export interface OpenRouterModel {
  id: string
  name: string
}

export interface OpenRouterEndpoint {
  provider_name: string
  tag: string
  quantization?: string | null
  context_length: number
  status: number
  throughput_last_30m?: { p50?: number | null } | null
  latency_last_30m?: { p50?: number | null } | null
  pricing: {
    prompt?: string | number | null
    completion?: string | number | null
    input_cache_read?: string | number | null
  }
  uptime_last_30m?: number | null
}

export interface ProviderScore {
  quantization: number
  speed: number
  price: number
  context: number
}

export interface RankedProvider {
  rank: number
  score: number
  providerName: string
  tag: string
  quantization: string
  tps: number
  latency: number | null
  price: { input: number; output: number; cache: number }
  contextLength: number
  uptime: number | null
  current: boolean
  reasons: string[]
  dimensions: ProviderScore
}

export interface RankedProviders {
  recommended: RankedProvider[]
  rest: RankedProvider[]
}
