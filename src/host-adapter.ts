import type { Config } from './config.js'
import { OpenRouterProviderController, type ControllerDependencies, type ProviderProfile, type ResolvedProviderCredential, type SessionSelection } from './controller.js'
import { OpenRouterClient } from './openrouter.js'

interface RpcResult<T> { result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } } }

export interface HostContextLike {
  credentials: { resolve(ref: unknown): Promise<{ value: string } | undefined> }
  settings: {
    get(ns: unknown): unknown
    mutate(ns: unknown, ops: Array<{ op: 'set'; path: string[]; value: unknown }>): Promise<void>
  }
  apiProxy: {
    sessions: {
      models(input: { payload: { sessionId: string } }): Promise<RpcResult<{
        current: SessionSelection
        groups?: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>
      }>>
      selectModel(input: { payload: { sessionId: string; provider: string; model: string; reasoningEffort?: string } }): Promise<RpcResult<{ selected: SessionSelection }>>
    }
  }
  agentDefaultModel: { saveSelection(selection: Omit<SessionSelection, never>): Promise<void> }
}

function unwrap<T>(operation: string, response: RpcResult<T>): T {
  if (!response.result.ok) throw new Error(`${operation} failed: ${response.result.error.code}: ${response.result.error.message}`)
  return response.result.value
}

interface PiConfig { providers?: Record<string, ProviderProfile> }

export function createHostController(ctx: HostContextLike, config: () => Config, credentialRef: (name: string) => unknown): OpenRouterProviderController {
  const clients = new Map<string, { value: string; client: OpenRouterClient }>()
  const client = (credential: ResolvedProviderCredential): OpenRouterClient => {
    let found = clients.get(credential.ref)
    if (!found || found.value !== credential.value) {
      found = { value: credential.value, client: new OpenRouterClient({ apiKey: credential.value, cacheTtlMs: config().cacheTtlMs }) }
      clients.set(credential.ref, found)
    }
    return found.client
  }
  const profiles = (): Record<string, ProviderProfile> => (ctx.settings.get('llm-pi-ai' as never) as PiConfig | undefined)?.providers ?? {}
  const fallbackRef = 'OPENROUTER_API_KEY'
  const deps: ControllerDependencies = {
    config,
    credential: async provider => {
      const providerRef = profiles()[provider]?.apiKeyEnv
      if (providerRef !== undefined) {
        const configured = await ctx.credentials.resolve(credentialRef(providerRef))
        if (configured?.value) return { configured: true, ref: providerRef, value: configured.value, source: 'provider' }
      }
      const fallback = await ctx.credentials.resolve(credentialRef(fallbackRef))
      if (fallback?.value) return { configured: true, ref: fallbackRef, value: fallback.value, source: 'fallback' }
      return { configured: false, ref: providerRef ?? fallbackRef, source: providerRef === undefined ? 'fallback' : 'provider' }
    },
    sessionSelection: async sessionId => unwrap('session.models', await ctx.apiProxy.sessions.models({ payload: { sessionId } })).current,
    sessionDirectory: async sessionId => {
      const value = unwrap('session.models', await ctx.apiProxy.sessions.models({ payload: { sessionId } }))
      return { current: value.current, groups: value.groups ?? [] }
    },
    providerProfile: provider => profiles()[provider],
    providerProfiles: profiles,
    listModels: credential => client(credential).listModels(),
    getEndpoints: (credential, modelId, refresh) => client(credential).getEndpoints(modelId, { refresh }),
    upsertPreset: (credential, modelId, tag) => client(credential).upsertPreset(modelId, tag),
    writeModels: async (route, models) => ctx.settings.mutate('llm-pi-ai' as never, [{ op: 'set', path: ['providers', route, 'models'], value: models }]),
    selectModel: async selection => { unwrap('session.selectModel', await ctx.apiProxy.sessions.selectModel({ payload: selection })) },
    saveDefault: selection => ctx.agentDefaultModel.saveSelection(selection),
  }
  return new OpenRouterProviderController(deps)
}
