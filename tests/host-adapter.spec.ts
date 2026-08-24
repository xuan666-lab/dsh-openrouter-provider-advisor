import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { createHostController } from '../src/host-adapter.js'

describe('host apiProxy adapter', () => {
  it('wraps session domain calls in RpcRequest payloads', async () => {
    const models = vi.fn(async () => ({ result: { ok: true as const, value: { current: { provider: 'local', model: 'x' } } } }))
    const selectModel = vi.fn(async () => ({ result: { ok: true as const, value: { selected: { provider: 'local', model: 'x' } } } }))
    const ctx = {
      credentials: { resolve: vi.fn(async () => ({ value: 'secret' })) },
      settings: { get: vi.fn(() => ({ providers: { local: { baseURL: 'http://localhost', models: [] } } })), mutate: vi.fn(async () => undefined) },
      apiProxy: { sessions: { models, selectModel } },
      agentDefaultModel: { saveSelection: vi.fn(async () => undefined) },
    }
    const controller = createHostController(ctx, () => DEFAULT_CONFIG, value => value)
    await expect(controller.recommend('s1')).rejects.toThrow(/OpenRouter/)
    expect(models).toHaveBeenCalledWith({ payload: { sessionId: 's1' } })
  })

  it('reuses the credential reference bound to the DSH OpenRouter profile', async () => {
    const resolve = vi.fn(async (ref: unknown) => ({ value: String(ref) === 'ROUTE_OPENROUTER_KEY' ? 'route-secret' : 'fallback-secret' }))
    const ctx = {
      credentials: { resolve },
      settings: { get: vi.fn(() => ({ providers: { or: { baseURL: 'https://openrouter.ai/api/v1', apiKeyEnv: 'ROUTE_OPENROUTER_KEY', models: [] } } })), mutate: vi.fn(async () => undefined) },
      apiProxy: { sessions: {
        models: vi.fn(async () => ({ result: { ok: true as const, value: { current: { provider: 'or', model: 'deepseek/deepseek-v4' } } } })),
        selectModel: vi.fn(),
      } },
      agentDefaultModel: { saveSelection: vi.fn() },
    }
    const controller = createHostController(ctx as never, () => DEFAULT_CONFIG, value => value)
    await controller.recommend('s1').catch(() => {})
    expect(resolve).toHaveBeenCalledWith('ROUTE_OPENROUTER_KEY')
  })
})
