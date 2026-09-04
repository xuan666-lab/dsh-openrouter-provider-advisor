import { createElement, Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { RecommendationResponse } from '../directory.js'
import type { RankedProvider } from '../types.js'
import type { RankingStrategy } from '../config.js'
import type { ProviderPanelStore } from './provider-panel-store.js'
import { createI18n, useUiI18n } from './i18n.js'

export interface SessionListLike {
  current?: string | undefined
  currentAddress?: unknown | undefined
}

/**
 * Observable snapshot of the root sessions list store. DSH >= 0.1.2 no longer
 * injects a `useSessions` render prop into `sidebar.footer.action` /
 * `shell.overlay` occupants, so the components subscribe to the root sessions
 * service directly (the same list store the useSessions hook reads).
 */
export interface SessionsListStoreLike {
  getSnapshot(): SessionListLike
  subscribe(listener: () => void): () => void
}

export interface ProviderRowView {
  group: string
  tag: string
  providerName: string
  current: boolean
  detail: string
  score: number
  scoreLabel: string
  badge: string
  breakdown: string
  priceLabel: string
  savingsLabel: string | null
}

const textPrimary = 'var(--dsw-alias-label-primary, #f4f4f5)'
const textSecondary = 'var(--dsw-alias-label-secondary, #d4d4d8)'
const textTertiary = 'var(--dsw-alias-label-tertiary, #a1a1aa)'
const borderL2 = '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))'
const bgLayer1 = 'var(--dsw-alias-bg-layer-1, #18181b)'
const bgLayer2 = 'var(--dsw-alias-bg-layer-2, #27272a)'
const bgLayer3 = 'var(--dsw-alias-bg-layer-3, rgba(255,255,255,.05))'

const actionButtonStyle: CSSProperties = { height: 36, padding: '0 12px', borderRadius: 8, border: borderL2, background: bgLayer3, color: textPrimary, cursor: 'pointer' }
const iconButtonStyle: CSSProperties = { ...actionButtonStyle, width: 36, padding: 0, fontSize: 20, lineHeight: 1 }

export function providerInsight(row: RankedProvider, i18n = createI18n('zh-CN')): { badge: string; breakdown: string } {
  const entries = [
    ['quantization', row.dimensions.quantization, i18n.t('settings.dimension.quantization')],
    ['speed', row.dimensions.speed, i18n.t('settings.dimension.speed')],
    ['price', row.dimensions.price, i18n.t('settings.dimension.price')],
    ['context', row.dimensions.context, i18n.t('settings.dimension.context')],
  ] as const
  const strongest = entries.reduce((best, item) => item[1] > best[1] ? item : best)
  return {
    badge: i18n.t(`panel.insight.${strongest[0]}`),
    breakdown: entries.map(([, value, label]) => `${label} ${Math.round(value)}`).join(' · '),
  }
}

export function providerPriceLabel(row: Pick<RankedProvider, 'price'>, i18n = createI18n('zh-CN')): string {
  return `${i18n.t('panel.price.input')} $${row.price.input} · ${i18n.t('panel.price.output')} $${row.price.output} · ${i18n.t('panel.price.cache')} $${row.price.cache} / M tokens`
}

export function estimatedSavings(current: RankedProvider['price'], candidate: RankedProvider['price']): number | null {
  const cost = (price: RankedProvider['price']) => price.input * .02 + price.output * .08 + price.cache * .9
  const baseline = cost(current)
  const saving = baseline > 0 ? Math.round((1 - cost(candidate) / baseline) * 100) : 0
  return saving > 0 ? saving : null
}

export const STRATEGY_OPTIONS: ReadonlyArray<{ id: RankingStrategy; labelKey: 'panel.strategy.balanced' | 'panel.strategy.price' | 'panel.strategy.speed' | 'panel.strategy.context' }> = [
  { id: 'balanced', labelKey: 'panel.strategy.balanced' },
  { id: 'price', labelKey: 'panel.strategy.price' },
  { id: 'speed', labelKey: 'panel.strategy.speed' },
  { id: 'context', labelKey: 'panel.strategy.context' },
]

export function providerRows(data: RecommendationResponse, i18n = createI18n('zh-CN')): ProviderRowView[] {
  const allRows = [...data.recommended, ...data.rest]
  const currentPrice = allRows.find(row => row.current)?.price
  const map = (group: ProviderRowView['group']) => (row: RecommendationResponse['recommended'][number]): ProviderRowView => ({
    group,
    tag: row.tag,
    providerName: row.providerName,
    current: row.current,
    score: row.score,
    detail: `${row.quantization} · ${row.tps} t/s · ${row.contextLength.toLocaleString()} ctx · ${row.uptime === null ? 'N/A' : `${row.uptime.toFixed(2)}%`} ${i18n.t('panel.uptime')}`,
    priceLabel: providerPriceLabel(row, i18n),
    savingsLabel: currentPrice && !row.current ? (() => { const value = estimatedSavings(currentPrice, row.price); return value === null ? null : i18n.t('panel.savings', { percent: value }) })() : null,
    scoreLabel: row.current ? `${i18n.t('panel.current')} · ${row.score.toFixed(1)}` : row.score.toFixed(1),
    ...providerInsight(row, i18n),
  })
  return [...data.recommended.map(map(i18n.t('panel.group.recommended'))), ...data.rest.map(map(i18n.t('panel.group.rest')))]
}

export function providerTableColumns(i18n = createI18n('zh-CN')): [string, string, string] {
  return [i18n.t('panel.column.provider'), i18n.t('panel.column.details'), i18n.t('panel.column.score')]
}

export function providerTriggerState(state: SessionListLike): { sessionId: string | null; disabled: boolean } {
  if (state.current === undefined || state.currentAddress !== undefined) return { sessionId: null, disabled: true }
  return { sessionId: state.current, disabled: false }
}

const triggerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer',
  minHeight: 36, padding: '0 10px', borderRadius: 8, fontSize: 14,
}

