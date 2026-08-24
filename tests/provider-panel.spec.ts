import { describe, expect, it } from 'vitest'
import { providerRows, providerTableColumns, providerTriggerLayout, providerTriggerState, providerInsight, STRATEGY_OPTIONS } from '../src/client/provider-panel.js'
import { createI18n } from '../src/client/i18n.js'
import type { RecommendationResponse } from '../src/directory.js'

const base = { rank: 1, score: 88, providerName: 'CoreWeave', tag: 'coreweave/fp8', quantization: 'fp8', tps: 101, latency: 1, price: { input: 0.13, output: 0.28, cache: 0.07 }, contextLength: 262144, uptime: 99.9, current: false, reasons: ['fp8'], dimensions: { quantization: 80, speed: 100, price: 80, context: 17 } }
const data: RecommendationResponse = {
  ok: true,
  dsh: { provider: 'openrouter-main', model: '@preset/deepseek-v4-deepinfra' },
  openrouterModel: 'deepseek/deepseek-v4',
  currentTag: 'deepinfra/fp8',
  recommended: [base],
  rest: [{ ...base, rank: 2, providerName: 'DeepInfra', tag: 'deepinfra/fp8', current: true }],
}

describe('provider panel view models', () => {
  it('groups recommended and remaining rows with current state', () => {
    const i18n = createI18n('zh-CN')
    expect(providerRows(data, i18n)).toEqual([
      expect.objectContaining({ group: '推荐 Top 5', tag: 'coreweave/fp8', current: false }),
      expect.objectContaining({ group: '其他合格供应商', tag: 'deepinfra/fp8', current: true }),
    ])
  })

  it('switches group labels and current badge with locale', () => {
    const i18n = createI18n('en-US')
    expect(providerRows(data, i18n)).toEqual([
      expect.objectContaining({ group: 'Top 5 Recommendations', scoreLabel: '88.0' }),
      expect.objectContaining({ group: 'Other Eligible Providers', scoreLabel: 'Current · 88.0', detail: expect.stringContaining('99.90% uptime') }),
    ])
  })

  it('exposes localized table columns for the provider list header', () => {
    expect(providerTableColumns(createI18n('zh-CN'))).toEqual(['供应商', '规格详情', '分数'])
    expect(providerTableColumns(createI18n('en-US'))).toEqual(['Provider', 'Specs & Performance', 'Score'])
  })

  it('disables the trigger without an ordinary current session', () => {
    expect(providerTriggerState({ current: undefined, currentAddress: undefined })).toEqual({ sessionId: null, disabled: true })
    expect(providerTriggerState({ current: 's1', currentAddress: { parentSessionId: 'p', childSessionId: 's1' } })).toEqual({ sessionId: null, disabled: true })
    expect(providerTriggerState({ current: 's1', currentAddress: undefined })).toEqual({ sessionId: 's1', disabled: false })
  })

  it('uses a full second footer row when the sidebar is wide', () => {
    expect(providerTriggerLayout(true)).toMatchObject({ flex: '1 0 100%', width: '100%', whiteSpace: 'nowrap' })
    expect(providerTriggerLayout(false)).toMatchObject({ flex: '0 0 36px', width: 36 })
  })

  it('orders balanced first followed by the three priority presets', () => {
    expect(STRATEGY_OPTIONS.map(item => [item.id, item.labelKey])).toEqual([
      ['balanced', 'panel.strategy.balanced'],
      ['price', 'panel.strategy.price'],
      ['speed', 'panel.strategy.speed'],
      ['context', 'panel.strategy.context'],
    ])
  })

  it('explains the strongest ranking dimension and exposes score breakdown', () => {
    const insight = providerInsight(base, createI18n('zh-CN'))
    expect(insight.badge).toBe('速度突出')
    expect(insight.breakdown).toContain('量化 80')
    expect(insight.breakdown).toContain('速度 100')
    expect(insight.breakdown).toContain('价格 80')
    expect(insight.breakdown).toContain('上下文 17')
  })
})
