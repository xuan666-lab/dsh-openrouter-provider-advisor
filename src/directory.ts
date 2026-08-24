import type { Config } from './config.js'
import { resolveOpenRouterModel, type ResolveInput } from './resolve-model.js'
import { rankEndpoints } from './score.js'
import type { OpenRouterEndpoint, OpenRouterModel, RankedProvider } from './types.js'

export type DirectoryErrorCode = 'NOT_OPENROUTER' | 'MODEL_NOT_FOUND' | 'MODEL_AMBIGUOUS' | 'NO_ELIGIBLE_ENDPOINTS'

export class ProviderDirectoryError extends Error {
  constructor(message: string, public readonly code: DirectoryErrorCode, public readonly details?: unknown) {
    super(message)
    this.name = 'ProviderDirectoryError'
  }
}

export interface DirectoryInput extends ResolveInput {
  currentTag?: string
}

export interface RecommendationResponse {
  ok: true
  dsh: { provider: string; model: string }
  openrouterModel: string
  currentTag?: string
  recommended: RankedProvider[]
  rest: RankedProvider[]
}

export interface DirectoryDependencies {
  config(): Config
  listModels(): Promise<OpenRouterModel[]>
  getEndpoints(modelId: string, options?: { refresh?: boolean }): Promise<OpenRouterEndpoint[]>
}

export class OpenRouterProviderDirectory {
  constructor(private readonly deps: DirectoryDependencies) {}

  async recommend(input: DirectoryInput, options: { refresh?: boolean } = {}): Promise<RecommendationResponse> {
    const catalog = await this.deps.listModels()
    const resolved = resolveOpenRouterModel(input, catalog)
    if (resolved.kind === 'not-openrouter') throw new ProviderDirectoryError('当前模型不在 OpenRouter，无法推荐供应商', 'NOT_OPENROUTER')
    if (resolved.kind === 'not-found') throw new ProviderDirectoryError(`无法匹配 OpenRouter 模型：${resolved.normalized}`, 'MODEL_NOT_FOUND', { normalized: resolved.normalized })
    if (resolved.kind === 'ambiguous') throw new ProviderDirectoryError('无法唯一匹配 OpenRouter 模型', 'MODEL_AMBIGUOUS', { candidates: resolved.candidates.map(item => item.id) })
    const endpoints = await this.deps.getEndpoints(resolved.model.id, options)
    const ranked = rankEndpoints(endpoints, this.deps.config(), input.currentTag)
    if (ranked.recommended.length === 0) throw new ProviderDirectoryError('没有满足上下文下限的可用供应商', 'NO_ELIGIBLE_ENDPOINTS')
    return {
      ok: true,
      dsh: { provider: input.provider, model: input.model },
      openrouterModel: resolved.model.id,
      ...(input.currentTag === undefined ? {} : { currentTag: input.currentTag }),
      ...ranked,
    }
  }

  refresh(input: DirectoryInput): Promise<RecommendationResponse> {
    return this.recommend(input, { refresh: true })
  }
}
