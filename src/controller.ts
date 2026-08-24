import { applyProvider, type DshModelEntry } from './apply-provider.js'
import { configForStrategy, type Config, type RankingStrategy } from './config.js'
import { OpenRouterProviderDirectory, type RecommendationResponse } from './directory.js'
import type { OpenRouterEndpoint, OpenRouterModel } from './types.js'

export interface SessionSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface ProviderProfile {
  baseURL?: string
  apiKeyEnv?: string
  models?: DshModelEntry[]
}

export interface ProviderCredential {
  configured: boolean
  ref: string
  source: 'provider' | 'fallback'
  value?: string
}
export type ResolvedProviderCredential = ProviderCredential & { configured: true; value: string }

export interface ControllerDependencies {
  config(): Config
  credential(provider: string): Promise<ProviderCredential>
  sessionSelection(sessionId: string): Promise<SessionSelection>
  sessionDirectory(sessionId: string): Promise<{
    current: SessionSelection
    groups: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>
  }>
  providerProfile(provider: string): ProviderProfile | undefined
  providerProfiles(): Record<string, ProviderProfile>
  listModels(credential: ResolvedProviderCredential): Promise<OpenRouterModel[]>
  getEndpoints(credential: ResolvedProviderCredential, modelId: string, refresh: boolean): Promise<OpenRouterEndpoint[]>
  upsertPreset(credential: ResolvedProviderCredential, modelId: string, tag: string): Promise<{ slug: string }>
  writeModels(route: string, models: DshModelEntry[]): Promise<void>
  selectModel(selection: { sessionId: string; provider: string; model: string; reasoningEffort?: string }): Promise<void>
  saveDefault(selection: { provider: string; model: string; reasoningEffort?: string }): Promise<void>
}

interface RecommendationState {
  input: SessionSelection & { baseURL?: string }
  response: RecommendationResponse
  endpoints: OpenRouterEndpoint[]
}

export class OpenRouterProviderController {
  private readonly state = new Map<string, RecommendationState>()

  constructor(private readonly deps: ControllerDependencies) {}

  private async key(provider: string): Promise<ResolvedProviderCredential> {
    const credential = await this.deps.credential(provider)
    if (!credential.value) throw new Error(`请在 DSH 模型设置中配置 OpenRouter 凭据 ${credential.ref}`)
    return { ...credential, configured: true, value: credential.value }
  }

  async connection(): Promise<{
    ok: true
    configured: boolean
    routes: Array<{ provider: string; credentialRef: string; configured: boolean; source: 'provider' | 'fallback' }>
  }> {
    const entries = Object.entries(this.deps.providerProfiles()).filter(([, profile]) =>
      profile.baseURL?.toLowerCase().includes('openrouter.ai') === true
      || profile.models?.some(model => model.id.startsWith('@preset/')) === true)
    const routes = await Promise.all(entries.map(async ([provider]) => {
      const credential = await this.deps.credential(provider)
      return { provider, credentialRef: credential.ref, configured: credential.configured, source: credential.source }
    }))
    return { ok: true, configured: routes.some(route => route.configured), routes }
  }

