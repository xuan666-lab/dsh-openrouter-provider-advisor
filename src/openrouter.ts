import type { OpenRouterEndpoint, OpenRouterModel } from './types.js'

const BASE_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterError extends Error {
  constructor(message: string, public readonly status: number, public readonly body?: unknown) {
    super(message)
    this.name = 'OpenRouterError'
  }
}

interface CacheEntry {
  fetchedAt: number
  endpoints: OpenRouterEndpoint[]
}

export interface OpenRouterClientOptions {
  apiKey: string
  fetch?: typeof globalThis.fetch
  cacheTtlMs?: number
  now?: () => number
  baseURL?: string
}

export class OpenRouterClient {
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly cache = new Map<string, CacheEntry>()
  private modelCatalogCache: { fetchedAt: number; models: OpenRouterModel[] } | undefined
  private readonly ttl: number
  private readonly now: () => number
  private readonly baseURL: string

  constructor(private readonly options: OpenRouterClientOptions) {
    if (!options.apiKey) throw new Error('请配置 OPENROUTER_API_KEY')
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.ttl = options.cacheTtlMs ?? 300_000
    this.now = options.now ?? Date.now
    this.baseURL = (options.baseURL ?? BASE_URL).replace(/\/$/, '')
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const timeout = AbortSignal.timeout(init?.method === 'POST' ? 30_000 : 15_000)
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    const response = await this.fetchImpl(`${this.baseURL}${path}`, {
      ...init,
      signal,
      headers: { authorization: `Bearer ${this.options.apiKey}`, 'content-type': 'application/json', ...init?.headers },
    })
    const body = await response.json().catch(() => undefined)
    if (!response.ok) {
      const upstream = body && typeof body === 'object' && 'error' in body ? (body as { error?: { message?: string } }).error?.message : undefined
      throw new OpenRouterError(upstream ?? `OpenRouter request failed with HTTP ${response.status}`, response.status, body)
    }
    return body
  }

  async listModels(): Promise<OpenRouterModel[]> {
    const cached = this.modelCatalogCache
    if (cached && this.now() - cached.fetchedAt < this.ttl) return cached.models
    try {
      const body = await this.request('/models') as { data?: unknown }
      if (!Array.isArray(body?.data)) throw new OpenRouterError('OpenRouter models response is malformed', 502, body)
      const models = body.data.filter((item): item is OpenRouterModel => Boolean(item && typeof item === 'object' && typeof (item as OpenRouterModel).id === 'string' && typeof (item as OpenRouterModel).name === 'string'))
      this.modelCatalogCache = { fetchedAt: this.now(), models }
      return models
    } catch (error) {
      if (cached) return cached.models
      throw error
    }
  }

  async getEndpoints(modelId: string, options: { refresh?: boolean } = {}): Promise<OpenRouterEndpoint[]> {
    const cached = this.cache.get(modelId)
    if (!options.refresh && cached && this.now() - cached.fetchedAt < this.ttl) return cached.endpoints
    try {
      const encoded = modelId.split('/').map(encodeURIComponent).join('/')
      const body = await this.request(`/models/${encoded}/endpoints`) as { data?: { endpoints?: unknown } | unknown[] }
      const candidate = Array.isArray(body?.data) ? body.data : body?.data?.endpoints
      if (!Array.isArray(candidate)) throw new OpenRouterError('OpenRouter endpoints response is malformed', 502, body)
      const endpoints = candidate as OpenRouterEndpoint[]
      this.cache.set(modelId, { fetchedAt: this.now(), endpoints })
      return endpoints
    } catch (error) {
      if (cached) return cached.endpoints
      throw error
    }
  }

  clearEndpoints(modelId: string): void {
    this.cache.delete(modelId)
  }

  async upsertPreset(modelId: string, tag: string): Promise<{ slug: string; response: unknown }> {
    const modelSlug = modelId.split('/').at(-1)
    const provider = tag.split('/')[0]
    if (!modelSlug || !provider) throw new Error('modelId and tag must contain non-empty slugs')
    const slug = `${modelSlug}-${provider}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    const response = await this.request(`/presets/${encodeURIComponent(slug)}/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: modelId,
        provider: { order: [tag], allow_fallbacks: false },
        messages: [{ role: 'user', content: '' }],
      }),
    })
    return { slug, response }
  }
}
