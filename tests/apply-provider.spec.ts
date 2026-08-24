import { describe, expect, it, vi } from 'vitest'
import { applyProvider, ProviderApplyError } from '../src/apply-provider.js'
import type { OpenRouterEndpoint } from '../src/types.js'

const endpoint: OpenRouterEndpoint = {
  provider_name: 'CoreWeave', tag: 'coreweave/fp8', quantization: 'fp8', context_length: 262_144,
  status: 0, pricing: { prompt: '0.1', completion: '0.2' },
}

function dependencies() {
  return {
    upsertPreset: vi.fn(async () => ({ slug: 'deepseek-v4-coreweave' })),
    readModels: vi.fn<() => Promise<import('../src/apply-provider.js').DshModelEntry[]>>(async () => [{ id: '@preset/deepseek-v4-old', name: 'Old', reasoningEfforts: { off: null, high: 'high', max: 'ultra' } }]),
    writeModels: vi.fn<(route: string, models: import('../src/apply-provider.js').DshModelEntry[]) => Promise<void>>(async () => undefined),
    selectModel: vi.fn(async () => undefined),
    saveDefault: vi.fn(async () => undefined),
  }
}

const input = { sessionId: 's1', route: 'openrouter-main', sourceModel: '@preset/deepseek-v4-old', openrouterModel: 'deepseek/deepseek-v4', endpoint, reasoningEffort: 'high' }

describe('applyProvider', () => {
  it('runs preset, model upsert, session switch, then default save', async () => {
    const deps = dependencies()
    const result = await applyProvider(deps, input)
    expect(result).toEqual({ ok: true, provider: 'openrouter-main', model: '@preset/deepseek-v4-coreweave', tag: 'coreweave/fp8', openrouterModel: 'deepseek/deepseek-v4' })
    const written = deps.writeModels.mock.calls[0]![1]
    expect(written[0]).toMatchObject({ id: '@preset/deepseek-v4-old' })
    expect(written.at(-1)).toMatchObject({ id: '@preset/deepseek-v4-coreweave', contextWindow: 262_144, compat: { thinkingFormat: 'openrouter' }, reasoningEfforts: { off: null, high: 'high', max: 'ultra' } })
    expect(deps.selectModel).toHaveBeenCalledWith({ sessionId: 's1', provider: 'openrouter-main', model: '@preset/deepseek-v4-coreweave', reasoningEffort: 'high' })
    expect(deps.saveDefault).toHaveBeenCalledWith({ provider: 'openrouter-main', model: '@preset/deepseek-v4-coreweave', reasoningEffort: 'high' })
    expect(deps.upsertPreset.mock.invocationCallOrder[0]).toBeLessThan(deps.writeModels.mock.invocationCallOrder[0]!)
    expect(deps.writeModels.mock.invocationCallOrder[0]).toBeLessThan(deps.selectModel.mock.invocationCallOrder[0]!)
  })

  it('removes stale preset entries for the same OpenRouter model while keeping unrelated entries', async () => {
    const deps = dependencies()
    deps.readModels.mockResolvedValueOnce([
      { id: '@preset/deepseek-v4-novita', name: 'V4 · Novita', openrouterModel: 'deepseek/deepseek-v4' },
      { id: '@preset/deepseek-v4-pro-novita', name: 'V4 Pro · Novita', openrouterModel: 'deepseek/deepseek-v4-pro' },
      { id: 'deepseek-chat', name: 'Direct route' },
    ])
    await applyProvider(deps, input)
    const written = deps.writeModels.mock.calls[0]![1]
    expect(written.map(model => model.id)).toEqual(['@preset/deepseek-v4-pro-novita', 'deepseek-chat', '@preset/deepseek-v4-coreweave'])
  })

  it('does not mutate settings when preset creation fails', async () => {
    const deps = dependencies()
    deps.upsertPreset.mockRejectedValueOnce(new Error('preset failed'))
    await expect(applyProvider(deps, input)).rejects.toMatchObject({ stage: 'preset' } satisfies Partial<ProviderApplyError>)
    expect(deps.writeModels).not.toHaveBeenCalled()
    expect(deps.selectModel).not.toHaveBeenCalled()
  })

  it('describes partial state when session selection fails', async () => {
    const deps = dependencies()
    deps.selectModel.mockRejectedValueOnce(new Error('gone'))
    await expect(applyProvider(deps, input)).rejects.toMatchObject({ stage: 'select-model', partial: true } satisfies Partial<ProviderApplyError>)
    expect(deps.saveDefault).not.toHaveBeenCalled()
  })
})
