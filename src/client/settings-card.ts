import { createElement, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { DEFAULT_CONFIG, STRATEGY_WEIGHTS, type Config } from '../config.js'
import { createI18n, useUiI18n } from './i18n.js'
import { WeightGroup, type WeightItem } from './weight-group.js'

export interface SettingsScopeLike {
  getSnapshot(): { status: string; value?: Config; writable: boolean }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

interface ConnectionResponse {
  ok: true
  configured: boolean
  routes: Array<{ provider: string; credentialRef: string; configured: boolean; source: 'provider' | 'fallback' }>
}

function ConnectionStatus({ t }: { t: ReturnType<typeof createI18n>['t'] }): ReactNode {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; value?: ConnectionResponse }>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/openrouter-providers/connection', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setState({ status: 'ready', value: await response.json() as ConnectionResponse })
      })
      .catch(error => { if (!controller.signal.aborted) setState({ status: 'error' }) })
    return () => controller.abort()
  }, [])
  const configured = state.value?.configured === true
  const label = state.status === 'loading'
    ? t('settings.connection.loading')
    : state.status === 'error'
      ? t('settings.connection.error')
      : t(configured ? 'settings.connection.configured' : 'settings.connection.missing')
  const color = configured ? '#22c55e' : state.status === 'error' ? '#f59e0b' : '#f97316'
  return createElement('section', { style: { display: 'grid', gap: 8, padding: 14, borderRadius: 10, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` } },
    createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
      createElement('span', { 'aria-hidden': true, style: { width: 8, height: 8, borderRadius: 99, background: color, boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 15%, transparent)` } }),
      createElement('strong', { style: { fontSize: 13 } }, t('settings.connection.title')),
      createElement('span', { style: { color: '#a1a1aa', fontSize: 12 } }, label),
    ),
    state.status === 'ready' && !configured ? createElement('p', { style: { margin: 0, color: '#a1a1aa', fontSize: 12, lineHeight: 1.55 } }, t('settings.connection.guide')) : null,
    state.value?.routes.length ? createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
      ...state.value.routes.map(route => createElement('code', { key: route.provider, style: { padding: '3px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(127,127,127,.1)', color: route.configured ? '#86efac' : '#fdba74' } }, `${route.provider} · ${route.credentialRef}`)),
    ) : null,
  )
}

type ConfigField = keyof Config | `weights.${keyof Config['weights']}` | `priceBlend.${keyof Config['priceBlend']}`

export async function setConfigField(scope: Pick<SettingsScopeLike, 'set'>, config: Config, field: ConfigField, value: number): Promise<void> {
  const [group, nested] = field.split('.')
  if (nested === undefined) return scope.set(group!, value)
  if (group === 'weights') return scope.set(group, { ...config.weights, [nested]: value })
  if (group === 'priceBlend') return scope.set(group, { ...config.priceBlend, [nested]: value })
  throw new Error(`unknown config field: ${field}`)
}

export async function setConfigGroup(scope: Pick<SettingsScopeLike, 'set'>, group: 'weights' | 'priceBlend', value: Record<string, number>): Promise<void> {
  const sum = Object.values(value).reduce((total, item) => total + item, 0)
  if (Object.values(value).some(item => !Number.isFinite(item) || item < 0) || Math.abs(sum - 1) > 0.001) {
    throw new Error(`${group} must sum to 1`)
  }
  await scope.set(group, value)
}

export function settingsDisclosureLabel(open: boolean, locale = 'zh-CN'): string {
  const i18n = createI18n(locale)
  return `${open ? i18n.t('settings.collapse') : i18n.t('settings.expand')}: ${i18n.t('settings.title')}`
}

const scalarRows: Array<{ field: ConfigField; labelKey: Parameters<ReturnType<typeof createI18n>['t']>[0]; min: number; max?: number; step: number }> = [
  { field: 'minContextTokens', labelKey: 'settings.row.minContextTokens', min: 1, step: 1000 },
  { field: 'recommendedCount', labelKey: 'settings.row.recommendedCount', min: 1, max: 10, step: 1 },
  { field: 'cacheTtlMs', labelKey: 'settings.row.cacheTtlMs', min: 0, step: 1000 },
  { field: 'uptimePenaltyThreshold', labelKey: 'settings.row.uptimePenaltyThreshold', min: 0, max: 100, step: 0.1 },
  { field: 'uptimePenaltyFactor', labelKey: 'settings.row.uptimePenaltyFactor', min: 0, max: 1, step: 0.05 },
]

export function strategyWeightRows(locale = 'zh-CN'): Array<{ name: string; values: string }> {
  const i18n = createI18n(locale)
  const dimensions = [
    ['quantization', i18n.t('settings.dimension.quantization')],
    ['speed', i18n.t('settings.dimension.speed')],
    ['price', i18n.t('settings.dimension.price')],
    ['context', i18n.t('settings.dimension.context')],
  ] as const
  return (['price', 'speed', 'context'] as const).map(strategy => ({
    name: i18n.t(`panel.strategy.${strategy}`),
    values: dimensions.map(([key, label]) => `${label} ${STRATEGY_WEIGHTS[strategy][key] * 100}%`).join(' · '),
  }))
}

function valueAt(config: Config, field: ConfigField): number {
  const [group, nested] = field.split('.')
  if (nested === undefined) return config[group as keyof Config] as number
  return (config[group as 'weights' | 'priceBlend'] as Record<string, number>)[nested]!
}