export function providerTriggerLayout(wide: boolean): CSSProperties {
  return wide
    ? { flex: '1 0 100%', width: '100%', whiteSpace: 'nowrap', justifyContent: 'flex-start' }
    : { flex: '0 0 36px', width: 36, whiteSpace: 'nowrap', justifyContent: 'center' }
}

function consume(operation: Promise<void>): void {
  void operation.catch(() => {})
}

export function ProviderSidebarTrigger(props: { wide: boolean; store: ProviderPanelStore; sessions: SessionsListStoreLike }): ReactNode {
  const i18n = useUiI18n()
  const sessionState = useSyncExternalStore(props.sessions.subscribe, props.sessions.getSnapshot, props.sessions.getSnapshot)
  const panel = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot)
  const target = providerTriggerState(sessionState)
  return createElement(Fragment, null,
    createElement('style', null, 'div:has(> div[data-slot="sidebar.footer.action"] > button[data-openrouter-provider-trigger]){flex-wrap:wrap;row-gap:4px}'),
    createElement('button', {
    type: 'button', disabled: target.disabled, 'aria-label': i18n.t('panel.titleTrigger'), 'aria-pressed': panel.open,
    'data-openrouter-provider-trigger': '',
    title: target.disabled ? i18n.t('panel.unavailable') : i18n.t('panel.titleTrigger'),
    style: { ...triggerStyle, ...providerTriggerLayout(props.wide), opacity: target.disabled ? 0.45 : 1 },
    onClick: () => { if (target.sessionId) consume(props.store.toggle(target.sessionId)) },
  }, createElement('span', { 'aria-hidden': true }, '⇄'), props.wide ? createElement('span', null, i18n.t('panel.titleTrigger')) : null))
}

const backdrop: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
}
const panelStyle: CSSProperties = {
  width: 'min(720px, 100%)', maxHeight: 'min(760px, calc(100vh - 48px))', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  border: borderL2, borderRadius: 16, background: bgLayer1, color: textPrimary, boxShadow: '0 24px 80px rgba(0,0,0,.5)', outline: 'none',
}

