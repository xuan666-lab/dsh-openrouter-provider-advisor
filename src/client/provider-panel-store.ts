import type { RecommendationResponse } from '../directory.js'
import type { RankingStrategy } from '../config.js'

export interface ProviderPanelSnapshot {
  open: boolean
  status: 'idle' | 'loading' | 'ready' | 'applying' | 'error'
  sessionId: string | null
  data: RecommendationResponse | null
  models: ConfiguredProviderModel[]
  selected: { provider: string; model: string; name?: string } | null
  strategy: RankingStrategy
  error: string | null
  applyingTag: string | null
  successTag: string | null
  updatedAt: number | null
  previousTag: string | null
  credential: { configured: boolean; ref: string; source: 'provider' | 'fallback' } | null
  history: SwitchHistoryEntry[]
}

export interface SwitchHistoryEntry {
  at: number
  model: string
  fromTag: string | null
  fromName: string | null
  fromTps: number | null
  toTag: string
  toName: string
  toTps: number | null
}

export interface ConfiguredProviderModel {
  provider: string
  model: string
  name: string
  matchName: string
  current: boolean
}

interface ModelCatalogResponse {
  ok: true
  credential: { configured: boolean; ref: string; source: 'provider' | 'fallback' }
  current: { provider: string; model: string }
  models: ConfiguredProviderModel[]
}

export interface ProviderPanelStore {
  getSnapshot(): ProviderPanelSnapshot
  subscribe(listener: () => void): () => void
  toggle(sessionId: string): Promise<void>
  open(sessionId: string): Promise<void>
  close(): void
  refresh(sessionId: string): Promise<void>
  selectModel(sessionId: string, provider: string, model: string, name: string): Promise<void>
  setStrategy(sessionId: string, strategy: RankingStrategy): Promise<void>
  apply(sessionId: string, tag: string): Promise<void>
  dispose(): void
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
  return body
}

export type PanelStorage = Pick<Storage, 'getItem' | 'setItem'>

const STRATEGY_KEY = 'openrouter-providers:strategy'
const HISTORY_KEY = 'openrouter-providers:history'
const HISTORY_LIMIT = 20
const KNOWN_STRATEGIES: ReadonlySet<string> = new Set(['balanced', 'price', 'speed', 'context'])

function defaultStorage(): PanelStorage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

function readStrategy(storage: PanelStorage | undefined): RankingStrategy {
  try {
    const value = storage?.getItem(STRATEGY_KEY)
    return value !== null && value !== undefined && KNOWN_STRATEGIES.has(value) ? value as RankingStrategy : 'balanced'
  } catch { return 'balanced' }
}

