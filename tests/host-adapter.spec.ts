import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { createHostController } from '../src/host-adapter.js'
import { endpoints } from './fixtures/endpoints.js'

describe('host sessionController adapter', () => {
  // createHostController builds its own OpenRouterClient, so an unstubbed fetch would
  // reach the live catalog endpoint and make these adapter assertions network-dependent.
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))))
  afterEach(() => vi.unstubAllGlobals())

  function openRouterProfile() {
    return {
      'openrouter-main': {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKeyEnv: 'DSH_OPENROUTER_KEY',
        models: [
          { id: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra', openrouterModel: 'deepseek/deepseek-v4' },
          { id: '@preset/deepseek-v4-pro-deepinfra', name: 'DeepSeek V4 Pro · DeepInfra', openrouterModel: 'deepseek/deepseek-v4-pro' },
        ],
      },
    }
  }

  function context(overrides: Record<string, unknown> = {}) {
    const modelCatalog = vi.fn(async () => ({
      default: { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra', reasoningEffort: 'high' },
      groups: [{
        id: 'openrouter-main',
        name: 'OpenRouter',
        models: [
          { id: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra' },
          { id: '@preset/deepseek-v4-pro-deepinfra', name: 'DeepSeek V4 Pro · DeepInfra' },
        ],
      }],
    }))
    const selectModel = vi.fn(async () => undefined)
    const base = {
      credentials: { resolve: vi.fn(async () => ({ value: 'secret' })) },
      settings: { get: vi.fn(() => ({ providers: openRouterProfile() })), mutate: vi.fn(async () => undefined) },
      sessionController: { modelCatalog, selectModel },
      agentDefaultModel: { saveSelection: vi.fn(async () => undefined) },
    }
    return { ...base, ...overrides }
  }

  it('reads the shared session model catalog instead of an apiProxy RPC', async () => {
    const ctx = context()
    const controller = createHostController(ctx as never, () => DEFAULT_CONFIG, value => value)
    const catalog = await controller.models('s1')
    expect(ctx.sessionController.modelCatalog).toHaveBeenCalledTimes(1)
    expect(ctx.sessionController.selectModel).not.toHaveBeenCalled()
    expect(catalog).toMatchObject({
      ok: true,
      current: { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra' },
    })
    const current = catalog.models.find(model => model.current)
    expect(current).toEqual({ provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra', matchName: 'openrouter-main DeepSeek V4 · DeepInfra', current: true })
    expect((ctx.credentials.resolve as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('DSH_OPENROUTER_KEY')
  })

  it('requires the DSH provider credential before any OpenRouter call', async () => {
    const ctx = context({ credentials: { resolve: vi.fn(async () => undefined) } })
    const controller = createHostController(ctx as never, () => DEFAULT_CONFIG, value => value)
    await expect(controller.recommend('s1')).rejects.toThrow('DSH_OPENROUTER_KEY')
    expect((globalThis.fetch as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('forwards session model selections through the host Session API', async () => {
    const ctx = context()
    const controller = createHostController(ctx as never, () => DEFAULT_CONFIG, value => value)
    const controllerAsAny = controller as unknown as { apply(sessionId: string, tag: string): Promise<unknown> }
    // Full apply() needs a live recommendation first (network-backed); here we
    // only assert the adapter wiring is intact by driving a successful chain
    // with stubbed OpenRouter responses (models + endpoints + preset POST).
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'deepseek/deepseek-v4', name: 'DeepSeek V4' }, { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' }] }), { status: 200 })
      if (url.includes('/endpoints')) return new Response(JSON.stringify({ data: { endpoints } }), { status: 200 })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchImpl)
    const result = await controllerAsAny.apply('s1', 'alpha/fp16')
    expect(result).toMatchObject({ ok: true, tag: 'alpha/fp16' })
    expect(ctx.sessionController.selectModel).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1', provider: 'openrouter-main' }))
    expect(ctx.agentDefaultModel.saveSelection).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openrouter-main' }))
  })
})