export function freshnessLabel(updatedAt: number, now: number, i18n = createI18n('zh-CN')): string {
  const minutes = Math.max(0, Math.floor((now - updatedAt) / 60_000))
  return minutes === 0 ? i18n.t('panel.updatedJustNow') : i18n.t('panel.updatedMinutesAgo', { minutes })
}

export const providerGridColumns = 'minmax(110px,1fr) minmax(0,2fr) minmax(54px,auto)'

export function ProviderOverlay(props: { store: ProviderPanelStore; sessions: SessionsListStoreLike }): ReactNode {
  const i18n = useUiI18n()
  const sessionState = useSyncExternalStore(props.sessions.subscribe, props.sessions.getSnapshot, props.sessions.getSnapshot)
  const state = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot)
  const target = providerTriggerState(sessionState)
  const dialogRef = useRef<HTMLElement>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!state.open) return
    if (!target.sessionId) props.store.close()
    else if (state.sessionId !== target.sessionId) consume(props.store.open(target.sessionId))
  }, [state.open, state.sessionId, target.sessionId, props.store])

  useEffect(() => {
    if (!state.open) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [state.open, state.updatedAt])

  useEffect(() => {
    if (!state.open) return
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => { if (previous instanceof HTMLElement) previous.focus() }
  }, [state.open])

  if (!state.open) return null

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      props.store.close()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select:not(:disabled), input:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'))
    if (focusable.length === 0) return
    const first = focusable[0]!
    const last = focusable.at(-1)!
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialogRef.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
  }
  const rows = state.data ? providerRows(state.data, i18n) : []
  const credentialReady = state.credential?.configured === true
  const columns = providerTableColumns(i18n)
  const selectedValue = state.selected ? JSON.stringify([state.selected.provider, state.selected.model]) : ''
  let lastGroup: string | null = null
  return createElement('div', { style: backdrop, role: 'presentation', onKeyDown, onMouseDown: (event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) props.store.close() } },
    createElement('section', { ref: dialogRef, role: 'dialog', 'aria-modal': true, 'aria-label': i18n.t('panel.title'), tabIndex: -1, style: panelStyle },
      createElement('header', { style: { display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16, padding: '18px 22px 14px', borderBottom: borderL2 } },
        createElement('div', { style: { minWidth: 0, flex: 1 } },
          createElement('h2', { style: { margin: 0, fontSize: 20 } }, i18n.t('panel.title')),
          createElement('label', { style: { display: 'block', margin: '10px 0 5px', color: textTertiary, fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' } }, i18n.t('panel.currentModel')),
          createElement('select', {
            'aria-label': i18n.t('panel.modelSelect'), value: selectedValue, disabled: !credentialReady || state.models.length === 0 || state.status === 'applying',
            style: { width: 'min(420px, 100%)', padding: '8px 10px', borderRadius: 8, border: borderL2, background: bgLayer2, color: textPrimary },
            onChange: (event: { currentTarget: { value: string } }) => {
              if (!target.sessionId) return
              const [provider, model] = JSON.parse(event.currentTarget.value) as [string, string]
              const selected = state.models.find(item => item.provider === provider && item.model === model)
              if (selected) consume(props.store.selectModel(target.sessionId, provider, model, selected.matchName))
            },
          }, ...state.models.map(model => createElement('option', {
            key: `${model.provider}\0${model.model}`, value: JSON.stringify([model.provider, model.model]),
          }, `${model.name}${model.current ? ` (${i18n.t('panel.current')})` : ''}`))),
          createElement('div', { role: 'group', 'aria-label': i18n.t('panel.strategyGroup'), style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 3, width: 'min(520px, 100%)', marginTop: 10, padding: 3, borderRadius: 9, background: bgLayer3 } },
            ...STRATEGY_OPTIONS.map(option => {
              const active = state.strategy === option.id
              return createElement('button', {
                key: option.id, type: 'button', 'aria-pressed': active,
                disabled: !credentialReady || state.status === 'loading' || state.status === 'applying',
                onClick: () => { if (target.sessionId && !active) consume(props.store.setStrategy(target.sessionId, option.id)) },
                title: i18n.t(option.labelKey),
                style: { minHeight: 38, border: active ? '1px solid #3b82f6' : '1px solid transparent', borderRadius: 6, padding: '5px 8px', background: active ? 'rgba(37,99,235,.15)' : 'transparent', color: active ? '#93c5fd' : textSecondary, cursor: active ? 'default' : 'pointer', whiteSpace: 'nowrap', fontSize: 12 },
              }, i18n.t(option.labelKey))
            }),
          ),
        ),
        createElement('div', { style: { display: 'flex', gap: 8 } },
          createElement('button', { type: 'button', title: i18n.t('panel.refresh'), 'aria-busy': state.status === 'loading', disabled: !credentialReady || !target.sessionId || state.status === 'loading' || state.status === 'applying', onClick: () => { if (target.sessionId) consume(props.store.refresh(target.sessionId)) }, style: { ...actionButtonStyle, opacity: state.status === 'loading' ? .6 : 1 } }, createElement('span', { 'aria-hidden': true, style: { display: 'inline-block', marginRight: 6 } }, '↻'), state.status === 'loading' ? i18n.t('panel.refreshing') : i18n.t('panel.refresh')),
          createElement('button', { type: 'button', title: i18n.t('panel.close'), 'aria-label': i18n.t('panel.close'), onClick: () => props.store.close(), style: iconButtonStyle }, '×'),
        ),
      ),
      state.credential !== null && !state.credential.configured ? createElement('p', { role: 'status', style: { margin: '14px 22px 0', padding: 12, borderRadius: 8, color: '#fdba74', background: 'rgba(124,45,18,.28)', border: '1px solid rgba(249,115,22,.25)', fontSize: 13, lineHeight: 1.5 } }, i18n.t('panel.credentialMissing', { ref: state.credential.ref })) : null,
      state.error ? createElement('p', { role: 'alert', style: { margin: '14px 22px 0', padding: 12, borderRadius: 8, color: '#fca5a5', background: 'rgba(127,29,29,.35)' } }, state.error) : null,
      state.successTag && state.previousTag ? createElement('div', { role: 'status', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '12px 22px 0', padding: '9px 11px', borderRadius: 8, color: '#bbf7d0', background: 'rgba(20,83,45,.24)', border: '1px solid rgba(34,197,94,.22)', fontSize: 12 } },
        createElement('span', null, i18n.t('panel.switchSuccess')),
        createElement('button', { type: 'button', disabled: state.status === 'applying', onClick: () => { if (target.sessionId && state.previousTag) consume(props.store.apply(target.sessionId, state.previousTag)) }, style: { ...actionButtonStyle, height: 30, color: '#bbf7d0', whiteSpace: 'nowrap' } }, i18n.t('panel.undo')),
      ) : null,
      state.status === 'loading' && rows.length === 0 ? createElement('p', { style: { padding: 22, color: textTertiary } }, i18n.t('panel.loading')) : null,
      credentialReady && rows.length > 0 ? createElement('div', { style: { display: 'grid', gap: 2, margin: '12px 22px 0', color: textTertiary, fontSize: 11, lineHeight: 1.5 } },
        createElement('span', null, i18n.t('panel.switchHint')),
        createElement('span', { style: { fontSize: 10, opacity: .8 } }, i18n.t('panel.uptimeDelayHint')),
        state.updatedAt === null ? null : createElement('span', { style: { fontSize: 10, opacity: .8 } }, freshnessLabel(state.updatedAt, now, i18n)),
      ) : null,
      createElement('div', { style: { overflowY: 'auto', padding: '12px 14px 20px' } },
        ...rows.flatMap(row => {
          const nodes: ReactNode[] = []
          if (lastGroup !== row.group) {
            lastGroup = row.group
            nodes.push(createElement('h3', { key: `group-${row.group}`, style: { margin: '14px 8px 8px', color: textTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' } }, row.group))
            nodes.push(createElement('div', {
              key: `columns-${row.group}`,
              style: { display: 'grid', gridTemplateColumns: providerGridColumns, gap: 14, padding: '0 14px 8px', color: textTertiary, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase' },
            },
            createElement('span', null, columns[0]),
            createElement('span', null, columns[1]),
            createElement('span', { style: { textAlign: 'right' } }, columns[2]),
            ))
          }
          const switching = state.applyingTag === row.tag
          const switched = state.successTag === row.tag
          nodes.push(createElement('button', {
            key: row.tag, type: 'button', disabled: row.current || state.status === 'applying',
            onClick: () => { if (target.sessionId) consume(props.store.apply(target.sessionId, row.tag)) },
            title: row.current ? i18n.t('panel.current') : i18n.t('panel.switchAction'),
            style: { width: '100%', display: 'grid', gridTemplateColumns: providerGridColumns, gap: 14, alignItems: 'center', padding: '12px 14px', marginBottom: 6, borderRadius: 10, border: row.current ? '1px solid #3b82f6' : borderL2, background: row.current ? 'rgba(37,99,235,.14)' : bgLayer3, color: 'inherit', textAlign: 'left', cursor: row.current ? 'default' : 'pointer', transition: 'background .15s ease,border-color .15s ease,transform .15s ease', opacity: state.status === 'applying' && !switching ? .55 : 1 },
          },
          createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
            createElement('strong', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, row.providerName),
            createElement('small', { style: { flex: '0 0 auto', padding: '2px 6px', borderRadius: 999, color: '#a5b4fc', background: 'rgba(99,102,241,.13)', fontSize: 9, fontWeight: 600 } }, row.badge),
          ),
          createElement('span', { style: { display: 'grid', gap: 3, minWidth: 0 } },
            createElement('span', { title: row.detail, style: { color: textTertiary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.detail),
            createElement('span', { title: row.priceLabel, style: { color: textSecondary, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.priceLabel),
            row.savingsLabel ? createElement('small', { style: { color: '#86efac', fontSize: 10, fontWeight: 600 } }, row.savingsLabel) : null,
          ),
          createElement('span', { title: row.breakdown, 'aria-label': `${row.scoreLabel}; ${row.breakdown}`, style: { color: row.current ? '#60a5fa' : textSecondary, fontSize: 12, textAlign: 'right', textDecoration: 'underline dotted rgba(161,161,170,.6)', textUnderlineOffset: 3 } }, switching ? i18n.t('panel.switching') : switched ? i18n.t('panel.switched') : row.scoreLabel),
          ))
          return nodes
        }),
        state.history.length === 0 ? null : createElement('details', { style: { margin: '10px 8px 0', padding: '10px 12px', borderRadius: 10, border: borderL2 } },
          createElement('summary', { style: { cursor: 'pointer', color: textTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' } }, i18n.t('panel.history.title')),
          ...state.history.map(item => {
            const revertable = item.fromTag !== null && state.data?.openrouterModel === item.model && state.data.currentTag !== item.fromTag
            return createElement('div', { key: `${item.at}-${item.toTag}`, title: item.model, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: borderL2, fontSize: 12, marginTop: 8 } },
              createElement('span', { style: { color: textTertiary, flex: '0 0 auto' } }, new Date(item.at).toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' })),
              createElement('span', { style: { color: textSecondary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${item.fromName ?? item.fromTag ?? '—'} → ${item.toName}`),
              item.fromTps !== null && item.toTps !== null ? createElement('span', { style: { color: textTertiary, flex: '0 0 auto' } }, `${item.fromTps} → ${item.toTps} t/s`) : null,
              revertable ? createElement('button', {
                type: 'button', disabled: state.status === 'applying',
                onClick: () => { if (target.sessionId && item.fromTag) consume(props.store.apply(target.sessionId, item.fromTag)) },
                style: { ...actionButtonStyle, height: 26, padding: '0 10px', marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' },
              }, i18n.t('panel.history.revert')) : null,
            )
          }),
        ),
      ),
    ),
  )
}
