import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { settingsDisclosureLabel, setConfigField, setConfigGroup, strategyWeightRows } from '../src/client/settings-card.js'

describe('settings card updates', () => {
  it('uses accessible collapsed and expanded disclosure labels', () => {
    expect(settingsDisclosureLabel(false, 'zh-CN')).toBe('展开: OpenRouter 供应商')
    expect(settingsDisclosureLabel(true, 'zh-CN')).toBe('收起: OpenRouter 供应商')
    expect(settingsDisclosureLabel(false, 'en-US')).toBe('Expand: OpenRouter Providers')
  })

  it('explains built-in profiles separately from editable balanced weights', () => {
    expect(strategyWeightRows('zh-CN')).toEqual([
      { name: '价格优先', values: '量化 10% · 速度 10% · 价格 70% · 上下文 10%' },
      { name: '速度优先', values: '量化 15% · 速度 65% · 价格 10% · 上下文 10%' },
      { name: '上下文优先', values: '量化 15% · 速度 10% · 价格 10% · 上下文 65%' },
    ])
    expect(strategyWeightRows('en-US')[0]).toEqual({ name: 'Price first', values: 'Quality 10% · Speed 10% · Price 70% · Context 10%' })
  })

  it('writes scalar and nested groups without dropping sibling weights', async () => {
    const set = vi.fn(async () => undefined)
    await setConfigField({ set }, DEFAULT_CONFIG, 'recommendedCount', 7)
    await setConfigField({ set }, DEFAULT_CONFIG, 'weights.speed', 0.4)
    expect(set).toHaveBeenNthCalledWith(1, 'recommendedCount', 7)
    expect(set).toHaveBeenNthCalledWith(2, 'weights', { ...DEFAULT_CONFIG.weights, speed: 0.4 })
  })

  it('validates staged weight groups before writing them atomically', async () => {
    const set = vi.fn(async () => undefined)
    await expect(setConfigGroup({ set }, 'weights', { quantization: 0.4, speed: 0.3, price: 0.2, context: 0.2 })).rejects.toThrow(/sum to 1/)
    expect(set).not.toHaveBeenCalled()
    await setConfigGroup({ set }, 'weights', { quantization: 0.4, speed: 0.3, price: 0.2, context: 0.1 })
    expect(set).toHaveBeenCalledWith('weights', { quantization: 0.4, speed: 0.3, price: 0.2, context: 0.1 })
  })
})
