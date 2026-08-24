import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachLocale, createI18n, getLocaleSnapshot, normalizeLocale, subscribeLocale } from '../src/client/i18n.js'

afterEach(() => attachLocale(undefined))

describe('client i18n', () => {
  it('normalizes Chinese variants to zh-CN and everything else to en-US', () => {
    expect(normalizeLocale('zh')).toBe('zh-CN')
    expect(normalizeLocale('zh-TW')).toBe('zh-CN')
    expect(normalizeLocale('en')).toBe('en-US')
    expect(normalizeLocale(undefined)).toBe('en-US')
  })

  it('translates shared UI copy for both supported locales', () => {
    expect(createI18n('zh-CN').t('panel.title')).toBe('OpenRouter 供应商')
    expect(createI18n('en-US').t('panel.title')).toBe('OpenRouter Providers')
    expect(createI18n('zh-CN').t('settings.summary')).toContain('推荐数量')
    expect(createI18n('en-US').t('settings.summary')).toContain('ranking weights')
    expect(createI18n('zh-CN').t('settings.group.weights.scope')).toContain('仅影响“综合最佳”')
    expect(createI18n('en-US').t('settings.group.priceBlend.scope')).toContain('all ranking strategies')
    expect(createI18n('zh-CN').t('settings.connection.configured')).toContain('已复用 DSH')
    expect(createI18n('en-US').t('panel.credentialMissing', { ref: 'OR_KEY' })).toContain('OR_KEY')
    expect(createI18n('zh-CN').t('panel.switchHint')).toContain('实时切换')
    expect(createI18n('zh-CN').t('panel.uptime')).toBe('可用率')
    expect(createI18n('zh-CN').t('panel.uptimeDelayHint')).toContain('检测延迟')
  })

  it('uses and subscribes to the official DSH locale service', () => {
    const listener = vi.fn()
    const off = vi.fn()
    const service = {
      getSnapshot: () => ({ active: 'zh' }),
      subscribe: vi.fn(() => off),
    }
    attachLocale(service)

    expect(getLocaleSnapshot()).toBe('zh-CN')
    expect(createI18n(getLocaleSnapshot()).t('panel.refresh')).toBe('刷新')
    expect(subscribeLocale(listener)).toBe(off)
    expect(service.subscribe).toHaveBeenCalledWith(listener)
  })
})