export function OpenRouterProvidersSettingsCard({ scope }: { scope: SettingsScopeLike }): ReactNode {
  const i18n = useUiI18n()
  const snapshot = useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope), scope.getSnapshot.bind(scope))
  const config = snapshot.value ?? DEFAULT_CONFIG
  const [open, setOpen] = useState(false)
  const [draftWeights, setDraftWeights] = useState({ ...config.weights })
  const [draftPriceBlend, setDraftPriceBlend] = useState({ ...config.priceBlend })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraftWeights({ ...config.weights }); setDraftPriceBlend({ ...config.priceBlend }) }, [config])
  const displayed = { ...config, weights: draftWeights, priceBlend: draftPriceBlend }
  const saveGroup = (group: 'weights' | 'priceBlend', value: Record<string, number>): void => {
    void setConfigGroup(scope, group, value).then(() => setError(null), failure => setError(failure instanceof Error ? failure.message : String(failure)))
  }
  const weightItems: readonly WeightItem<keyof Config['weights']>[] = [
    { key: 'quantization', label: i18n.t('settings.dimension.quantization'), color: '#60a5fa' },
    { key: 'speed', label: i18n.t('settings.dimension.speed'), color: '#34d399' },
    { key: 'price', label: i18n.t('settings.dimension.price'), color: '#fbbf24' },
    { key: 'context', label: i18n.t('settings.dimension.context'), color: '#a78bfa' },
  ]
  const priceItems: readonly WeightItem<keyof Config['priceBlend']>[] = [
    { key: 'input', label: i18n.t('settings.dimension.input'), color: '#60a5fa' },
    { key: 'output', label: i18n.t('settings.dimension.output'), color: '#f59e0b' },
    { key: 'cache', label: i18n.t('settings.dimension.cache'), color: '#34d399' },
  ]
  const strategyRows = strategyWeightRows(i18n.locale)
  const body = createElement('div', { style: { display: 'grid', gap: 14, margin: '0 16px', padding: '16px 0 12px', borderTop: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))' } },
    createElement(ConnectionStatus, { t: i18n.t }),
    createElement(WeightGroup<keyof Config['weights']>, {
      title: i18n.t('settings.group.weights.title'), scope: i18n.t('settings.group.weights.scope'),
      values: draftWeights, defaults: { ...DEFAULT_CONFIG.weights }, items: weightItems, writable: snapshot.writable,
      applyLabel: i18n.t('settings.action.weights'), resetLabel: i18n.t('settings.action.reset'), t: i18n.t,
      onChange: setDraftWeights, onApply: () => saveGroup('weights', draftWeights),
    }),
    createElement(WeightGroup<keyof Config['priceBlend']>, {
      title: i18n.t('settings.group.priceBlend.title'), scope: i18n.t('settings.group.priceBlend.scope'),
      values: draftPriceBlend, defaults: { ...DEFAULT_CONFIG.priceBlend }, items: priceItems, writable: snapshot.writable,
      applyLabel: i18n.t('settings.action.priceBlend'), resetLabel: i18n.t('settings.action.reset'), t: i18n.t,
      onChange: setDraftPriceBlend, onApply: () => saveGroup('priceBlend', draftPriceBlend),
    }),
    createElement('details', { style: { padding: '11px 14px', borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1))' } },
      createElement('summary', { style: { cursor: 'pointer', fontSize: 13, fontWeight: 600 } }, i18n.t('settings.group.strategies.title')),
      createElement('p', { style: { margin: '10px 0', color: '#a1a1aa', fontSize: 12 } }, i18n.t('settings.group.strategies.scope')),
      ...strategyRows.map(row => createElement('div', { key: row.name, style: { display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,.06)', fontSize: 12 } },
        createElement('strong', null, row.name), createElement('span', { style: { color: '#a1a1aa' } }, row.values),
      )),
    ),
    createElement('section', { style: { display: 'grid', gap: 10, padding: 14, borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1))' } },
      createElement('h4', { style: { margin: '0 0 2px', fontSize: 14 } }, i18n.t('settings.group.advanced.title')),
      ...scalarRows.map(row => createElement('label', { key: row.field, style: { display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 140px', alignItems: 'center', gap: 12 } },
        createElement('span', { style: { fontSize: 13 } }, i18n.t(row.labelKey)),
        createElement('input', {
          type: 'number', value: valueAt(displayed, row.field), min: row.min, max: row.max, step: row.step,
          disabled: !snapshot.writable,
          onChange: (event: { currentTarget: { valueAsNumber: number } }) => void setConfigField(scope, config, row.field, event.currentTarget.valueAsNumber),
        }),
      )),
    ),
    error === null ? null : createElement('p', { role: 'alert', style: { color: '#b42318', margin: 0 } }, error),
  )
  return createElement('li', {
    style: {
      listStyle: 'none', border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', borderRadius: 12,
      background: open ? 'var(--dsw-alias-bg-layer-2, rgba(255,255,255,.04))' : 'var(--dsw-alias-bg-layer-3, rgba(255,255,255,.025))',
    },
  },
  createElement('button', {
    type: 'button', 'aria-expanded': open, 'aria-label': settingsDisclosureLabel(open, i18n.locale), onClick: () => setOpen(value => !value),
    style: { width: '100%', appearance: 'none', border: 0, background: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, font: 'inherit' },
  },
  createElement('span', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 } },
    createElement('span', { style: { fontSize: 15, fontWeight: 600, lineHeight: 1.4 } }, i18n.t('settings.title')),
    createElement('span', { style: { fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary, #a1a1aa)' } }, i18n.t('settings.summary')),
  ),
  createElement('span', { 'aria-hidden': true, style: { color: 'var(--dsw-alias-label-tertiary, #a1a1aa)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .16s', fontSize: 18 } }, '⌄'),
  ),
  open ? body : null)
}
