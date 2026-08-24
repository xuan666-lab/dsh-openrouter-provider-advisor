import { createElement, Fragment, useEffect, useSyncExternalStore, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import type { RecommendationResponse } from '../directory.js'
import type { RankingStrategy } from '../config.js'
import type { ProviderPanelStore } from './provider-panel-store.js'
import { createI18n, useUiI18n } from './i18n.js'

interface SessionListLike {
  current?: string | undefined
  currentAddress?: unknown | undefined
}

interface GlobalSlotProps {
  useSessions<T>(selector: (state: SessionListLike) => T): T
}

export interface ProviderRowView {
  group: string
  tag: string
  providerName: string
  current: boolean
  detail: string
  score: number
  scoreLabel: string
}

const actionButtonStyle: CSSProperties = { height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#e4e4e7', cursor: 'pointer' }
const iconButtonStyle: CSSProperties = { ...actionButtonStyle, width: 36, padding: 0, fontSize: 20, lineHeight: 1 }

export const STRATEGY_OPTIONS: ReadonlyArray<{ id: RankingStrategy; labelKey: 'panel.strategy.balanced' | 'panel.strategy.price' | 'panel.strategy.speed' | 'panel.strategy.context' }> = [
  { id: 'balanced', labelKey: 'panel.strategy.balanced' },
  { id: 'price', labelKey: 'panel.strategy.price' },
  { id: 'speed', labelKey: 'panel.strategy.speed' },
  { id: 'context', labelKey: 'panel.strategy.context' },
]

export function providerRows(data: RecommendationResponse, i18n = createI18n('zh-CN')): ProviderRowView[] {
  const map = (group: ProviderRowView['group']) => (row: RecommendationResponse['recommended'][number]): ProviderRowView => ({
    group,
    tag: row.tag,
    providerName: row.providerName,
    current: row.current,
    score: row.score,
    detail: `${row.quantization} · ${row.tps} t/s · $${row.price.input}/$${row.price.output} · ${row.contextLength.toLocaleString()} ctx · ${row.uptime === null ? 'N/A' : `${row.uptime.toFixed(2)}%`} ${i18n.t('panel.uptime')}`,
    scoreLabel: row.current ? `${i18n.t('panel.current')} · ${row.score.toFixed(1)}` : row.score.toFixed(1),
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

export function ProviderSidebarTrigger(props: GlobalSlotProps & { wide: boolean; store: ProviderPanelStore }): ReactNode {
  const i18n = useUiI18n()
  const current = props.useSessions(state => state.current)
  const currentAddress = props.useSessions(state => state.currentAddress)
  const panel = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot)
  const target = providerTriggerState({ current, currentAddress })
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
  border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, background: '#18181b', color: '#f4f4f5', boxShadow: '0 24px 80px rgba(0,0,0,.5)',
}

export const providerGridColumns = 'minmax(110px,1fr) minmax(0,2fr) minmax(54px,auto)'

export function ProviderOverlay(props: GlobalSlotProps & { store: ProviderPanelStore }): ReactNode {
  const i18n = useUiI18n()
  const current = props.useSessions(state => state.current)
  const currentAddress = props.useSessions(state => state.currentAddress)
  const state = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot)
  const target = providerTriggerState({ current, currentAddress })

  useEffect(() => {
    if (!state.open) return
    if (!target.sessionId) props.store.close()
    else if (state.sessionId !== target.sessionId) consume(props.store.open(target.sessionId))
  }, [state.open, state.sessionId, target.sessionId, props.store])

  if (!state.open) return null
  const rows = state.data ? providerRows(state.data, i18n) : []
  const credentialReady = state.credential?.configured === true
  const columns = providerTableColumns(i18n)
  const selectedValue = state.selected ? JSON.stringify([state.selected.provider, state.selected.model]) : ''
  let lastGroup: string | null = null
  return createElement('div', { style: backdrop, role: 'presentation', onMouseDown: (event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) props.store.close() } },
    createElement('section', { role: 'dialog', 'aria-modal': true, 'aria-label': i18n.t('panel.title'), style: panelStyle },
      createElement('header', { style: { display: 'flex', alignItems: 'start', justifyContent: 'space-between', padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,.1)' } },
        createElement('div', null,
          createElement('h2', { style: { margin: 0, fontSize: 20 } }, i18n.t('panel.title')),
          createElement('p', { style: { margin: '6px 0 10px', color: '#a1a1aa', fontSize: 13 } }, state.data ? state.data.openrouterModel : i18n.t('panel.currentModelLoading')),
          createElement('select', {
            'aria-label': i18n.t('panel.modelSelect'), value: selectedValue, disabled: !credentialReady || state.models.length === 0 || state.status === 'applying',
            style: { minWidth: 300, maxWidth: 'min(460px, 60vw)', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.16)', background: '#27272a', color: '#f4f4f5' },
            onChange: (event: { currentTarget: { value: string } }) => {
              if (!target.sessionId) return
              const [provider, model] = JSON.parse(event.currentTarget.value) as [string, string]
              const selected = state.models.find(item => item.provider === provider && item.model === model)
              if (selected) consume(props.store.selectModel(target.sessionId, provider, model, selected.matchName))
            },
          }, ...state.models.map(model => createElement('option', {
            key: `${model.provider}\0${model.model}`, value: JSON.stringify([model.provider, model.model]),
          }, `${model.name}${model.current ? ` (${i18n.t('panel.current')})` : ''}`))),
          createElement('div', { role: 'group', 'aria-label': i18n.t('panel.strategyGroup'), style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, width: 'min(560px, 70vw)', marginTop: 12, padding: 4, borderRadius: 10, background: 'rgba(255,255,255,.05)' } },
            ...STRATEGY_OPTIONS.map(option => {
              const active = state.strategy === option.id
              return createElement('button', {
                key: option.id, type: 'button', 'aria-pressed': active,
                disabled: !credentialReady || state.status === 'loading' || state.status === 'applying',
                onClick: () => { if (target.sessionId && !active) consume(props.store.setStrategy(target.sessionId, option.id)) },
                style: { border: active ? '1px solid #3b82f6' : '1px solid transparent', borderRadius: 7, padding: '7px 10px', background: active ? 'rgba(37,99,235,.2)' : 'transparent', color: active ? '#93c5fd' : '#d4d4d8', cursor: active ? 'default' : 'pointer', whiteSpace: 'nowrap' },
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
      state.status === 'loading' && rows.length === 0 ? createElement('p', { style: { padding: 22, color: '#a1a1aa' } }, i18n.t('panel.loading')) : null,
      credentialReady && rows.length > 0 ? createElement('div', { style: { display: 'grid', gap: 2, margin: '12px 22px 0', color: '#71717a', fontSize: 11, lineHeight: 1.5 } },
        createElement('span', null, i18n.t('panel.switchHint')),
        createElement('span', { style: { color: '#52525b', fontSize: 10 } }, i18n.t('panel.uptimeDelayHint')),
      ) : null,
      createElement('div', { style: { overflowY: 'auto', padding: '12px 14px 20px' } },
        ...rows.flatMap(row => {
          const nodes: ReactNode[] = []
          if (lastGroup !== row.group) {
            lastGroup = row.group
            nodes.push(createElement('h3', { key: `group-${row.group}`, style: { margin: '14px 8px 8px', color: '#a1a1aa', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' } }, row.group))
            nodes.push(createElement('div', {
              key: `columns-${row.group}`,
              style: { display: 'grid', gridTemplateColumns: providerGridColumns, gap: 14, padding: '0 14px 8px', color: '#71717a', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase' },
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
            style: { width: '100%', display: 'grid', gridTemplateColumns: providerGridColumns, gap: 14, alignItems: 'center', padding: '12px 14px', marginBottom: 6, borderRadius: 10, border: row.current ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,.12)', background: row.current ? 'rgba(37,99,235,.14)' : 'rgba(255,255,255,.045)', color: 'inherit', textAlign: 'left', cursor: row.current ? 'default' : 'pointer', transition: 'background .15s ease,border-color .15s ease,transform .15s ease', opacity: state.status === 'applying' && !switching ? .55 : 1 },
          },
          createElement('strong', null, row.providerName),
          createElement('span', { title: row.detail, style: { color: '#a1a1aa', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.detail),
          createElement('span', { style: { color: row.current ? '#60a5fa' : '#d4d4d8', fontSize: 12, textAlign: 'right' } }, switching ? i18n.t('panel.switching') : switched ? i18n.t('panel.switched') : row.scoreLabel),
          ))
          return nodes
        }),
      ),
    ),
  )
}
