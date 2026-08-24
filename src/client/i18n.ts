import { useSyncExternalStore } from 'react'

export type SupportedLocale = 'zh-CN' | 'en-US'

export type TranslationKey =
  | 'panel.title'
  | 'panel.currentModelLoading'
  | 'panel.modelSelect'
  | 'panel.strategyGroup'
  | 'panel.refresh'
  | 'panel.close'
  | 'panel.loading'
  | 'panel.titleTrigger'
  | 'panel.unavailable'
  | 'panel.group.recommended'
  | 'panel.group.rest'
  | 'panel.column.provider'
  | 'panel.column.details'
  | 'panel.column.score'
  | 'panel.current'
  | 'panel.credentialMissing'
  | 'panel.switchHint'
  | 'panel.uptime'
  | 'panel.uptimeDelayHint'
  | 'panel.strategy.balanced'
  | 'panel.strategy.price'
  | 'panel.strategy.speed'
  | 'panel.strategy.context'
  | 'settings.title'
  | 'settings.summary'
  | 'settings.action.weights'
  | 'settings.action.priceBlend'
  | 'settings.action.reset'
  | 'settings.action.lock'
  | 'settings.action.unlock'
  | 'settings.expand'
  | 'settings.collapse'
  | 'settings.row.minContextTokens'
  | 'settings.row.recommendedCount'
  | 'settings.row.cacheTtlMs'
  | 'settings.row.weights.quantization'
  | 'settings.row.weights.speed'
  | 'settings.row.weights.price'
  | 'settings.row.weights.context'
  | 'settings.row.priceBlend.input'
  | 'settings.row.priceBlend.output'
  | 'settings.row.priceBlend.cache'
  | 'settings.row.uptimePenaltyThreshold'
  | 'settings.row.uptimePenaltyFactor'
  | 'settings.group.weights.title'
  | 'settings.group.weights.scope'
  | 'settings.group.priceBlend.title'
  | 'settings.group.priceBlend.scope'
  | 'settings.group.advanced.title'
  | 'settings.group.strategies.title'
  | 'settings.group.strategies.scope'
  | 'settings.dimension.quantization'
  | 'settings.dimension.speed'
  | 'settings.dimension.price'
  | 'settings.dimension.context'
  | 'settings.dimension.input'
  | 'settings.dimension.output'
  | 'settings.dimension.cache'
  | 'settings.connection.title'
  | 'settings.connection.loading'
  | 'settings.connection.configured'
  | 'settings.connection.missing'
  | 'settings.connection.error'
  | 'settings.connection.guide'

