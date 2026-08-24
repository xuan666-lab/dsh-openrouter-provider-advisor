import type { OpenRouterEndpoint } from './types.js'

export interface DshModelEntry {
  id: string
  name?: string
  contextWindow?: number
  compat?: { thinkingFormat?: string; [key: string]: unknown }
  reasoningEfforts?: Record<string, string | null> | false
  openrouterModel?: string
  [key: string]: unknown
}

export interface ApplyProviderDependencies {
  upsertPreset(modelId: string, tag: string): Promise<{ slug: string }>
  readModels(route: string): Promise<DshModelEntry[]>
  writeModels(route: string, models: DshModelEntry[]): Promise<void>
  selectModel(selection: { sessionId: string; provider: string; model: string; reasoningEffort?: string }): Promise<void>
  saveDefault(selection: { provider: string; model: string; reasoningEffort?: string }): Promise<void>
}

export interface ApplyProviderInput {
  sessionId: string
  route: string
  sourceModel: string
  openrouterModel: string
  endpoint: OpenRouterEndpoint
  reasoningEffort?: string
}

export class ProviderApplyError extends Error {
  constructor(message: string, public readonly stage: 'preset' | 'settings' | 'select-model' | 'default', public readonly partial: boolean, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProviderApplyError'
  }
}

function effortFor(models: readonly DshModelEntry[], sourceModel: string, requested?: string): { declaration: Record<string, string | null> | false; selected?: string } {
  const declaration = models.find(model => model.id === sourceModel)?.reasoningEfforts ?? { off: null, high: 'high' }
  const offered = declaration === false ? [] : Object.keys(declaration)
  const selected = requested && offered.includes(requested) ? requested : offered[0]
  return selected === undefined ? { declaration } : { declaration, selected }
}

export async function applyProvider(deps: ApplyProviderDependencies, input: ApplyProviderInput) {
  let slug: string
  try {
    slug = (await deps.upsertPreset(input.openrouterModel, input.endpoint.tag)).slug
  } catch (error) {
    throw new ProviderApplyError('OpenRouter preset 创建失败；DSH 设置未修改', 'preset', false, { cause: error })
  }
  const modelId = `@preset/${slug}`
  let selectedEffort: string | undefined
  try {
    const models = await deps.readModels(input.route)
    const effort = effortFor(models, input.sourceModel, input.reasoningEffort)
    selectedEffort = effort.selected
    const entry: DshModelEntry = {
      id: modelId,
      name: `${input.openrouterModel.split('/').at(-1)} · ${input.endpoint.provider_name}`,
      contextWindow: input.endpoint.context_length,
      compat: { thinkingFormat: 'openrouter' },
      reasoningEfforts: effort.declaration,
      openrouterModel: input.openrouterModel,
    }
    const next = models.filter(model => model.id === modelId
      || !(model.id.startsWith('@preset/') && model.openrouterModel === input.openrouterModel))
    const index = next.findIndex(model => model.id === modelId)
    if (index >= 0) next[index] = { ...next[index], ...entry }
    else next.push(entry)
    await deps.writeModels(input.route, next)
  } catch (error) {
    throw new ProviderApplyError('DSH 模型设置写入失败；OpenRouter preset 已保留', 'settings', true, { cause: error })
  }
  const selection = { provider: input.route, model: modelId, ...(selectedEffort ? { reasoningEffort: selectedEffort } : {}) }
  try {
    await deps.selectModel({ sessionId: input.sessionId, ...selection })
  } catch (error) {
    throw new ProviderApplyError('当前会话切换失败；模型条目已写入，请用 /model 手动选择新 preset', 'select-model', true, { cause: error })
  }
  try {
    await deps.saveDefault(selection)
  } catch (error) {
    throw new ProviderApplyError('默认模型保存失败；当前会话已切换', 'default', true, { cause: error })
  }
  return { ok: true as const, provider: input.route, model: modelId, tag: input.endpoint.tag, openrouterModel: input.openrouterModel }
}
