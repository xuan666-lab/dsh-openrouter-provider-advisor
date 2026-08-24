import { describe, expect, it } from 'vitest'
import { normalizeModelName, resolveOpenRouterModel } from '../src/resolve-model.js'

const catalog = [
  { id: 'deepseek/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash 0731' },
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'other/deepseek-v4-flash-0731', name: 'Other Flash 0731' },
]

describe('normalizeModelName', () => {
  it('strips preset prefix and known provider suffix', () => {
    expect(normalizeModelName('@preset/deepseek-v4-flash-0731-deepinfra')).toBe('deepseek-v4-flash-0731')
    expect(normalizeModelName('DeepSeek V4 Flash 0731 · DeepInfra')).toBe('deepseek v4 flash 0731')
  })
})

describe('resolveOpenRouterModel', () => {
  it('rejects routes that are not OpenRouter before matching', () => {
    expect(resolveOpenRouterModel({ provider: 'lmstudio-local', model: 'deepseek-v4-pro', baseURL: 'http://localhost:1234' }, catalog)).toEqual({ kind: 'not-openrouter' })
  })

  it('matches a preset model to one canonical OpenRouter id', () => {
    expect(resolveOpenRouterModel({ provider: 'or', model: '@preset/deepseek-v4-pro-novita', baseURL: 'https://openrouter.ai/api/v1' }, catalog)).toEqual({ kind: 'matched', model: catalog[1] })
  })

  it('returns candidates when a stable slug is ambiguous', () => {
    const result = resolveOpenRouterModel({ provider: 'or', model: 'deepseek-v4-flash-0731', baseURL: 'https://openrouter.ai/api/v1' }, catalog)
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') expect(result.candidates.map(item => item.id)).toEqual([catalog[0]!.id, catalog[2]!.id])
  })

  it('uses the DSH source provider to disambiguate identical exact slugs', () => {
    const duplicateCatalog = [
      { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol' },
      { id: 'other/gpt-5.6-sol', name: 'GPT-5.6 Sol Compatible' },
    ]
    expect(resolveOpenRouterModel({ provider: 'openrouter-main', model: 'gpt-5.6-sol', name: 'openai GPT-5.6 Sol', baseURL: 'https://openrouter.ai/api/v1' }, duplicateCatalog)).toEqual({ kind: 'matched', model: duplicateCatalog[0] })
  })

  it('prefers the base model over an OpenRouter batch variant', () => {
    const variants = [
      { id: 'openai/gpt-5.6-sol', name: 'OpenAI: GPT-5.6 Sol' },
      { id: 'openai/gpt-5.6-sol:batch', name: 'OpenAI: GPT-5.6 Sol (batch)' },
    ]
    expect(resolveOpenRouterModel({ provider: 'openrouter-main', model: 'gpt-5.6-sol', name: 'openai GPT-5.6 Sol', baseURL: 'https://openrouter.ai/api/v1' }, variants)).toEqual({ kind: 'matched', model: variants[0] })
  })

  it('recovers the canonical model from a plugin-generated preset with any provider suffix', () => {
    const variants = [
      { id: 'deepseek/deepseek-v4', name: 'DeepSeek V4' },
      { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash 0731' },
      { id: 'deepseek/deepseek-v4-flash-0731:batch', name: 'DeepSeek V4 Flash 0731 Batch' },
    ]
    expect(resolveOpenRouterModel({ provider: 'openrouter-main', model: '@preset/deepseek-v4-flash-0731-baseten', name: 'openrouter-main deepseek-v4-flash-0731 · BaseTen', baseURL: 'https://openrouter.ai/api/v1' }, variants)).toEqual({ kind: 'matched', model: variants[2] })
  })

  it('returns the normalized slug when no model matches', () => {
    expect(resolveOpenRouterModel({ provider: 'or', model: 'unknown-model', baseURL: 'https://openrouter.ai/api/v1' }, catalog)).toEqual({ kind: 'not-found', normalized: 'unknown-model' })
  })
})