const messages: Record<SupportedLocale, Record<TranslationKey, string>> = {
  'zh-CN': {
    'panel.title': 'OpenRouter 供应商',
    'panel.currentModelLoading': '正在读取当前模型…',
    'panel.modelSelect': '选择 DSH 模型',
    'panel.strategyGroup': '推荐策略',
    'panel.refresh': '刷新',
    'panel.close': '关闭',
    'panel.loading': '正在加载供应商…',
    'panel.titleTrigger': 'OpenRouter 供应商',
    'panel.unavailable': '当前会话不可切换供应商',
    'panel.group.recommended': '推荐 Top 5',
    'panel.group.rest': '其他合格供应商',
    'panel.column.provider': '供应商',
    'panel.column.details': '规格详情',
    'panel.column.score': '分数',
    'panel.current': '当前',
    'panel.credentialMissing': '未检测到 OpenRouter 凭据“{ref}”。请前往 DSH 设置 → 模型完成配置；推荐、刷新和供应商切换暂不可用。',
    'panel.switchHint': '点击供应商即可实时切换；当前会话与默认模型会立即更新。',
    'panel.uptime': '可用率',
    'panel.uptimeDelayHint': '可用率来自 OpenRouter 近 30 分钟统计，故障与恢复可能存在检测延迟。',
    'panel.strategy.balanced': '综合最佳',
    'panel.strategy.price': '价格优先',
    'panel.strategy.speed': '速度优先',
    'panel.strategy.context': '上下文优先',
    'settings.title': 'OpenRouter 供应商',
    'settings.summary': '推荐数量、综合最佳权重与全局价格模型。',
    'settings.action.weights': '应用综合权重',
    'settings.action.priceBlend': '应用价格占比',
    'settings.action.reset': '恢复默认',
    'settings.action.lock': '锁定 {name}',
    'settings.action.unlock': '解锁 {name}',
    'settings.expand': '展开',
    'settings.collapse': '收起',
    'settings.row.minContextTokens': '最小上下文 tokens',
    'settings.row.recommendedCount': '推荐数量（1–10）',
    'settings.row.cacheTtlMs': '缓存 TTL（毫秒）',
    'settings.row.weights.quantization': '量化权重',
    'settings.row.weights.speed': '速度权重',
    'settings.row.weights.price': '价格权重',
    'settings.row.weights.context': '上下文权重',
    'settings.row.priceBlend.input': '输入价格占比',
    'settings.row.priceBlend.output': '输出价格占比',
    'settings.row.priceBlend.cache': '缓存价格占比',
    'settings.row.uptimePenaltyThreshold': 'Uptime 降权阈值（%）',
    'settings.row.uptimePenaltyFactor': 'Uptime 降权系数',
    'settings.group.weights.title': '综合最佳评分权重',
    'settings.group.weights.scope': '仅影响“综合最佳”推荐策略；调整一项时，其他未锁定项会按比例联动。',
    'settings.group.priceBlend.title': '价格计算占比',
    'settings.group.priceBlend.scope': '所有推荐策略共用。Code Agent 默认按 95% 以上缓存流量优化。',
    'settings.group.advanced.title': '筛选与可靠性',
    'settings.group.strategies.title': '查看其他策略权重',
    'settings.group.strategies.scope': '以下策略使用内置权重；价格维度仍使用上方全局价格占比。',
    'settings.dimension.quantization': '量化',
    'settings.dimension.speed': '速度',
    'settings.dimension.price': '价格',
    'settings.dimension.context': '上下文',
    'settings.dimension.input': '输入',
    'settings.dimension.output': '输出',
    'settings.dimension.cache': '缓存',
    'settings.connection.title': 'OpenRouter 连接',
    'settings.connection.loading': '正在检查 DSH OpenRouter 配置…',
    'settings.connection.configured': '已复用 DSH 中配置的 OpenRouter 凭据',
    'settings.connection.missing': '尚未检测到可用的 OpenRouter 凭据',
    'settings.connection.error': '暂时无法读取连接状态',
    'settings.connection.guide': '请前往 DSH 设置 → 模型，为 OpenRouter provider 配置 API Key。插件不会读取或显示密钥内容。',
  },
  'en-US': {
    'panel.title': 'OpenRouter Providers',
    'panel.currentModelLoading': 'Loading current model…',
    'panel.modelSelect': 'Select DSH model',
    'panel.strategyGroup': 'Ranking strategy',
    'panel.refresh': 'Refresh',
    'panel.close': 'Close',
    'panel.loading': 'Loading providers…',
    'panel.titleTrigger': 'OpenRouter Providers',
    'panel.unavailable': 'Provider switching is unavailable for this session',
    'panel.group.recommended': 'Top 5 Recommendations',
    'panel.group.rest': 'Other Eligible Providers',
    'panel.column.provider': 'Provider',
    'panel.column.details': 'Specs & Performance',
    'panel.column.score': 'Score',
    'panel.current': 'Current',
    'panel.credentialMissing': 'OpenRouter credential “{ref}” is not configured. Configure it in DSH Settings → Models; recommendations, refresh, and provider switching are disabled for now.',
    'panel.switchHint': 'Click a provider to switch immediately; the current session and default model update together.',
    'panel.uptime': 'uptime',
    'panel.uptimeDelayHint': 'Uptime comes from OpenRouter\'s trailing 30-minute statistics, so failures and recoveries may be detected with a delay.',
    'panel.strategy.balanced': 'Best overall',
    'panel.strategy.price': 'Price first',
    'panel.strategy.speed': 'Speed first',
    'panel.strategy.context': 'Context first',
    'settings.title': 'OpenRouter Providers',
    'settings.summary': 'Recommended count, ranking weights, and price blend.',
    'settings.action.weights': 'Apply ranking weights',
    'settings.action.priceBlend': 'Apply price blend',
    'settings.action.reset': 'Reset defaults',
    'settings.action.lock': 'Lock {name}',
    'settings.action.unlock': 'Unlock {name}',
    'settings.expand': 'Expand',
    'settings.collapse': 'Collapse',
    'settings.row.minContextTokens': 'Minimum context tokens',
    'settings.row.recommendedCount': 'Recommended count (1-10)',
    'settings.row.cacheTtlMs': 'Cache TTL (ms)',
    'settings.row.weights.quantization': 'Quantization weight',
    'settings.row.weights.speed': 'Speed weight',
    'settings.row.weights.price': 'Price weight',
    'settings.row.weights.context': 'Context weight',
    'settings.row.priceBlend.input': 'Input price share',
    'settings.row.priceBlend.output': 'Output price share',
    'settings.row.priceBlend.cache': 'Cache price share',
    'settings.row.uptimePenaltyThreshold': 'Uptime penalty threshold (%)',
    'settings.row.uptimePenaltyFactor': 'Uptime penalty factor',
    'settings.group.weights.title': 'Best-overall scoring weights',
    'settings.group.weights.scope': 'Affects only Best overall. Changing one item proportionally redistributes the other unlocked items.',
    'settings.group.priceBlend.title': 'Price calculation blend',
    'settings.group.priceBlend.scope': 'Shared by all ranking strategies. The Code Agent default is optimized for 95%+ cached traffic.',
    'settings.group.advanced.title': 'Filtering & reliability',
    'settings.group.strategies.title': 'View other strategy weights',
    'settings.group.strategies.scope': 'These strategies use built-in weights; their price dimension still uses the global price blend above.',
    'settings.dimension.quantization': 'Quality',
    'settings.dimension.speed': 'Speed',
    'settings.dimension.price': 'Price',
    'settings.dimension.context': 'Context',
    'settings.dimension.input': 'Input',
    'settings.dimension.output': 'Output',
    'settings.dimension.cache': 'Cache',
    'settings.connection.title': 'OpenRouter connection',
    'settings.connection.loading': 'Checking the DSH OpenRouter configuration…',
    'settings.connection.configured': 'Reusing the OpenRouter credential configured in DSH',
    'settings.connection.missing': 'No usable OpenRouter credential was found',
    'settings.connection.error': 'Connection status is temporarily unavailable',
    'settings.connection.guide': 'Open DSH Settings → Models and configure an API key for the OpenRouter provider. The plugin never reads or displays the key in the client.',
  },
}

export const zh = messages['zh-CN']
export const en = messages['en-US']
export const LOCALE_NS = 'openrouterProviders'

export interface LocaleServiceLike {
  getSnapshot(): { active: string }
  subscribe(listener: () => void): () => void
}

let localeService: LocaleServiceLike | undefined

export function attachLocale(service: LocaleServiceLike | undefined): void {
  localeService = service
}

export function normalizeLocale(input?: string): SupportedLocale {
  return input?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function getLocaleSnapshot(): SupportedLocale {
  const active = localeService?.getSnapshot().active
  const browserLang = typeof navigator === 'undefined' ? undefined : navigator.language
  return normalizeLocale(active ?? browserLang)
}

export function createI18n(locale: string) {
  const normalized = normalizeLocale(locale)
  return {
    locale: normalized,
    t(key: TranslationKey, params?: Record<string, string | number>): string {
      let text = messages[normalized][key]
      for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, String(value))
      return text
    },
  }
}

export function subscribeLocale(listener: () => void): () => void {
  return localeService?.subscribe(listener) ?? (() => {})
}

export function useUiI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, () => 'en-US')
  return createI18n(locale)
}
