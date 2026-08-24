import { createElement, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { percent, rebalanceWeights } from './linked-weights.js'
import type { TranslationKey } from './i18n.js'

export interface WeightItem<K extends string> {
  key: K
  label: string
  color: string
}

export interface WeightGroupProps<K extends string> {
  title: string
  scope: string
  values: Record<K, number>
  defaults: Record<K, number>
  items: readonly WeightItem<K>[]
  writable: boolean
  applyLabel: string
  resetLabel: string
  t(key: TranslationKey, params?: Record<string, string | number>): string
  onChange(values: Record<K, number>): void
  onApply(): void
}

const cardStyle: CSSProperties = {
  display: 'grid', gap: 14, padding: 16, borderRadius: 12,
  border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))',
  background: 'var(--dsw-alias-bg-layer-3, rgba(255,255,255,.025))',
}

export function WeightGroup<K extends string>(props: WeightGroupProps<K>): ReactNode {
  const [locked, setLocked] = useState<Set<K>>(() => new Set())
  const unlockedCount = props.items.reduce((count, item) => count + (locked.has(item.key) ? 0 : 1), 0)
  const dirty = props.items.some(item => Math.abs(props.values[item.key] - props.defaults[item.key]) > 0.000001)
  const total = useMemo(() => props.items.reduce((sum, item) => sum + props.values[item.key], 0), [props.items, props.values])
  const update = (key: K, percentage: number): void => {
    props.onChange(rebalanceWeights(props.values, key, percentage / 100, locked))
  }
  const toggleLock = (key: K): void => {
    setLocked(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  return createElement('section', { style: cardStyle },
    createElement('div', { style: { display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16 } },
      createElement('div', null,
        createElement('h4', { style: { margin: 0, fontSize: 15, fontWeight: 650 } }, props.title),
        createElement('p', { style: { margin: '5px 0 0', color: 'var(--dsw-alias-label-tertiary, #a1a1aa)', fontSize: 12, lineHeight: 1.55 } }, props.scope),
      ),
      createElement('span', { style: { flex: '0 0 auto', padding: '3px 8px', borderRadius: 999, fontSize: 11, color: '#86efac', background: 'rgba(34,197,94,.12)' } }, `${percent(total)} ✓`),
    ),
    createElement('div', { 'aria-hidden': true, style: { display: 'flex', height: 8, overflow: 'hidden', borderRadius: 999, background: 'rgba(255,255,255,.06)' } },
      ...props.items.map(item => createElement('span', { key: item.key, style: { width: `${props.values[item.key] * 100}%`, background: item.color, transition: 'width .12s ease' } })),
    ),
    createElement('div', { style: { display: 'grid', gap: 12 } },
      ...props.items.map(item => {
        const isLocked = locked.has(item.key)
        return createElement('div', { key: item.key, style: { display: 'grid', gridTemplateColumns: 'minmax(84px, .7fr) minmax(150px, 2fr) 70px 34px', gap: 10, alignItems: 'center' } },
          createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 } },
            createElement('i', { 'aria-hidden': true, style: { width: 8, height: 8, borderRadius: 2, background: item.color } }), item.label,
          ),
          createElement('input', {
            type: 'range', min: 0, max: 100, step: 1, value: Math.round(props.values[item.key] * 100),
            disabled: !props.writable || isLocked, 'aria-label': item.label,
            style: { width: '100%', accentColor: item.color },
            onChange: (event: { currentTarget: { valueAsNumber: number } }) => update(item.key, event.currentTarget.valueAsNumber),
          }),
          createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 3 } },
            createElement('input', {
              type: 'number', min: 0, max: 100, step: 1, value: Math.round(props.values[item.key] * 1000) / 10,
              disabled: !props.writable || isLocked, 'aria-label': `${item.label} %`,
              style: { width: 50, padding: '5px 6px', borderRadius: 6, textAlign: 'right' },
              onChange: (event: { currentTarget: { valueAsNumber: number } }) => update(item.key, event.currentTarget.valueAsNumber),
            }),
            createElement('span', { style: { color: '#a1a1aa', fontSize: 12 } }, '%'),
          ),
          createElement('button', {
            type: 'button', disabled: !props.writable || (!isLocked && unlockedCount <= 1),
            'aria-label': props.t(isLocked ? 'settings.action.unlock' : 'settings.action.lock', { name: item.label }),
            title: props.t(isLocked ? 'settings.action.unlock' : 'settings.action.lock', { name: item.label }),
            onClick: () => toggleLock(item.key),
            style: { width: 30, height: 30, padding: 0, borderRadius: 7, border: '1px solid rgba(255,255,255,.1)', background: isLocked ? 'rgba(59,130,246,.16)' : 'transparent', color: isLocked ? '#93c5fd' : '#a1a1aa', cursor: 'pointer' },
          }, isLocked ? '🔒' : '🔓'),
        )
      }),
    ),
    createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } },
      createElement('button', { type: 'button', disabled: !props.writable || !dirty, onClick: () => props.onChange({ ...props.defaults }), style: { padding: '6px 10px' } }, props.resetLabel),
      createElement('button', { type: 'button', disabled: !props.writable, onClick: props.onApply, style: { padding: '6px 12px' } }, props.applyLabel),
    ),
  )
}