  async models(sessionId: string): Promise<{
    ok: true
    credential: { configured: boolean; ref: string; source: 'provider' | 'fallback' }
    current: { provider: string; model: string }
    models: Array<{ provider: string; model: string; name: string; matchName: string; current: boolean }>
  }> {
    const directory = await this.deps.sessionDirectory(sessionId)
    const current = directory.current
    const openrouterRoutes = Object.entries(this.deps.providerProfiles()).filter(([, profile]) =>
      profile.baseURL?.toLowerCase().includes('openrouter.ai') === true
      || profile.models?.some(model => model.id.startsWith('@preset/')) === true)
    const targetProvider = openrouterRoutes.some(([provider]) => provider === current.provider)
      ? current.provider
      : openrouterRoutes[0]?.[0]
    const models = targetProvider === undefined ? [] : directory.groups.flatMap(group =>
      group.models.map(model => ({
        provider: targetProvider,
        model: model.id,
        name: model.name,
        matchName: `${group.id} ${model.name}`,
        current: group.id === current.provider && model.id === current.model,
      })))
    if (!models.some(model => model.current)) {
      const profile = this.deps.providerProfile(current.provider)
      if (profile?.baseURL?.toLowerCase().includes('openrouter.ai') || current.model.startsWith('@preset/')) {
        models.unshift({ provider: current.provider, model: current.model, name: current.model, matchName: `${current.provider} ${current.model}`, current: true })
      }
    }
    const credential = await this.deps.credential(targetProvider ?? current.provider)
    return {
      ok: true,
      credential: { configured: credential.configured, ref: credential.ref, source: credential.source },
      current: { provider: current.provider, model: current.model },
      models,
    }
  }

  async recommend(sessionId: string, refresh = false, override: { provider?: string; model?: string; name?: string; strategy?: RankingStrategy } = {}): Promise<RecommendationResponse> {
    const current = await this.deps.sessionSelection(sessionId)
    const selection = { ...current, ...override }
    const credential = await this.key(selection.provider)
    const profile = this.deps.providerProfile(selection.provider)
    const presetModel = profile?.models?.find(model => model.id === selection.model)?.openrouterModel
    const input = { ...selection, ...(profile?.baseURL === undefined ? {} : { baseURL: profile.baseURL }), ...(typeof presetModel === 'string' ? { presetModel } : {}) }
    let fetchedEndpoints: OpenRouterEndpoint[] = []
    const directory = new OpenRouterProviderDirectory({
      config: () => configForStrategy(this.deps.config(), override.strategy ?? 'balanced'),
      listModels: () => this.deps.listModels(credential),
      getEndpoints: async (modelId) => {
        fetchedEndpoints = await this.deps.getEndpoints(credential, modelId, refresh)
        return fetchedEndpoints
      },
    })
    const response = await directory.recommend(input, { refresh })
    const suffix = input.model.replace(/^@preset\//i, '').split(/[-_.·・/\s]+/u).at(-1)?.toLowerCase()
    const inferred = suffix === undefined ? [] : fetchedEndpoints.filter(endpoint => endpoint.tag.split('/')[0]?.toLowerCase() === suffix)
    if (inferred.length === 1) {
      response.currentTag = inferred[0]!.tag
      for (const row of [...response.recommended, ...response.rest]) row.current = row.tag === response.currentTag
    }
    this.state.set(sessionId, { input, response, endpoints: fetchedEndpoints })
    return response
  }

  async apply(sessionId: string, tag: string, override: { provider?: string; model?: string; name?: string; strategy?: RankingStrategy } = {}): Promise<unknown> {
    await this.recommend(sessionId, false, override)
    const state = this.state.get(sessionId)!
    const eligible = [...state.response.recommended, ...state.response.rest].find(item => item.tag === tag)
    if (!eligible) throw new Error('所选 tag 不属于该模型当前合格供应商')
    const endpoint = state.endpoints.find(item => item.tag === tag)
    if (!endpoint) throw new Error('所选 tag 的 endpoint 数据已失效，请刷新后重试')
    const profile = this.deps.providerProfile(state.input.provider)
    const credential = await this.key(state.input.provider)
    return applyProvider({
      upsertPreset: (modelId, providerTag) => this.deps.upsertPreset(credential, modelId, providerTag),
      readModels: async () => [...(profile?.models ?? [])],
      writeModels: this.deps.writeModels,
      selectModel: this.deps.selectModel,
      saveDefault: this.deps.saveDefault,
    }, {
      sessionId,
      route: state.input.provider,
      sourceModel: state.input.model,
      openrouterModel: state.response.openrouterModel,
      endpoint,
      ...(state.input.reasoningEffort === undefined ? {} : { reasoningEffort: state.input.reasoningEffort }),
    })
  }
}
