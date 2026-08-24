import { describe, expect, it, vi } from 'vitest'
import { OpenRouterClient, OpenRouterError } from '../src/openrouter.js'
import { endpoints } from './fixtures/endpoints.js'

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('OpenRouterClient', () => {
  it('adds a bounded timeout signal to upstream requests', async () => {
    let signal: AbortSignal | null | undefined
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    await new OpenRouterClient({ apiKey: 'secret', fetch: fetch as typeof globalThis.fetch }).listModels()
    expect(signal).toBeInstanceOf(AbortSignal)
  })
  it('caches the OpenRouter model catalog for the configured TTL', async () => {
    const models = [{ id: 'deepseek/deepseek-v4', name: 'DeepSeek V4' }]
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => response({ data: models }))
    const client = new OpenRouterClient({ apiKey: 'secret', fetch, cacheTtlMs: 300_000 })
    expect(await client.listModels()).toEqual(models)
    expect(await client.listModels()).toEqual(models)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fetches endpoint API with bearer auth and caches by model', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => response({ data: { endpoints } }))
    const client = new OpenRouterClient({ apiKey: 'secret', fetch, cacheTtlMs: 300_000 })
    expect(await client.getEndpoints('deepseek/deepseek-v4')).toEqual(endpoints)
    expect(await client.getEndpoints('deepseek/deepseek-v4')).toEqual(endpoints)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]![0]).toBe('https://openrouter.ai/api/v1/models/deepseek/deepseek-v4/endpoints')
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get('authorization')).toBe('Bearer secret')
  })

  it('forces refresh and falls back to stale cached endpoints on upstream failure', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(response({ data: { endpoints } }))
      .mockResolvedValueOnce(response({ error: { message: 'busy' } }, 503))
    const client = new OpenRouterClient({ apiKey: 'secret', fetch, cacheTtlMs: 0 })
    await client.getEndpoints('deepseek/deepseek-v4')
    expect(await client.getEndpoints('deepseek/deepseek-v4', { refresh: true })).toEqual(endpoints)
  })

  it('creates a provider-pinned preset with a deterministic slug', async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => response({ id: 'preset' }))
    const client = new OpenRouterClient({ apiKey: 'secret', fetch })
    const result = await client.upsertPreset('deepseek/deepseek-v4-flash-0731', 'coreweave/fp8')
    expect(result.slug).toBe('deepseek-v4-flash-0731-coreweave')
    expect(fetch.mock.calls[0]![0]).toContain('/presets/deepseek-v4-flash-0731-coreweave/chat/completions')
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toMatchObject({
      model: 'deepseek/deepseek-v4-flash-0731',
      provider: { order: ['coreweave/fp8'], allow_fallbacks: false },
    })
  })

  it('reports a structured error when no stale cache exists', async () => {
    const client = new OpenRouterClient({ apiKey: 'secret', fetch: async () => response({ error: { message: 'bad key' } }, 401) })
    await expect(client.getEndpoints('deepseek/model')).rejects.toMatchObject({ status: 401 } satisfies Partial<OpenRouterError>)
  })
})
