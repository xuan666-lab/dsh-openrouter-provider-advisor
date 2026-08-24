import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { createProviderRoute } from '../src/host-routes.js'

async function call(handler: ReturnType<typeof createProviderRoute>, method: string, url: string, body?: unknown) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as never
  Object.assign(req, { method, url, headers: body === undefined ? {} : { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' } })
  let payload = ''
  const res = { statusCode: 0, setHeader: vi.fn(), end: (value: string) => { payload = value } } as never
  await handler(req, res)
  return { status: (res as { statusCode: number }).statusCode, body: JSON.parse(payload) as unknown }
}

async function rawCall(handler: ReturnType<typeof createProviderRoute>, options: { method: string; url: string; headers?: Record<string, string>; chunks?: string[] }) {
  const req = Readable.from(options.chunks ?? []) as never
  Object.assign(req, { method: options.method, url: options.url, headers: options.headers ?? {} })
  let payload = ''
  const res = { statusCode: 0, setHeader: vi.fn(), end: (value: string) => { payload = value } } as never
  await handler(req, res)
  return { status: (res as { statusCode: number }).statusCode, body: JSON.parse(payload) as unknown }
}

describe('provider host routes', () => {
  it('returns value-free OpenRouter connection status', async () => {
    const controller = { connection: vi.fn(async () => ({ ok: true, configured: true, routes: [] })), models: vi.fn(), recommend: vi.fn(), apply: vi.fn() }
    expect(await call(createProviderRoute(controller as never), 'GET', '/api/openrouter-providers/connection')).toEqual({ status: 200, body: { ok: true, configured: true, routes: [] } })
  })
  it('returns configured OpenRouter models for a session', async () => {
    const controller = { models: vi.fn(async () => ({ ok: true, current: { provider: 'or', model: 'm1' }, models: [] })), recommend: vi.fn(), apply: vi.fn() }
    expect(await call(createProviderRoute(controller as never), 'GET', '/api/openrouter-providers/models?sessionId=s1')).toMatchObject({ status: 200, body: { ok: true } })
    expect(controller.models).toHaveBeenCalledWith('s1')
  })

  it('passes an explicitly selected DSH model through recommend and refresh', async () => {
    const controller = { models: vi.fn(), recommend: vi.fn(async () => ({ ok: true } as never)), apply: vi.fn() }
    await call(createProviderRoute(controller as never), 'GET', '/api/openrouter-providers/recommend?sessionId=s1&provider=or&model=%40preset%2Fm2')
    expect(controller.recommend).toHaveBeenNthCalledWith(1, 's1', false, { provider: 'or', model: '@preset/m2' })
    await call(createProviderRoute(controller as never), 'POST', '/api/openrouter-providers/refresh', { sessionId: 's1', provider: 'or', model: '@preset/m2' })
    expect(controller.recommend).toHaveBeenNthCalledWith(2, 's1', true, { provider: 'or', model: '@preset/m2' })
  })

  it('passes a supported ranking strategy and rejects unknown values', async () => {
    const controller = { models: vi.fn(), recommend: vi.fn(async () => ({ ok: true } as never)), apply: vi.fn() }
    await call(createProviderRoute(controller as never), 'GET', '/api/openrouter-providers/recommend?sessionId=s1&strategy=price')
    expect(controller.recommend).toHaveBeenCalledWith('s1', false, { strategy: 'price' })
    expect(await call(createProviderRoute(controller as never), 'GET', '/api/openrouter-providers/recommend?sessionId=s1&strategy=unknown')).toMatchObject({ status: 400, body: { ok: false } })
  })

  it('rejects cross-origin and oversized mutation requests before dispatch', async () => {
    const controller = { connection: vi.fn(), models: vi.fn(), recommend: vi.fn(), apply: vi.fn() }
    const handler = createProviderRoute(controller as never)
    await expect(rawCall(handler, { method: 'POST', url: '/api/openrouter-providers/apply', headers: { host: 'localhost:1234', origin: 'https://evil.example', 'content-type': 'application/json' }, chunks: ['{}'] })).resolves.toMatchObject({ status: 403 })
    await expect(rawCall(handler, { method: 'POST', url: '/api/openrouter-providers/apply', headers: { host: 'localhost:1234', origin: 'http://localhost:1234', 'content-type': 'application/json' }, chunks: ['x'.repeat(65 * 1024)] })).resolves.toMatchObject({ status: 413 })
    expect(controller.apply).not.toHaveBeenCalled()
  })
})
