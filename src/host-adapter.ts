import type { Config } from './config.js'
import { OpenRouterProviderController, type ControllerDependencies, type ProviderProfile, type ResolvedProviderCredential, type SessionSelection } from './controller.js'
import { OpenRouterClient } from './openrouter.js'

/**
 * Session model catalog surfaced by `ctx.sessionController.modelCatalog()`
 * (structural subset — the full wire type carries more fields).
 */
interface SessionModelCatalog {
  default: SessionSelection
  groups?: Array<{
    id: string
    name: string
    models: Array<{ id: string; name: string; contextWindow?: number; [key: string]: unknown }>
  }>
}

export interface HostContextLike {
  credentials: { resolve(ref: unknown): Promise<{ value: string } | undefined> }
  settings: {
    get(ns: unknown): unknown
    mutate(ns: unknown, ops: Array<{ op: 'set'; path: string[]; value: unknown }>): Promise<void>
  }
  /**
   * Host Session business API (dsh >= 0.1.2, provided by dsh-api-session-controller).
   * Replaces the removed `apiProxy` RPC service: catalog reads and session model
   * selections now go through this in-process service instead of an HTTP remote.
   */
  sessionController: {
    modelCatalog(): Promise<SessionModelCatalog>
    selectModel(request: { sessionId: string; provider: string; model: string; reasoningEffort?: string }): Promise<unknown>
  }
  agentDefaultModel: { saveSelection(selection: SessionSelection): Promise<void> }
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
  const catalog = async (): Promise<SessionModelCatalog> => ctx.sessionController.modelCatalog()
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
    // The Host catalog reports the deployment default selection and every
    // routable provider group. Per-session model overrides live in the
    // session projection layer (client-driven); the panel resolves the exact
    // per-session model on the client through the same model directory the
    // composer uses, then passes an explicit provider/model override down.
    sessionSelection: async () => (await catalog()).default,
    sessionDirectory: async () => {
      const value = await catalog()
      return { current: value.default, groups: value.groups ?? [] }
    },
    providerProfile: provider => profiles()[provider],
    providerProfiles: profiles,
    listModels: credential => client(credential).listModels(),
    getEndpoints: (credential, modelId, refresh) => client(credential).getEndpoints(modelId, { refresh }),
    upsertPreset: (credential, modelId, tag) => client(credential).upsertPreset(modelId, tag),
    writeModels: async (route, models) => ctx.settings.mutate('llm-pi-ai' as never, [{ op: 'set', path: ['providers', route, 'models'], value: models }]),
    selectModel: async selection => { await ctx.sessionController.selectModel(selection) },
    saveDefault: selection => ctx.agentDefaultModel.saveSelection(selection),
  }
  return new OpenRouterProviderController(deps)
}
