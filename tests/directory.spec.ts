import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { OpenRouterProviderDirectory, ProviderDirectoryError } from '../src/directory.js'
import { endpoints } from './fixtures/endpoints.js'

const models = [{ id: 'deepseek/deepseek-v4', name: 'DeepSeek V4' }]
const route = { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra', baseURL: 'https://openrouter.ai/api/v1', currentTag: 'deepinfra/fp8' }

describe('OpenRouterProviderDirectory', () => {
  it('returns the canonical ranked response', async () => {
    const directory = new OpenRouterProviderDirectory({
      config: () => DEFAULT_CONFIG,
      listModels: async () => models,
      getEndpoints: async () => endpoints,
    })
    const result = await directory.recommend(route)
    expect(result).toMatchObject({ ok: true, dsh: { provider: 'openrouter-main', model: route.model }, openrouterModel: 'deepseek/deepseek-v4', currentTag: 'deepinfra/fp8' })
    expect(result.recommended).toHaveLength(3)
  })

  it('surfaces a stable error code for non-OpenRouter routes', async () => {
    const directory = new OpenRouterProviderDirectory({ config: () => DEFAULT_CONFIG, listModels: async () => models, getEndpoints: async () => endpoints })
    await expect(directory.recommend({ provider: 'local', model: 'deepseek-v4', baseURL: 'http://localhost' })).rejects.toMatchObject({ code: 'NOT_OPENROUTER' } satisfies Partial<ProviderDirectoryError>)
  })

  it('does not relax filters when no endpoint qualifies', async () => {
    const directory = new OpenRouterProviderDirectory({ config: () => DEFAULT_CONFIG, listModels: async () => models, getEndpoints: async () => endpoints.filter(item => item.context_length < 100_000) })
    await expect(directory.recommend(route)).rejects.toMatchObject({ code: 'NO_ELIGIBLE_ENDPOINTS' } satisfies Partial<ProviderDirectoryError>)
  })
})
