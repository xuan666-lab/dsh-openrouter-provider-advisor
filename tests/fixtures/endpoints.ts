import type { OpenRouterEndpoint } from '../../src/types.js'

export const endpoints: OpenRouterEndpoint[] = [
  { provider_name: 'Alpha', tag: 'alpha/fp16', quantization: 'fp16', context_length: 262_144, status: 0, throughput_last_30m: { p50: 80 }, latency_last_30m: { p50: 1 }, pricing: { prompt: '0.0000002', completion: '0.0000004', input_cache_read: '0.00000005' }, uptime_last_30m: 99.9 },
  { provider_name: 'Beta', tag: 'beta/fp8', quantization: 'fp8', context_length: 1_048_576, status: 0, throughput_last_30m: { p50: 120 }, pricing: { prompt: '0.0000001', completion: '0.0000002' }, uptime_last_30m: 99.5 },
  { provider_name: 'Gamma', tag: 'gamma/fp4', quantization: 'fp4', context_length: 131_072, status: 0, throughput_last_30m: { p50: 160 }, pricing: { prompt: '0.00000005', completion: '0.0000001' }, uptime_last_30m: 98.5 },
  { provider_name: 'Short', tag: 'short/fp16', quantization: 'fp16', context_length: 32_768, status: 0, throughput_last_30m: { p50: 500 }, pricing: { prompt: '0', completion: '0' }, uptime_last_30m: 100 },
  { provider_name: 'Down', tag: 'down/fp16', quantization: 'fp16', context_length: 1_048_576, status: 1, throughput_last_30m: { p50: 500 }, pricing: { prompt: '0', completion: '0' }, uptime_last_30m: 100 },
]
