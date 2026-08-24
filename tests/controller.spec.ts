import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { OpenRouterProviderController } from '../src/controller.js'
import { endpoints } from './fixtures/endpoints.js'

function deps() {
  return {
    config: () => DEFAULT_CONFIG,
    credential: vi.fn(async () => ({ configured: true, ref: 'DSH_OPENROUTER_KEY', value: 'secret', source: 'provider' as const })),
    sessionSelection: vi.fn(async () => ({ provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra', reasoningEffort: 'high' })),
    sessionDirectory: vi.fn(async () => ({
      current: { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra', reasoningEffort: 'high' },
      groups: [
        { id: 'openrouter-main', name: 'OpenRouter', models: [
          { id: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra' },
          { id: '@preset/deepseek-v4-pro-deepinfra', name: 'DeepSeek V4 Pro · DeepInfra' },
        ] },
        { id: 'local', name: 'Local', models: [{ id: 'local-model', name: 'Local' }] },
      ],
    })),
    providerProfile: vi.fn((provider: string) => provider === 'openrouter-main' ? ({ baseURL: 'https://openrouter.ai/api/v1', models: [
      { id: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra', reasoningEfforts: { off: null, high: 'high' } },
      { id: '@preset/deepseek-v4-pro-deepinfra', name: 'DeepSeek V4 Pro · DeepInfra', reasoningEfforts: { off: null, high: 'high' } },
    ] }) : ({ baseURL: 'http://localhost', models: [{ id: 'local-model', name: 'Local' }] })),
    providerProfiles: vi.fn(() => ({ 'openrouter-main': { baseURL: 'https://openrouter.ai/api/v1', models: [
      { id: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra' },
      { id: '@preset/deepseek-v4-pro-deepinfra', name: 'DeepSeek V4 Pro · DeepInfra' },
    ] }, local: { baseURL: 'http://localhost', models: [{ id: 'local-model', name: 'Local' }] } })),
    listModels: vi.fn(async () => [{ id: 'deepseek/deepseek-v4', name: 'DeepSeek V4' }, { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' }]),
    getEndpoints: vi.fn(async () => [...endpoints, { ...endpoints[0]!, provider_name: 'DeepInfra', tag: 'deepinfra/fp8' }]),
    upsertPreset: vi.fn(async () => ({ slug: 'deepseek-v4-beta' })),
    writeModels: vi.fn(async () => undefined),
    selectModel: vi.fn(async () => undefined),
    saveDefault: vi.fn(async () => undefined),
  }
}

describe('OpenRouterProviderController', () => {
  it('resolves current session route and returns canonical recommendations', async () => {
    const d = deps()
    const controller = new OpenRouterProviderController(d)
    const result = await controller.recommend('s1')
    expect(result.openrouterModel).toBe('deepseek/deepseek-v4')
    expect(result.dsh).toEqual({ provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra' })
    expect(result.currentTag).toBe('deepinfra/fp8')
    expect(d.credential).toHaveBeenCalledWith('openrouter-main')
    expect(d.getEndpoints).toHaveBeenCalledWith(expect.objectContaining({ ref: 'DSH_OPENROUTER_KEY', value: 'secret' }), 'deepseek/deepseek-v4', false)
  })

  it('requires the DSH provider credential before calling OpenRouter', async () => {
    const d = deps()
    d.credential.mockResolvedValueOnce({ configured: false, ref: 'DSH_OPENROUTER_KEY', source: 'provider' } as never)
    const controller = new OpenRouterProviderController(d)
    await expect(controller.recommend('s1')).rejects.toThrow('DSH_OPENROUTER_KEY')
    expect(d.listModels).not.toHaveBeenCalled()
  })

  it('reports value-free connection state for configured OpenRouter routes', async () => {
    const d = deps()
    const controller = new OpenRouterProviderController(d)
    await expect(controller.connection()).resolves.toEqual({
      ok: true,
      configured: true,
      routes: [{ provider: 'openrouter-main', credentialRef: 'DSH_OPENROUTER_KEY', configured: true, source: 'provider' }],
    })
  })

  it('lists configured models from OpenRouter DSH routes', async () => {
    const controller = new OpenRouterProviderController(deps())
    expect(await controller.models('s1')).toEqual({
      ok: true,
      credential: { configured: true, ref: 'DSH_OPENROUTER_KEY', source: 'provider' },
      current: { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra' },
      models: [
        { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra', matchName: 'openrouter-main DeepSeek V4 · DeepInfra', current: true },
        { provider: 'openrouter-main', model: '@preset/deepseek-v4-pro-deepinfra', name: 'DeepSeek V4 Pro · DeepInfra', matchName: 'openrouter-main DeepSeek V4 Pro · DeepInfra', current: false },
        { provider: 'openrouter-main', model: 'local-model', name: 'Local', matchName: 'local Local', current: false },
      ],
    })
  })

  it('rejects an ineligible tag and applies an eligible endpoint through the full chain', async () => {
    const d = deps()
    const controller = new OpenRouterProviderController(d)
    await expect(controller.apply('s1', 'unknown/fp8')).rejects.toThrow(/合格/)
    const result = await controller.apply('s1', 'beta/fp8')
    expect(result).toMatchObject({ ok: true, tag: 'beta/fp8', model: '@preset/deepseek-v4-beta' })
    expect(d.writeModels).toHaveBeenCalled()
    expect(d.selectModel).toHaveBeenCalledWith({ sessionId: 's1', provider: 'openrouter-main', model: '@preset/deepseek-v4-beta', reasoningEffort: 'high' })
    expect(d.saveDefault).toHaveBeenCalled()
  })

  it('re-resolves the credential for mutation instead of retaining the recommendation key', async () => {
    const d = deps()
    d.credential
      .mockResolvedValueOnce({ configured: true, ref: 'OR_KEY', value: 'recommend-key', source: 'provider' })
      .mockResolvedValueOnce({ configured: true, ref: 'OR_KEY', value: 'current-key', source: 'provider' })
    const controller = new OpenRouterProviderController(d)
    await controller.apply('s1', 'beta/fp8')
    expect(d.upsertPreset).toHaveBeenCalledWith(expect.objectContaining({ ref: 'OR_KEY', value: 'current-key' }), 'deepseek/deepseek-v4', 'beta/fp8')
  })
})
