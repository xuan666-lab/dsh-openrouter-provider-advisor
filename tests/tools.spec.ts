import { describe, expect, it, vi } from 'vitest'
import { createProviderTools, providerToolApproval } from '../src/tools.js'

describe('provider tools', () => {
  it('requires native DSH approval for the state-changing switch tool', async () => {
    await expect(providerToolApproval({ name: 'switch_openrouter_provider' }, async () => ({ kind: 'allow' }))).resolves.toEqual({
      kind: 'ask', reason: '切换 OpenRouter 供应商将修改当前会话和默认模型',
    })
    await expect(providerToolApproval({ name: 'recommend_openrouter_providers' }, async () => ({ kind: 'allow' }))).resolves.toEqual({ kind: 'allow' })
    await expect(providerToolApproval({ name: 'switch_openrouter_provider' }, async () => ({ kind: 'deny', reason: 'blocked' }))).resolves.toEqual({ kind: 'deny', reason: 'blocked' })
  })
  it('registers both tools and binds current execution session', async () => {
    const controller = { models: vi.fn(), recommend: vi.fn(async () => ({ ok: true, recommended: [], rest: [] } as never)), apply: vi.fn(async () => ({ ok: true })) }
    const definitions: Array<Record<string, unknown>> = []
    createProviderTools(definition => { definitions.push(definition); return definition }, controller)
    expect(definitions.map(item => item.name)).toEqual(['recommend_openrouter_providers', 'switch_openrouter_provider'])
    await (definitions[0]!.execute as (a: unknown, e: unknown) => Promise<unknown>)({}, { agent: { session: { id: 's1' } } })
    await (definitions[1]!.execute as (a: unknown, e: unknown) => Promise<unknown>)({ tag: 'beta/fp8' }, { agent: { session: { id: 's1' } } })
    expect(controller.recommend).toHaveBeenCalledWith('s1', false, {})
    expect(controller.apply).toHaveBeenCalledWith('s1', 'beta/fp8')
  })
})
