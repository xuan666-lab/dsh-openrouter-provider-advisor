import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { createElement } from 'react'
import { createProviderPanelStore } from './provider-panel-store.js'
import { ProviderOverlay, ProviderSidebarTrigger } from './provider-panel.js'
import { OpenRouterProvidersSettingsCard, type SettingsScopeLike } from './settings-card.js'
import { attachLocale, en, LOCALE_NS, zh, type LocaleServiceLike } from './i18n.js'

export const inject = ['sessions', 'slots', 'settingsScope', 'locale']

export function apply(ctx: ClientContext): void {
  const client = ctx as unknown as ClientContext & {
    settingsScope: { bind(spec: { namespace: string }): SettingsScopeLike }
    locale: LocaleServiceLike & { register(namespace: string, locale: string, messages: Record<string, string>): () => void }
    slots: {
      inject(name: string, callback: () => unknown): void
      register(spec: { name: string; key: string; locale: string; inject: () => { scope: SettingsScopeLike } }, component: typeof OpenRouterProvidersSettingsCard): unknown
    }
  }
  attachLocale(client.locale)
  ctx.effect(() => {
    const offZh = client.locale.register(LOCALE_NS, 'zh', zh)
    const offEn = client.locale.register(LOCALE_NS, 'en', en)
    return () => { offZh(); offEn(); attachLocale(undefined) }
  }, 'openrouter-providers: locale dictionaries')
  const panelStore = createProviderPanelStore()
  const BoundTrigger = (props: Parameters<typeof ProviderSidebarTrigger>[0]) => createElement(ProviderSidebarTrigger, { ...props, store: panelStore })
  const BoundOverlay = (props: Parameters<typeof ProviderOverlay>[0]) => createElement(ProviderOverlay, { ...props, store: panelStore })
  client.slots.inject('sidebar.footer.action', () => client.slots.register({
    name: 'sidebar.footer.action', id: 'openrouter-providers-trigger', order: 20,
  } as never, BoundTrigger as never))
  client.slots.inject('shell.overlay', () => client.slots.register({
    name: 'shell.overlay', id: 'openrouter-providers-overlay', order: 20,
  } as never, BoundOverlay as never))
  ctx.effect(() => () => panelStore.dispose(), 'openrouter-providers: provider panel store')
  const scope = client.settingsScope.bind({ namespace: 'openrouter-providers' })
  client.slots.inject('settings.plugin.item', () => client.slots.register({
    name: 'settings.plugin.item', key: 'openrouter-providers', locale: 'openrouter-providers', inject: () => ({ scope }),
  }, OpenRouterProvidersSettingsCard))
}
