import { createElement } from 'react'
import { createProviderPanelStore } from './provider-panel-store.js'
import { ProviderOverlay, ProviderSidebarTrigger, type SessionsListStoreLike } from './provider-panel.js'
import { OpenRouterProvidersSettingsCard, type SettingsScopeLike } from './settings-card.js'
import { attachLocale, en, LOCALE_NS, zh, type LocaleServiceLike } from './i18n.js'

/**
 * Structural client-context subset — mirrors how current external plugins
 * (dsh-market, dsh-web-updater) type the runtime: the removed
 * `@deepseek-ai/dsh-client-runtime` type package no longer exists in
 * DSH >= 0.1.2, so the plugin imports no client type package and types only
 * the services it touches.
 */
export interface OrpClientContext {
  effect(dispose: () => unknown, label?: string): void
  locale: LocaleServiceLike & { register(namespace: string, locale: string, messages: Record<string, string>): () => void }
  /** Root sessions service (list store carrying the current session selection). */
  sessions: { list: SessionsListStoreLike }
  slots: {
    inject(name: string, register: () => unknown): void
    register(options: Record<string, unknown>, component: unknown): unknown
  }
  /** Settings-namespace binder provided by the settings section (dsh web >= 0.1.0-rc.7). */
  settingsScope: { bind(spec: { namespace: string }): SettingsScopeLike }
}

export const inject = ['sessions', 'slots', 'locale', 'settingsScope']

export function apply(ctx: OrpClientContext): void {
  attachLocale(ctx.locale)
  ctx.effect(() => {
    const offZh = ctx.locale.register(LOCALE_NS, 'zh', zh)
    const offEn = ctx.locale.register(LOCALE_NS, 'en', en)
    return () => { offZh(); offEn(); attachLocale(undefined) }
  }, 'openrouter-providers: locale dictionaries')

  const panelStore = createProviderPanelStore()
  // The footer/overlay seats no longer hand down a `useSessions` render prop
  // (owner props are just the shell column state). Read the current session
  // from the root `sessions` service's list store instead — the same feed the
  // framework's useSessions standard hook consumes.
  const sessions = ctx.sessions.list
  const BoundTrigger = (props: { wide: boolean }) => createElement(ProviderSidebarTrigger, { ...props, store: panelStore, sessions })
  const BoundOverlay = () => createElement(ProviderOverlay, { store: panelStore, sessions })
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'openrouter-providers-trigger', order: 20,
  } as never, BoundTrigger as never))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'openrouter-providers-overlay',
  } as never, BoundOverlay as never))
  ctx.effect(() => () => panelStore.dispose(), 'openrouter-providers: provider panel store')

  // Settings card under the configurable-plugins tab, keyed by the settings
  // namespace registered on the Host (dsh >= 0.1.2: `ctx.settings.register`).
  const scope = ctx.settingsScope.bind({ namespace: 'openrouter-providers' })
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item', key: 'openrouter-providers', inject: () => ({ scope }),
  }, OpenRouterProvidersSettingsCard))
}