function readHistory(storage: PanelStorage | undefined): SwitchHistoryEntry[] {
  try {
    const parsed = JSON.parse(storage?.getItem(HISTORY_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is SwitchHistoryEntry => Boolean(item && typeof item === 'object'
        && typeof (item as SwitchHistoryEntry).at === 'number'
        && typeof (item as SwitchHistoryEntry).model === 'string'
        && typeof (item as SwitchHistoryEntry).toTag === 'string'))
      .slice(0, HISTORY_LIMIT)
  } catch { return [] }
}

export function createProviderPanelStore(fetchImpl: typeof fetch = fetch, storage: PanelStorage | undefined = defaultStorage()): ProviderPanelStore {
  let snapshot: ProviderPanelSnapshot = { open: false, status: 'idle', sessionId: null, data: null, models: [], selected: null, strategy: readStrategy(storage), error: null, credential: null, applyingTag: null, successTag: null, updatedAt: null, previousTag: null, history: readHistory(storage) }
  const listeners = new Set<() => void>()
  let generation = 0
  let controller: AbortController | null = null

  const publish = (patch: Partial<ProviderPanelSnapshot>): void => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const begin = (): { id: number; signal: AbortSignal } => {
    controller?.abort()
    controller = new AbortController()
    return { id: ++generation, signal: controller.signal }
  }

  const load = async (sessionId: string, refresh: boolean, selected = snapshot.selected, strategy = snapshot.strategy): Promise<void> => {
    const operation = begin()
    publish({ open: true, status: 'loading', sessionId, error: null })
    try {
      const selection = selected ?? undefined
      const response = refresh
        ? await fetchImpl('/api/openrouter-providers/refresh', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, ...selection, strategy }), signal: operation.signal,
          })
        : await fetchImpl(`/api/openrouter-providers/recommend?${new URLSearchParams({ sessionId, ...(selection ?? {}), strategy }).toString()}`, { signal: operation.signal })
      const data = await responseJson<RecommendationResponse>(response)
      if (operation.id !== generation) return
      publish({ status: 'ready', data, error: null, updatedAt: Date.now() })
    } catch (error) {
      if (operation.id !== generation || operation.signal.aborted) return
      const message = error instanceof Error ? error.message : String(error)
      publish({ status: 'error', data: refresh ? snapshot.data : null, error: message })
      throw error
    }
  }

  const store: ProviderPanelStore = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    async toggle(sessionId) { if (snapshot.open) store.close(); else await store.open(sessionId) },
    async open(sessionId) {
      const operation = begin()
      publish({ open: true, status: 'loading', sessionId, data: null, models: [], selected: null, credential: null, error: null, applyingTag: null, successTag: null, updatedAt: null, previousTag: null })
      try {
        const catalog = await responseJson<ModelCatalogResponse>(await fetchImpl(`/api/openrouter-providers/models?sessionId=${encodeURIComponent(sessionId)}`, { signal: operation.signal }))
        if (operation.id !== generation) return
        const currentModel = catalog.models.find(model => model.current)
        const selected = currentModel
          ? { provider: currentModel.provider, model: currentModel.model, name: currentModel.matchName }
          : catalog.current
        publish({ models: catalog.models, selected, credential: catalog.credential })
        if (!catalog.credential.configured) {
          publish({ status: 'ready', data: null, error: null })
          return
        }
        await load(sessionId, false, selected)
      } catch (error) {
        if (operation.id !== generation || operation.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        publish({ status: 'error', data: null, error: message })
        throw error
      }
    },
    close() { controller?.abort(); controller = null; generation += 1; publish({ open: false, status: snapshot.data ? 'ready' : 'idle', error: null }) },
    refresh: sessionId => load(sessionId, true),
    async selectModel(sessionId, provider, model, name) {
      const selected = { provider, model, name }
      publish({ selected, data: null })
      await load(sessionId, false, selected)
    },
    async setStrategy(sessionId, strategy) {
      try { storage?.setItem(STRATEGY_KEY, strategy) } catch { /* per-viewer convenience only */ }
      publish({ strategy })
      await load(sessionId, false, snapshot.selected, strategy)
    },
    async apply(sessionId, tag) {
      const operation = begin()
      const previousTag = snapshot.data?.currentTag ?? null
      publish({ open: true, status: 'applying', sessionId, error: null, applyingTag: tag, successTag: null })
      try {
        await responseJson(await fetchImpl('/api/openrouter-providers/apply', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, tag, ...(snapshot.selected ?? {}), strategy: snapshot.strategy }), signal: operation.signal,
        }))
        if (operation.id !== generation) return
        const markCurrent = (row: RecommendationResponse['recommended'][number]) => ({ ...row, current: row.tag === tag })
        const data = snapshot.data ? { ...snapshot.data, currentTag: tag, recommended: snapshot.data.recommended.map(markCurrent), rest: snapshot.data.rest.map(markCurrent) } : null
        let history = snapshot.history
        if (snapshot.data && previousTag !== tag) {
          const rows = [...snapshot.data.recommended, ...snapshot.data.rest]
          const fromRow = previousTag === null ? undefined : rows.find(row => row.tag === previousTag)
          const toRow = rows.find(row => row.tag === tag)
          history = [{
            at: Date.now(), model: snapshot.data.openrouterModel,
            fromTag: previousTag, fromName: fromRow?.providerName ?? null, fromTps: fromRow?.tps ?? null,
            toTag: tag, toName: toRow?.providerName ?? tag, toTps: toRow?.tps ?? null,
          }, ...snapshot.history].slice(0, HISTORY_LIMIT)
          try { storage?.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* per-viewer convenience only */ }
        }
        publish({ open: true, status: 'ready', data, history, applyingTag: null, successTag: tag, previousTag: previousTag === tag ? snapshot.previousTag : previousTag, error: null })
      } catch (error) {
        if (operation.id !== generation || operation.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        publish({ open: true, status: 'error', error: message, applyingTag: null })
        throw error
      }
    },
    dispose() { controller?.abort(); controller = null; generation += 1; listeners.clear() },
  }
  return store
}
