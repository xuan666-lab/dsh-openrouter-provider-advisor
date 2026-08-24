# Implementation verification

Verified on 2026-08-24 against the installed DSH web profile.

| Design requirement | Evidence |
|---|---|
| Top 5, configurable 1–10, no padding | `score.spec.ts`; the live sidebar overlay rendered exactly five recommended rows followed by eligible remainder. |
| Official OpenRouter API, no HTML scraping | `openrouter.ts` only calls `/models`, `/models/{id}/endpoints`, and `/presets/{slug}/chat/completions`; transport tests assert URLs and auth. |
| Host Directory + sidebar panel + two tools + settings card | `OpenRouterProviderDirectory`, Host controller/routes, `createProviderTools`, sidebar trigger/overlay and settings card; DSH browser smoke showed the panel and card. |
| Model alignment | Resolver tests cover preset prefixes, provider suffixes, non-OpenRouter routes, ambiguity, and no match. Live current model resolved to `deepseek/deepseek-v4-flash-0731`. |
| Four-dimensional scoring | Fixture-backed score tests cover filtering, price units, configurable count, weight validation, current marker, and deterministic ranking. |
| Reliability safety | Score tests cover the model-independent uptime bands (100/85/60/30/5%, unknown 70%) and prove user settings can only make the penalty stricter. Provider rows expose 30-minute uptime and the current provider's penalized score. |
| Switch ordering | `apply-provider.spec.ts` asserts preset → whole models-array write → `session.selectModel` → default save, including partial failures. |
| Host API correctness | Host adapter regression test asserts `{ payload }` RpcRequest envelopes; live invalid-session request returned the expected `session-not-found` domain error. |
| Locale integration | `i18n.spec.ts` asserts Chinese/English lookup, fallback, and subscription through the official DSH locale service. Client components re-render on a DSH locale snapshot change without reloading recommendations. |
| Provider headers | `provider-panel.spec.ts` asserts localized provider/details/score headers. Header and provider rows share one grid column definition; detail text truncates safely on narrow panels. |
| Session privacy boundary | The host adapter only requests `session.models` and invokes `session.selectModel`; no conversation message/history API is used. |
| Linked weight controls | `linked-weights.spec.ts` covers proportional redistribution, locked peers, capacity clamping, zero-valued peers, percentage formatting, and exact unit totals. Settings copy labels editable weights as balanced-only and price blending as global. |
| Credential reuse | Controller/adapter tests assert that the selected DSH OpenRouter profile's `apiKeyEnv` is resolved first, `OPENROUTER_API_KEY` is only a fallback, connection responses contain no values, and missing credentials do not trigger recommendation requests. |
| Client bundle contract | Package exports `./client` and `./package.json`; served boot manifest contained `dsh-openrouter-provider-advisor`; served script begins with `window.__ModuleLoader__.load`. |
| Settings validation/live behavior | Shared config validation runs through `installSettingsSection`; the card stages both weight groups and submits them atomically. Browser smoke rendered all controls. |
| Permanent human-facing entry | Browser smoke rendered “OpenRouter 供应商” in `sidebar.footer.action`, opened the `shell.overlay` panel, loaded five recommended rows plus the eligible remainder, and marked DeepInfra current. `/providers` no longer appeared as a command candidate. |
| Sidebar layout and DSH model directory | Browser smoke confirmed DSH Update, Trace Compare, and Provider each occupy a complete footer row. The panel listed all 11 models from the built-in DSH model directory; selecting `DeepSeek-V4-Pro` recomputed a distinct OpenRouter Top 5 without applying a provider. |
| Author and variant disambiguation | Resolver tests cover DSH source-provider hints and prefer a base model over its `:batch` variant. A live request for DSH `GPT-5.6 Sol` resolved to `openai/gpt-5.6-sol` and returned five recommendations. |
| Ranking strategy presets | Tests assert balanced/configured weights plus price `10/10/70/10`, speed `15/65/10/10`, and context `15/10/10/65`; panel state defaults and resets to balanced and carries strategy through recommend/refresh/apply. |
| Live strategy re-ranking | Browser smoke showed CoreWeave first for balanced, Relace first for price, CoreWeave first for speed, and 1M-context GMICloud/BaseTen at the top for context; no provider was applied. |
| Packaging | `npm run build` emits Host, Client, and declarations; `npm pack --dry-run` includes all required artifacts. |
| Security boundaries | Tests cover native approval for agent-initiated switching, same-origin JSON mutation requests, 64KB body limits, bounded OpenRouter requests, credential re-resolution before mutation, and stale-list clearing after failed model resolution. |

The live smoke intentionally stopped before selecting an endpoint, because that operation creates or versions a real OpenRouter preset. The mutation chain is covered with injected dependency tests rather than mutating the user's OpenRouter account during verification.
