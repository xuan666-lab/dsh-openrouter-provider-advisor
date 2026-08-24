import type { RecommendationResponse } from './directory.js'
import type { ProviderHostController } from './host-routes.js'

type DefineTool = (definition: Record<string, unknown>) => unknown
type PreToolDecision = { kind: 'allow' } | { kind: 'deny'; reason: string } | { kind: 'ask'; reason?: string }

const recommendationSchema = { type: 'object', additionalProperties: true } as const

export async function providerToolApproval(exec: { name: string }, next: () => Promise<PreToolDecision>): Promise<PreToolDecision> {
  const downstream = await next()
  if (downstream.kind !== 'allow' || exec.name !== 'switch_openrouter_provider') return downstream
  return { kind: 'ask', reason: '切换 OpenRouter 供应商将修改当前会话和默认模型' }
}

export function createProviderTools(defineTool: DefineTool, controller: Pick<ProviderHostController, 'recommend' | 'apply'>): unknown[] {
  return [
    defineTool({
      name: 'recommend_openrouter_providers',
      description: 'Recommend ranked OpenRouter upstream providers for the current DSH model.',
      parameters: {
        provider: { type: 'string', description: 'Optional DSH provider route; defaults to current session' },
        model: { type: 'string', description: 'Optional DSH model id; defaults to current session' },
      },
      output: {
        schema: recommendationSchema,
        render: (_args: unknown, value: RecommendationResponse) => [{
          type: 'text',
          text: value.recommended.map(item => `${item.rank}. ${item.providerName} · ${item.quantization} · ${item.tps} t/s · score ${item.score}`).join('\n'),
        }],
      },
      execute: async (args: { provider?: string; model?: string }, exec: { agent?: { session?: { id?: string } } }) => {
        const sessionId = exec.agent?.session?.id
        if (!sessionId) throw new Error('工具执行上下文没有当前会话')
        return controller.recommend(sessionId, false, args)
      },
    }),
    defineTool({
      name: 'switch_openrouter_provider',
      description: 'Switch the current DSH session and default model to one eligible OpenRouter provider tag.',
      parameters: {
        tag: { type: 'string', required: true, description: 'Eligible OpenRouter endpoint tag' },
        sessionId: { type: 'string', description: 'Optional target session id; defaults to current session' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args: unknown, value: { provider: string; model: string; tag: string }) => [{ type: 'text', text: `已切换到 ${value.tag}（${value.provider}/${value.model}）` }],
      },
      execute: async (args: { tag: string; sessionId?: string }, exec: { agent?: { session?: { id?: string } } }) => {
        const sessionId = args.sessionId ?? exec.agent?.session?.id
        if (!sessionId) throw new Error('工具执行上下文没有当前会话')
        return controller.apply(sessionId, args.tag)
      },
    }),
  ]
}
