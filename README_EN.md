# dsh-openrouter-provider-advisor

The same model can have very different prices, cache-read costs, throughput, and reliability across OpenRouter providers. This plugin helps DeepSeek Harness users find a **more cost-efficient, better-fit provider** and switch in one click.

It combines quantization, speed, cache-heavy pricing, context, and uptime into a Top 5 for the current model. You no longer need to compare providers or create presets by hand: clicking a row updates both the active session and default model.

> **Core value: reduce avoidable inference spend without changing models, while finding a practical balance between cost, speed, and reliability.**

[中文](./README.md) · **English**

![OpenRouter provider ranking](./docs/images/provider-panel.png)

## Highlights

- Compare input, output, and cache-read prices to help reduce spend.
- Find the best fit rather than blindly choosing the cheapest endpoint.
- Model-aware ranking without a hard-coded model catalog.
- Best overall, price-first, speed-first, and context-first strategies.
- Code Agent price blend: 2% input, 8% output, 90% cache-read by default.
- Gentle 30-minute uptime safety bands and hard filtering for unavailable endpoints.
- One-click switching for the active session and deployment default.
- Linked percentage sliders with locks; each group always totals 100%.
- Reuses DSH credential references; API keys never reach the browser.
- Read-only recommendation tool and approval-gated agent switching tool.
- Live Chinese/English UI following the DSH locale.

## Screenshots

| Provider ranking | Settings and credential status |
| --- | --- |
| Compare provider cost and performance for the same model, then click a row to switch. | Linked scoring weights and a cache-heavy global price model. |
| <img src="./docs/images/provider-panel.png" alt="Provider advisor panel" width="100%"> | <img src="./docs/images/settings-weights.png" alt="Provider advisor settings" width="100%"> |

> Uptime is OpenRouter's trailing 30-minute statistic. Fresh failures, rate limits, and recoveries may be detected with a delay; this is not an active health probe.

## Install

Requirements: DSH `0.1.1-rc.2` or newer, Node.js `^22.19.0` or `>=24`, and an OpenRouter provider/API key configured in **DSH Settings → Models**.

```bash
dsh plugin --profile web add dsh-openrouter-provider-advisor@latest
```

Hard-refresh (`Cmd/Ctrl + Shift + R`). Restart `dsh web` if its Host half was already running.

```bash
# Update
dsh plugin --profile web add dsh-openrouter-provider-advisor@latest

# Remove
dsh plugin --profile web remove dsh-openrouter-provider-advisor
```

## Use

Open a normal DSH session, click **OpenRouter Providers** in the left footer, pick a model and strategy, then click a provider. The next request uses `@preset/<model>-<provider>`.

```text
create/update OpenRouter preset
        ↓
upsert DSH OpenRouter model entry
        ↓
session.selectModel
        ↓
save the DSH default model
```

An already assembled request is not rewritten mid-flight.

## Ranking

Best overall defaults to 30% quantization, 30% speed, 30% price, and 10% context. Cache-heavy cost is:

```text
cost = input price × 2% + output price × 8% + cache-read price × 90%
```

| OpenRouter trailing 30-minute uptime | Score retained |
| --- | ---: |
| ≥99.5% | 100% |
| 99–99.5% | 85% |
| 97–99% | 60% |
| 90–97% | 30% |
| <90% | 5% |
| Missing | 70% |

Endpoints with nonzero status are excluded. User settings may make penalties stricter, never looser.

## Credentials and security

- Reuses the selected DSH OpenRouter profile's `apiKeyEnv`, with `OPENROUTER_API_KEY` as a compatibility fallback reference.
- Credential values stay Host-only and never appear in client code, HTTP responses, or settings.
- Mutation routes accept same-origin JSON only and cap bodies at 64KB.
- Reads time out after 15 seconds; preset writes after 30 seconds.
- Agent-initiated switching always uses native DSH approval.
- The plugin does not read conversation messages, history, or workspace files.

## Data sources and limits

Only official OpenRouter APIs are used: `/models`, `/models/{id}/endpoints`, and `/presets/{slug}/chat/completions`. The plugin does not scrape product pages. OpenRouter statistics may lag fresh upstream failures and recoveries.

## Development

```bash
git clone https://github.com/xuanfengtechx/dsh-openrouter-provider-advisor.git
cd dsh-openrouter-provider-advisor
npm install
npm run verify
npm pack --dry-run
```

Automated tests stop before a real provider click because switching creates or versions an actual OpenRouter preset.

## License

[MIT](./LICENSE)
