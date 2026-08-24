import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RankingStrategy } from './config.js'
import type { RecommendationResponse } from './directory.js'

export interface ProviderHostController {
  connection(): Promise<unknown>
  models(sessionId: string): Promise<unknown>
  recommend(sessionId: string, refresh?: boolean, override?: { provider?: string; model?: string; name?: string; strategy?: RankingStrategy }): Promise<RecommendationResponse>
  apply(sessionId: string, tag: string, override?: { provider?: string; model?: string; name?: string; strategy?: RankingStrategy }): Promise<unknown>
}

const STRATEGIES = new Set<RankingStrategy>(['balanced', 'price', 'speed', 'context'])
const MAX_BODY_BYTES = 64 * 1024

class RouteError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

function strategyOf(value: unknown): RankingStrategy | undefined {
  return typeof value === 'string' && STRATEGIES.has(value as RankingStrategy) ? value as RankingStrategy : undefined
}

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > MAX_BODY_BYTES) throw new RouteError('request body is too large', 413)
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function assertMutationRequest(req: IncomingMessage): void {
  const contentType = header(req, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new RouteError('content-type must be application/json', 415)
  const origin = header(req, 'origin')
  const host = header(req, 'host')
  if (origin) {
    let originHost: string
    try { originHost = new URL(origin).host } catch { throw new RouteError('cross-origin mutation is forbidden', 403) }
    if (!host || originHost !== host) throw new RouteError('cross-origin mutation is forbidden', 403)
  }
  const declared = Number(header(req, 'content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new RouteError('request body is too large', 413)
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export function createProviderRoute(controller: ProviderHostController) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname.replace(/^\/api\/openrouter-providers/, '') || '/'
      if (req.method === 'GET' && path === '/connection') return send(res, 200, await controller.connection())
      if (req.method === 'GET' && path === '/models') {
        const sessionId = url.searchParams.get('sessionId')
        if (!sessionId) return send(res, 400, { ok: false, error: 'sessionId is required' })
        return send(res, 200, await controller.models(sessionId))
      }
      if (req.method === 'GET' && path === '/recommend') {
        const sessionId = url.searchParams.get('sessionId')
        if (!sessionId) return send(res, 400, { ok: false, error: 'sessionId is required' })
        const provider = url.searchParams.get('provider') ?? undefined
        const model = url.searchParams.get('model') ?? undefined
        const name = url.searchParams.get('name') ?? undefined
        const rawStrategy = url.searchParams.get('strategy') ?? undefined
        const strategy = strategyOf(rawStrategy)
        if (rawStrategy !== undefined && strategy === undefined) return send(res, 400, { ok: false, error: 'unknown ranking strategy' })
        return send(res, 200, await controller.recommend(sessionId, false, { ...(provider ? { provider } : {}), ...(model ? { model } : {}), ...(name ? { name } : {}), ...(strategy ? { strategy } : {}) }))
      }
      if (req.method === 'POST' && (path === '/refresh' || path === '/apply')) {
        assertMutationRequest(req)
        const body = await bodyOf(req) as { sessionId?: unknown; tag?: unknown; provider?: unknown; model?: unknown; name?: unknown; strategy?: unknown }
        if (typeof body.sessionId !== 'string' || !body.sessionId) return send(res, 400, { ok: false, error: 'sessionId is required' })
        const strategy = strategyOf(body.strategy)
        if (body.strategy !== undefined && strategy === undefined) return send(res, 400, { ok: false, error: 'unknown ranking strategy' })
        const override = { ...(typeof body.provider === 'string' && body.provider ? { provider: body.provider } : {}), ...(typeof body.model === 'string' && body.model ? { model: body.model } : {}), ...(typeof body.name === 'string' && body.name ? { name: body.name } : {}), ...(strategy ? { strategy } : {}) }
        if (path === '/refresh') return send(res, 200, await controller.recommend(body.sessionId, true, override))
        if (typeof body.tag !== 'string' || !body.tag) return send(res, 400, { ok: false, error: 'tag is required' })
        return send(res, 200, await controller.apply(body.sessionId, body.tag, override))
      }
      send(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      send(res, error instanceof RouteError ? error.status : 502, { ok: false, error: message })
    }
  }
}
