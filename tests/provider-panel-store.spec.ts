import { describe, expect, it, vi } from 'vitest'
import { createProviderPanelStore } from '../src/client/provider-panel-store.js'

const recommendation = {
  ok: true as const,
  dsh: { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra' },
  openrouterModel: 'deepseek/deepseek-v4',
  currentTag: 'deepinfra/fp8',
  recommended: [{ rank: 1, score: 88, tag: 'coreweave/fp8', providerName: 'CoreWeave', quantization: 'fp8', tps: 101, latency: 1, price: { input: 0.13, output: 0.28, cache: 0.07 }, contextLength: 262144, uptime: 99.9, current: false, reasons: ['fp8'], dimensions: { quantization: 80, speed: 100, price: 80, context: 17 } }],
  rest: [],
}
const modelCatalog = {
  ok: true as const,
  credential: { configured: true, ref: 'DSH_OPENROUTER_KEY', source: 'provider' as const },
  current: { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra' },
  models: [
    { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra', name: 'DeepSeek V4 · DeepInfra', matchName: 'deepseek DeepSeek V4 · DeepInfra', current: true },
    { provider: 'openrouter-main', model: '@preset/deepseek-v4-pro-deepinfra', name: 'DeepSeek V4 Pro · DeepInfra', matchName: 'deepseek DeepSeek V4 Pro · DeepInfra', current: false },
  ],
}

describe('ProviderPanelStore', () => {
  it('opens without requesting recommendations when the DSH OpenRouter credential is missing', async () => {
    const missing = { ...modelCatalog, credential: { configured: false, ref: 'DSH_OPENROUTER_KEY', source: 'provider' as const } }
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(missing), { status: 200 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toMatchObject({ open: true, status: 'ready', credential: missing.credential, data: null })
  })
  it('opens and loads recommendations for the active session', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async input => new Response(JSON.stringify(String(input).includes('/models') ? modelCatalog : recommendation), { status: 200 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    expect(store.getSnapshot()).toMatchObject({ open: true, status: 'ready', sessionId: 's1', strategy: 'balanced', data: recommendation, models: modelCatalog.models, selected: modelCatalog.current, error: null })
    expect(String(fetch.mock.calls[0]![0])).toContain('/models?sessionId=s1')
  })

  it('refreshes through POST /refresh', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(recommendation), { status: 200 }))
    const store = createProviderPanelStore(fetch)
    await store.refresh('s1')
    expect(fetch.mock.calls[0]![0]).toBe('/api/openrouter-providers/refresh')
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ sessionId: 's1', strategy: 'balanced' })
  })

  it('keeps the last recommendations visible when a manual refresh fails', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(modelCatalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recommendation), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'temporary outage' }), { status: 502 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    await expect(store.refresh('s1')).rejects.toThrow('temporary outage')
    expect(store.getSnapshot()).toMatchObject({ open: true, status: 'error', data: recommendation, error: 'temporary outage' })
  })

  it('applies an opaque tag and keeps the panel open with updated current state', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(modelCatalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recommendation), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    await store.apply('s1', 'coreweave/fp8')
    expect(JSON.parse(String(fetch.mock.calls[2]![1]?.body))).toEqual({ sessionId: 's1', tag: 'coreweave/fp8', ...modelCatalog.current, name: 'deepseek DeepSeek V4 · DeepInfra', strategy: 'balanced' })
    expect(store.getSnapshot()).toMatchObject({ open: true, status: 'ready', applyingTag: null, successTag: 'coreweave/fp8', data: { currentTag: 'coreweave/fp8' }, error: null })
    expect(store.getSnapshot().previousTag).toBe('deepinfra/fp8')
    expect(store.getSnapshot().data?.recommended[0]?.current).toBe(true)
  })

  it('keeps the panel open and exposes apply failures', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(modelCatalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recommendation), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'preset failed' }), { status: 502 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    await expect(store.apply('s1', 'coreweave/fp8')).rejects.toThrow('preset failed')
    expect(store.getSnapshot()).toMatchObject({ open: true, status: 'error', error: 'preset failed' })
  })

  it('clears stale recommendations when reopening or when a new load fails', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(modelCatalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recommendation), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(modelCatalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: '无法唯一匹配 OpenRouter 模型' }), { status: 502 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    store.close()
    await store.open('s1')
    expect(store.getSnapshot()).toMatchObject({ open: true, status: 'error', data: null, error: '无法唯一匹配 OpenRouter 模型' })
  })

  it('reloads recommendations for another configured DSH model without applying it', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(modelCatalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recommendation), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...recommendation, openrouterModel: 'deepseek/deepseek-v4-pro' }), { status: 200 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    await store.selectModel('s1', 'openrouter-main', '@preset/deepseek-v4-pro-deepinfra', 'deepseek DeepSeek V4 Pro · DeepInfra')
    expect(String(fetch.mock.calls[2]![0])).toContain('provider=openrouter-main')
    expect(String(fetch.mock.calls[2]![0])).toContain('model=%40preset%2Fdeepseek-v4-pro-deepinfra')
    expect(store.getSnapshot()).toMatchObject({ selected: { provider: 'openrouter-main', model: '@preset/deepseek-v4-pro-deepinfra', name: 'deepseek DeepSeek V4 Pro · DeepInfra' }, data: { openrouterModel: 'deepseek/deepseek-v4-pro' } })
  })

  it('defaults to balanced, reloads for a selected strategy, and keeps it across close and reopen', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async input => new Response(JSON.stringify(String(input).includes('/models') ? modelCatalog : recommendation), { status: 200 }))
    const store = createProviderPanelStore(fetch)
    await store.open('s1')
    expect(store.getSnapshot().strategy).toBe('balanced')
    await store.setStrategy('s1', 'price')
    expect(String(fetch.mock.calls[2]![0])).toContain('strategy=price')
    expect(store.getSnapshot().strategy).toBe('price')
    store.close()
    expect(store.getSnapshot().strategy).toBe('price')
    await store.open('s1')
    expect(String(fetch.mock.calls[4]![0])).toContain('strategy=price')
  })

  it('persists the preferred strategy so a fresh store restores it', async () => {
    const backing = new Map<string, string>()
    const storage = { getItem: (key: string) => backing.get(key) ?? null, setItem: (key: string, value: string) => void backing.set(key, value) }
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(recommendation), { status: 200 }))
    const store = createProviderPanelStore(fetch, storage)
    await store.setStrategy('s1', 'speed')
    expect(createProviderPanelStore(fetch, storage).getSnapshot().strategy).toBe('speed')
  })

  it('records a switch history entry with provider names and throughput, persisted to storage', async () => {
    const backing = new Map<string, string>()
    const storage = { getItem: (key: string) => backing.get(key) ?? null, setItem: (key: string, value: string) => void backing.set(key, value) }
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(modelCatalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...recommendation, rest: [{ ...recommendation.recommended[0], rank: 2, tag: 'deepinfra/fp8', providerName: 'DeepInfra', tps: 86, current: true }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const store = createProviderPanelStore(fetch, storage)
    await store.open('s1')
    await store.apply('s1', 'coreweave/fp8')
    const entry = store.getSnapshot().history[0]
    expect(entry).toMatchObject({ model: 'deepseek/deepseek-v4', fromTag: 'deepinfra/fp8', fromName: 'DeepInfra', fromTps: 86, toTag: 'coreweave/fp8', toName: 'CoreWeave', toTps: 101 })
    const restored = createProviderPanelStore(fetch, storage)
    expect(restored.getSnapshot().history[0]).toMatchObject({ toTag: 'coreweave/fp8' })
  })
})
