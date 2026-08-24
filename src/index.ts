import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_CONFIG, validateConfig, type Config as ProviderConfig } from './config.js'
import { createHostController, type HostContextLike } from './host-adapter.js'
import { createProviderRoute } from './host-routes.js'
import { createProviderTools, providerToolApproval } from './tools.js'

export const name = 'openrouter-providers'
export const inject = ['tools', 'settings', 'credentials', 'agentDefaultModel', 'apiProxy', 'webServer']
export const NS = settingsNamespace('openrouter-providers')

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
  let source = () => initial
  installSettingsSection(ctx, NS, Config, initial, {
    validate: validateConfig,
    setSource: current => { source = current },
    onChange: () => {},
  })
  const host = ctx as unknown as HostContextLike & {
    tools: { register(tool: unknown): () => void }
    webServer: { register(route: { kind: 'prefix'; path: string; handler: ReturnType<typeof createProviderRoute> }): () => void }
  }
  const controller = createHostController(host, () => source(), credentialRef)
  ctx.effect(() => ctx.on('tools/pre-execute', providerToolApproval), 'openrouter-providers: approve provider switch')
  ctx.effect(() => host.webServer.register({ kind: 'prefix', path: '/api/openrouter-providers', handler: createProviderRoute(controller) }), 'openrouter-providers: host routes')
  for (const tool of createProviderTools(defineTool as unknown as (definition: Record<string, unknown>) => unknown, controller)) {
    ctx.effect(() => host.tools.register(tool), 'openrouter-providers: tool')
  }
}

export { OpenRouterProviderDirectory } from './directory.js'
