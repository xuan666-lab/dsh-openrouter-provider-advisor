import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_CONFIG, validateConfig, type Config as ProviderConfig } from './config.js'
import { createHostController, type HostContextLike } from './host-adapter.js'
import { createProviderRoute } from './host-routes.js'
import { createProviderTools, providerToolApproval } from './tools.js'

export const name = 'openrouter-providers'
/**
 * Required host services.
 *
 * `sessionController` (Session Remote owner, provided by dsh-api-session-controller)
 * replaced the pre-0.1.2 `apiProxy` RPC service that was removed from DSH: the
 * panel now reads the shared model catalog and installs session model
 * selections directly through the Host Session business API.
 */
export const inject = ['tools', 'settings', 'credentials', 'agentDefaultModel', 'sessionController', 'webServer']

/**
 * Settings namespace this plugin owns. Registered through the current
 * `ctx.settings.register` API; the older `settingsNamespace()` helper was
 * removed in DSH 0.1.2.
 */
export const NS = 'openrouter-providers' as const

const weights = z.object({
  quantization: z.number().min(0).max(1).default(0.3),
  speed: z.number().min(0).max(1).default(0.3),
  price: z.number().min(0).max(1).default(0.3),
  context: z.number().min(0).max(1).default(0.1),
})

export const Config: z<ProviderConfig> = z.object({
  minContextTokens: z.number().step(1).min(1).default(100_000),
  cacheTtlMs: z.number().step(1).min(0).default(300_000),
  recommendedCount: z.number().step(1).min(1).max(10).default(5),
  weights,
  priceBlend: z.object({
    input: z.number().min(0).max(1).default(0.02),
    output: z.number().min(0).max(1).default(0.08),
    cache: z.number().min(0).max(1).default(0.9),
  }),
  uptimePenaltyThreshold: z.number().min(0).max(100).default(99),
  uptimePenaltyFactor: z.number().min(0).max(1).default(0.85),
})

export function apply(ctx: Context, initial: ProviderConfig = DEFAULT_CONFIG): void {
  // Current settings API (dsh >= 0.1.2): registering a namespace returns a live
  // owner scope whose resolved value layers schema defaults → composition base →
  // user section. `scope.get()` is always authoritative, so the adapter reads it
  // through a thunk instead of the removed installSettingsSection source hooks.
  // The `settings` service is not declared on the plain cordis Context type, so
  // it is typed structurally below (the dsh-settings package no longer needs to
  // be an import-time dependency of the bundle).
  const settingsHost = ctx as unknown as {
    settings: {
      register(
        ns: string,
        schema: typeof Config,
        options: { base?: Partial<ProviderConfig>; validate?: (value: ProviderConfig) => void },
      ): { get(): unknown }
    }
  }
  const scope = settingsHost.settings.register(NS, Config, { base: initial, validate: validateConfig })
  const readConfig = (): ProviderConfig => scope.get() as ProviderConfig

  const host = ctx as unknown as HostContextLike & {
    tools: { register(tool: unknown): () => void }
    webServer: { register(route: { kind: 'prefix'; path: string; handler: ReturnType<typeof createProviderRoute> }): () => void }
  }
  const controller = createHostController(host, readConfig, credentialRef)
  ctx.effect(() => ctx.on('tools/pre-execute', providerToolApproval), 'openrouter-providers: approve provider switch')
  ctx.effect(() => host.webServer.register({ kind: 'prefix', path: '/api/openrouter-providers', handler: createProviderRoute(controller) }), 'openrouter-providers: host routes')
  for (const tool of createProviderTools(defineTool as unknown as (definition: Record<string, unknown>) => unknown, controller)) {
    ctx.effect(() => host.tools.register(tool), 'openrouter-providers: tool')
  }
}

export { OpenRouterProviderDirectory } from './directory.js'
