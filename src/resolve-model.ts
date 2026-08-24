import type { OpenRouterModel } from './types.js'

const PROVIDER_SUFFIXES = new Set(['novita', 'novitaai', 'coreweave', 'deepinfra', 'silflow', 'siliconflow', 'or', 'openrouter'])
const separators = /[-_.·・/\s]+/u

export interface ResolveInput {
  provider: string
  model: string
  name?: string
  baseURL?: string
  presetModel?: string
}

export type ResolveResult =
  | { kind: 'matched'; model: OpenRouterModel }
  | { kind: 'ambiguous'; candidates: OpenRouterModel[] }
  | { kind: 'not-found'; normalized: string }
  | { kind: 'not-openrouter' }

export function normalizeModelName(value: string): string {
  const withoutPreset = value.trim().replace(/^@preset\//i, '')
  const tokens = withoutPreset.split(separators).filter(Boolean)
  if (tokens.length > 1 && PROVIDER_SUFFIXES.has(tokens.at(-1)!.toLowerCase())) tokens.pop()
  const delimiter = /[·・\s]/u.test(withoutPreset) ? ' ' : '-'
  return tokens.join(delimiter).toLowerCase()
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function authorHint(input: ResolveInput): string | undefined {
  const haystack = `${input.model} ${input.name ?? ''}`.toLowerCase()
  return ['deepseek', 'qwen', 'anthropic', 'openai', 'google', 'meta-llama', 'mistralai'].find(author => haystack.includes(author.replace('-llama', '')))
}

export function resolveOpenRouterModel(input: ResolveInput, catalog: readonly OpenRouterModel[]): ResolveResult {
  if (!input.model.startsWith('@preset/') && !input.baseURL?.toLowerCase().includes('openrouter.ai')) return { kind: 'not-openrouter' }
  if (input.presetModel) {
    const preset = catalog.find(item => item.id.toLowerCase() === input.presetModel!.toLowerCase())
    if (preset) return { kind: 'matched', model: preset }
  }

  const normalized = normalizeModelName(input.model)
  const normalizedCompact = compact(normalized)
  const exact = catalog.filter(item => {
    const slug = item.id.split('/').at(-1)!
    return item.id.toLowerCase() === normalized || slug.toLowerCase() === normalized
  })
  if (exact.length === 1) return { kind: 'matched', model: exact[0]! }
  if (exact.length > 1) return { kind: 'ambiguous', candidates: exact }

  const hint = authorHint(input)
  let stable = catalog.filter(item => {
    const slug = item.id.split('/').at(-1)!
    const slugCompact = compact(slug)
    return slugCompact.includes(normalizedCompact) || normalizedCompact.includes(slugCompact)
  })
  if (hint) {
    const hinted = stable.filter(item => item.id.toLowerCase().startsWith(`${hint}/`))
    if (hinted.length > 0) stable = hinted
  }
  if (stable.length > 1 && input.model.startsWith('@preset/')) {
    const prefixMatches = stable.filter(item => normalizedCompact.startsWith(compact(item.id.split('/').at(-1)!)))
    const longest = Math.max(0, ...prefixMatches.map(item => compact(item.id.split('/').at(-1)!).length))
    const longestMatches = prefixMatches.filter(item => compact(item.id.split('/').at(-1)!).length === longest)
    if (longestMatches.length === 1) return { kind: 'matched', model: longestMatches[0]! }
    if (longestMatches.length > 1) stable = longestMatches
  }
  const compactExact = stable.filter(item => compact(item.id.split('/').at(-1)!) === normalizedCompact)
  if (compactExact.length === 1) return { kind: 'matched', model: compactExact[0]! }
  if (compactExact.length > 1) stable = compactExact
  if (stable.length === 1) return { kind: 'matched', model: stable[0]! }
  if (stable.length > 1) return { kind: 'ambiguous', candidates: stable }

  const display = compact(input.name ?? input.model)
  const fuzzy = catalog.filter(item => compact(item.name).includes(display) || display.includes(compact(item.name)))
  if (fuzzy.length === 1) return { kind: 'matched', model: fuzzy[0]! }
  if (fuzzy.length > 1) return { kind: 'ambiguous', candidates: fuzzy }
  return { kind: 'not-found', normalized }
}
