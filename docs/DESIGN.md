# DSH OpenRouter 供应商推荐与一键切换

日期：2026-08-24  
状态：已实现并验证  
包名：`dsh-openrouter-provider-advisor`  
形态：外部组合包（bundle），不是 `deepseek-harness` 仓库内的 first-party 包

## 1. 问题

DSH 通过 OpenRouter 调用同一模型时，上游供应商（Novita、CoreWeave、DeepInfra 等）在量化、速度、价格、上下文上差别很大。现在切换方式是：人手建 OpenRouter preset、改 `~/.dsh/settings.yaml`、再改默认模型。成本高，也容易选错。

本插件要做两件事：

1. 针对**当前 DSH 模型**（一般已在模型列表里，名称可能带供应商后缀），从 OpenRouter 拉该模型的全部上游，按量化 / 速度 / 价格 / 上下文排出 **Top 5**。
2. 用户在插件列表里点选一家后，**自动把当前供应商切过去**，下一轮请求走新上游。

参考产品页（给人看排版与字段，不作为数据源）：

https://openrouter.ai/deepseek/deepseek-v4-flash-0731

数据源是同一份官方 API：

```
GET https://openrouter.ai/api/v1/models/{author}/{slug}/endpoints
```

不抓该页 HTML，不解析 DOM。页面改版不影响插件。

## 2. 目标与非目标

### 2.1 目标

- 默认对**当前会话**已选模型做推荐；也可在菜单里换 DSH 目录里的另一条 OpenRouter 模型。
- 智能对齐 DSH 模型 id / 显示名到 OpenRouter `author/slug`（去掉 `@preset/`、供应商后缀等）。
- 硬过滤上下文过短（默认 &lt; 100,000 tokens）和不可用 endpoint。
- 综合四维打分，推荐 **Top 5**；完整合格列表可展开点选。
- 点选后：upsert OpenRouter preset → upsert DSH 模型条目 → `session.selectModel` 切当前会话 → `agentDefaultModel.saveSelection` 切默认。
- 人机共用同一套 Directory：人走左侧栏底部“供应商”面板，模型走两个 `defineTool`。
- 打分权重、上下文下限可配置，不硬编码。

### 2.2 非目标（第一版）

- 不爬 OpenRouter HTML。
- 不推荐「换一个模型」（例如 Flash → Pro）。只给**当前这条模型**换供应商。
- 不自动定时切换。
- 不把选择写入 session 事件 / Conversation Node（避免污染对话日志）。
- 不为 30 家供应商各建一条 `openrouter-xxx` DSH 路由。
- 不接 BYOK、非 OpenRouter 网关。
- 不为子代理会话提供独立选择（与官方 `/model` 一致：addressed subagent 不可用）。

## 3. 官方扩展点对照

依据 [扩展示例 cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.zh.md)、[第一个插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.zh.md)、[打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)、[设置卡片](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-settings-card.zh.md)、[开发一个工具](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.zh.md)。

| 产品能力 | 机制 | 不采用 |
|---|---|---|
| Agent 查询 / 切换 | `ctx.tools.register(defineTool)` | — |
| 人在列表里点选 | Client `sidebar.footer.action` + `shell.overlay` | Conversation Node、输入框命令 |
| 打分权重、上下文下限 | `Config` + `installSettingsSection` + `settings.plugin.item` 卡片 | 硬编码 |
| 真正换模型 | `session.selectModel` + `ctx.agentDefaultModel.saveSelection` | 只改 yaml 不通知会话 |
| 生命周期 | 全部注册放进 `ctx.effect` | 手工 removeListener |
| Host↔Client 数据 | Host `webServer` 前缀 API（外部插件已验证路径） | 浏览器直持 OpenRouter Key |

Conversation Node 只服务于聊天时间线里可回放事件。供应商列表是控制面，不是对话内容。

## 4. 包与安装

### 4.1 目录

```
dsh-openrouter-provider-advisor/
  package.json
  cordis.patch.yml
  tsconfig.json
  src/
    index.ts                 # Host apply
    config.ts                # Config schema + settings ns
    directory.ts             # OpenRouterProviderDirectory
    resolve-model.ts         # DSH 名 → OpenRouter id
    score.ts                 # 过滤 + 打分
    apply-provider.ts        # preset + settings + selectModel
    openrouter.ts            # endpoints / presets HTTP
    tools.ts                 # 两个 defineTool
    host-routes.ts           # /api/openrouter-providers
    client/
      index.ts               # sidebar panel + 设置卡片
      provider-panel.ts
      provider-panel-store.ts
      settings-card.ts
  docs/
    DESIGN.md                # 本文
```

### 4.2 manifest

`package.json` 关键字段：

```json
{
  "name": "dsh-openrouter-provider-advisor",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" }
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-sidebar",
        "@deepseek-ai/dsh-client-ui-settings-plugins"
      ]
    }
  }
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: openrouter-providers
      name: dsh-openrouter-provider-advisor
      config: {}
```

安装：

```bash
dsh plugin --profile web add dsh-openrouter-provider-advisor@latest
```

开发期可用 super-injector 热注入，或 `dsh web --patch ./cordis.patch.yml`。

### 4.3 Host 依赖

```
export const name = 'openrouter-providers'
export const inject = [
  'tools',
  'settings',
  'llm',
  'credentials',
  'agentDefaultModel',
  'webServer',
]
```

Client：

```
export const inject = [
  'commandUi', 'connection', 'slots', 'settingsScope', 'sessions', 'locale', 'remote',
]
```

## 5. 架构

```
当前会话 (provider, model, reasoningEffort)
        │
        ▼
  resolveModel()  ──►  OpenRouter author/slug
        │
        ▼
  GET /v1/models/{id}/endpoints   （缓存 5 分钟）
        │
        ▼
  filter + score  ──►  ranked[] ，head = Top 5
        │
   ┌────┴────┐
   ▼         ▼
 sidebar panel  recommend_openrouter_providers
 面板点选       工具返回规范 JSON
   │         │
   └────┬────┘
        ▼
  applyProvider(tag)
        │
        ├─ upsert OpenRouter preset（order=[tag], allow_fallbacks=false）
        ├─ upsert llm-pi-ai 路由上的 @preset/{slug} 模型
        ├─ session.selectModel({ provider, model, reasoningEffort })
        └─ agentDefaultModel.saveSelection(...)
```

角色命名（cookbook）：本能力是 **Directory**——暴露供发现/选择的条目及其元数据。类名 `OpenRouterProviderDirectory`。不叫 Runtime、Adapter、Gateway。

## 6. 模型对齐

输入来自当前会话的 `session.models.current`，或工具参数里显式给出的 DSH `(provider, model)`。

### 6.1 归一化

对 DSH `model` id / 显示名依次：

1. 去掉前缀 `@preset/`。
2. 按已知供应商别名表从右剥后缀。别名来自 OpenRouter endpoint `tag` 的第一段，外加 DSH 侧习惯写法。

| 别名（大小写不敏感） | 对应 OpenRouter tag 前缀 |
|---|---|
| novita, novitaai | novita |
| coreweave | coreweave |
| deepinfra | deepinfra |
| silflow, siliconflow | siliconflow |
| or, openrouter | （仅剥后缀，不参与供应商钉扎） |

分隔符按 `[-_.·/ ]` 及全角点号切。例如：

- `@preset/deepseek-v4-flash-0731-deepinfra` → `deepseek-v4-flash-0731`
- `DeepSeek V4 Flash 0731 · DeepInfra` → `DeepSeek V4 Flash 0731`

### 6.2 对 OpenRouter 目录

对 `GET /api/v1/models` 的 `data[].id` / `name`：

1. **精确**：归一化结果等于某个 `id`，或等于去掉 `author/` 后的 slug。
2. **稳定片段**：归一化结果包含 `flash-0731`、`v4-pro` 这类版本片段，且 author 能从 DSH 显示名或 id 猜到（`deepseek`、`qwen`、`anthropic`…）。多命中时取最长公共 slug。
3. **显示名模糊**：lowercase、去空格、去标点后，DSH name 与 OpenRouter name 互相包含。

DSH `session.models` 的源 provider/name 作为 author hint 参与消歧；同一基础模型同时存在普通版与 `:batch` 等变体时，优先 compact slug 完全相等的普通版。

命中唯一则采用。多命中且无法用当前 preset 的上游模型消歧（preset 配置里的 `config.model`）→ 菜单列出候选，不自动切。零命中 → 「当前模型不在 OpenRouter」。

非 OpenRouter 路由（`local`、`lmstudio-*`、直连 `openai` 且 baseURL 不是 openrouter.ai）直接判为不可推荐，不发网络请求。

判断「这是 OpenRouter 路由」：该 DSH provider 的 `baseURL` 含 `openrouter.ai`，或模型 id 以 `@preset/` 开头。

## 7. Endpoint 数据与缓存

### 7.1 请求

```
GET https://openrouter.ai/api/v1/models/{author}/{slug}/endpoints
Authorization: Bearer $OPENROUTER_API_KEY
```

Key 经 `ctx.credentials` 解 `OPENROUTER_API_KEY`。缺 Key：菜单/工具明确报「请配置 OPENROUTER_API_KEY」，不打 API。

使用的字段（与参考页表格对应）：

| API 字段 | 列表展示 |
|---|---|
| `provider_name` | 供应商名 |
| `tag` | 切换用身份，如 `deepinfra/fp8` |
| `quantization` | FP16 / FP8 / FP4 / unknown |
| `throughput_last_30m.p50` | tokens/s |
| `latency_last_30m.p50` | 仅展示，不进默认分数 |
| `pricing.prompt` / `completion` / `input_cache_read` | $/M tokens（API 是每 token，展示时 ×1e6） |
| `context_length` | 上下文 |
| `status` | 0 = 可用 |
| `uptime_last_30m` | 展示；&lt; 99% 降权，不直接剔除 |

`tag` 是切换主键。OpenRouter preset 的 `provider.order` 写入该 tag（与现网 `novita/fp8`、`coreweave/fp8`、`deepinfra/fp8` 一致）。

### 7.2 缓存

进程内按 `{orModelId}` 缓存完整 endpoints，TTL **300s**。打分结果不单独缓存（权重改了要立刻变）。切换不依赖缓存新鲜度；需要强制刷新时菜单提供「刷新」。

## 8. 过滤与打分

### 8.1 硬过滤

丢掉：

- `status !== 0`
- `context_length < minContextTokens`（默认 `100_000`）

剩余为「合格列表」。合格不足 5 家则 Top 5 有几家算几家，不放宽过滤去凑数。

### 8.2 四维分数（0–100）

在**合格集合内部**归一，避免被已过滤的廉价短上下文 endpoint 带偏。

**量化 `S_q`**

| quantization（大小写不敏感） | 分 |
|---|---|
| bf16 / fp16 | 100 |
| fp8 | 80 |
| fp4 | 45 |
| 其他 / unknown / 空 | 40 |

默认更偏 FP8/FP16，不把 FP4 当第一推荐，除非速度和价格把总分抬上去。

**速度 `S_s`**

`tps = throughput_last_30m.p50`（缺省当 0）。合格集 min-max：

```
S_s = 100 * (tps - min) / (max - min)
```

全员相同则 100。

**价格 `S_p`**

先把 API 每 token 价换成 $/M。综合成本：

```
C = w_in * input + w_out * output + w_cache * cache_read
```

默认 `w_in=0.02`，`w_out=0.08`，`w_cache=0.90`，按 Code Agent 长会话中绝大多数输入 token 命中 cache 的负载建模。缺 cache 字段当 0。

```
S_p = 100 * (C_max - C) / (C_max - C_min)
```

全员相同则 100。越便宜越高。

**上下文 `S_c`**

过了 10 万门槛后只做弱加分：

```
S_c = 100 * clamp( (ctx - 100_000) / (1_048_576 - 100_000), 0, 1 )
```

256k ≈ 17，1M = 100。权重默认只有 0.10，不当主排序。

### 8.3 合成

```
S = W_q * S_q + W_s * S_s + W_p * S_p + W_c * S_c
```

默认权重：

| 键 | 默认 |
|---|---|
| `weights.quantization` | 0.30 |
| `weights.speed` | 0.30 |
| `weights.price` | 0.30 |
| `weights.context` | 0.10 |

加载时校验四项之和为 1.00±0.001，否则拒绝写入（settings `validate`）。

uptime &lt; 99%：总分 × 0.85。不剔除，避免把偶发抖动的快供应商直接踢出 Top 5。

### 8.4 Top 5

按 `S` 降序；同分比 `S_s`，再比 `S_p`，再比 `provider_name`。

返回结构：

- `recommended`: 前 5 条
- `rest`: 其余合格
- 每条带 `rank`、`score`、`reasons[]`（最多 3 条短理由，如 `fp8`、`110 t/s`、`$0.08/$0.18`）

当前正在使用的 tag（从 preset `order[0]` 或模型 id 后缀反推）加 `current: true`，即使它不在 Top 5 也在列表里标出。

## 9. 点选切换

与现网手动切 Novita → CoreWeave → DeepInfra 同一条链路，一次点击做完。

### 9.1 Upsert OpenRouter preset

```
POST /api/v1/presets/{slug}/chat/completions
```

- slug：`{or-slug}-{tag-first-segment}`，例如 `deepseek-v4-flash-0731-coreweave`
- body：`model` = OpenRouter id；`provider.order` = `[tag]`；`allow_fallbacks` = `false`；`messages` 仅满足 preset API，不写入 system prompt
- 已存在则发新 version，覆盖 designated version

Preset 是钉供应商的唯一事实来源。DSH 模型 id 指向 `@preset/{slug}`。

### 9.2 Upsert DSH 模型

复用当前这条 OpenRouter 路由（`baseURL` 含 `openrouter.ai` 的 provider）。不新建 `openrouter-coreweave` 这类路由。

对该路由的 `llm-pi-ai.providers.<route>.models`：

- 若已有 `@preset/{slug}`：只更新 `name`、`contextWindow`（写成该 endpoint 的 `context_length`）
- 若无：追加一条，`compat.thinkingFormat: openrouter`，`reasoningEfforts` 复制该路由现有 Flash 模型的声明（`off/high/max`）；没有可抄的则只声明 `off` + `high`

通过 `ctx.settings.mutate('llm-pi-ai', ops)` 写入。变更 live 生效，无需重启。

路由 key 保持现有名字（例如 `openrouter-deepinfra`）。显示名可在首次安装插件时改成 `OpenRouter`，第一版**不强制改名**，避免打扰已有选择器。

### 9.3 切当前会话与默认

```
session.selectModel({
  sessionId,
  provider: <该 OpenRouter 路由 key>,
  model: '@preset/' + slug,
  reasoningEffort: <当前会话 effort，若新模型仍支持；否则该模型默认>
})
```

随后：

```
ctx.agentDefaultModel.saveSelection({
  provider,
  model: '@preset/' + slug,
  reasoningEffort,
})
```

语义（官方）：

- 进行中的 step 仍用已组装的旧选择。
- 下一轮请求用新选择。
- 已有会话的 request log 一旦记下某次选择，前缀可复用；换供应商可能使 **provider 侧 KV cache 失效**。本插件拥有这次失效，README 必须写明。
- 子代理会话拒绝切换。

### 9.4 失败原子性

顺序：preset 成功 → settings 成功 → selectModel。任一步失败：

- preset 已建：留下新 preset，无害（旧会话仍指向旧 slug）
- settings 已改、selectModel 失败：默认可能已变、当前会话没变；返回错误并提示刷新 `/model`
- 不回滚 preset（OpenRouter 无稳定 delete 作为第一版范围）

## 10. Host HTTP 与工具

### 10.1 HTTP（Client 用）

前缀 `/api/openrouter-providers`，经 `ctx.webServer.register`，仅 loopback / 已认证 web 同源（与 web 应用同一信任域）。

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/models?sessionId=` | 返回 DSH `session.models` 目录，并把每个目标模型映射到现有 OpenRouter 路由 |
| GET | `/recommend?sessionId=` | 当前会话模型的 ranked 列表 |
| POST | `/refresh` | 清该模型 endpoints 缓存并重拉 |
| POST | `/apply` | body: `{ sessionId, tag }`，执行 §9 |

GET 响应（示意）：

```json
{
  "ok": true,
  "dsh": { "provider": "openrouter-deepinfra", "model": "@preset/deepseek-v4-flash-0731-deepinfra" },
  "openrouterModel": "deepseek/deepseek-v4-flash-0731",
  "currentTag": "deepinfra/fp8",
  "recommended": [ { "tag": "…", "rank": 1, "score": 87.2, "providerName": "…", "quantization": "fp8", "tps": 110, "price": { "input": 0.13, "output": 0.28, "cache": 0.07 }, "contextLength": 262144, "reasons": ["fp8", "110 t/s"] } ],
  "rest": []
}
```

价格单位：展示用 **USD / 百万 tokens**。

### 10.2 工具（模型用）

`recommend_openrouter_providers`

- 参数：可选 `provider`、`model`（省略则用当前会话；工具执行上下文若无会话则报错）
- 输出：与 HTTP GET 相同的规范对象
- `output.render`：短文本，先列 Top 5 一行一个

`switch_openrouter_provider`

- 参数：`tag`（必填），可选 `sessionId`
- 输出：`{ ok, provider, model, tag, openrouterModel }`
- 未先 recommend 也可切，但 tag 必须属于该模型当前合格 endpoints

工具 UI 卡片只展示结果，不提供点击切换。人的点击入口只在左侧栏供应商面板。

## 11. Client UI

### 11.1 左侧栏供应商面板

- `sidebar.footer.action` 提供常驻“供应商”按钮；展开时强制换行占满一整行，位于其他 footer actions 下方与设置上方；侧栏折叠时只显示图标。
- `shell.overlay` 提供独立面板，绑定当前普通会话；addressed subagent 或无会话时入口禁用。
- 模型下拉读取与 DSH 自带选择器相同的 `session.models` 完整目录。目录模型用原始 id/name 对齐 OpenRouter，写入和切换仍复用已有 OpenRouter route；无法匹配的模型在面板显示明确错误。
- 打开时请求 GET `/recommend`，先渲染 `recommended`（标题「推荐 Top 5」），再渲染「其他合格供应商」。
- 每行文案：`{providerName} · {quant} · {tps} t/s · ${in}/${out} · {ctx}`，当前 tag 明确标记。
- 刷新按钮 POST `/refresh`；点选 POST `/apply` `{ sessionId, tag }`。
- 模型下方提供「综合最佳 / 价格优先 / 速度优先 / 上下文优先」四种临时策略。综合最佳使用设置页权重；其余分别使用 `10/10/70/10`、`15/65/10/10`、`15/10/10/65`（量化/速度/价格/上下文）。关闭面板重置为综合最佳，不写设置。
- 成功后刷新并关闭；失败保留面板并显示错误。
- 不注册 `/providers` 命令，也不占用 `conversation.input.model` keyed seat。

### 11.2 设置卡片

`settings.plugin.item` key = `openrouter-providers`。编辑：

- `minContextTokens`
- `weights.*`
- `priceBlend.*`（input/output/cache 权重，和须为 1）
- `uptimePenaltyThreshold` / `uptimePenaltyFactor`

`installSettingsSection` 的 `validate` 拒绝非法权重。变更 `applies: 'live'`，下一轮 recommend 即用新权重。

## 12. 配置

```ts
export const NS = settingsNamespace('openrouter-providers')

export interface Config {
  minContextTokens: number
  cacheTtlMs: number
  recommendedCount: number
  weights: { quantization: number; speed: number; price: number; context: number }
  priceBlend: { input: number; output: number; cache: number }
  uptimePenaltyThreshold: number
  uptimePenaltyFactor: number
}

// 默认
minContextTokens: 100_000
cacheTtlMs: 300_000
recommendedCount: 5
weights: { 0.30, 0.30, 0.30, 0.10 }
priceBlend: { 0.02, 0.08, 0.90 }
uptimePenaltyThreshold: 99
uptimePenaltyFactor: 0.85
```

`recommendedCount` 默认 5，可配，范围 1–10。产品文案固定说「推荐 Top 5」，与默认一致。

OpenRouter Key **不**进本插件 Config。插件优先读取当前 DSH OpenRouter provider profile 的 `apiKeyEnv` 并通过 credentials service 解析；旧配置没有可用 provider credential 时，兼容回退 `OPENROUTER_API_KEY`。客户端状态接口只返回 reference 与 configured 状态，绝不返回值。

## 13. 错误对照

| 情况 | 表现 |
|---|---|
| 无 OPENROUTER_API_KEY | 菜单/工具：请到凭据里配置 |
| 当前路由不是 OpenRouter | 「当前模型不在 OpenRouter，无法推荐供应商」 |
| 模型名对不上 | 「无法匹配 OpenRouter 模型」，附归一化后的 slug |
| 多命中无法消歧 | 列出候选 id，不切换 |
| 合格列表为空 | 「没有满足上下文下限的可用供应商」 |
| endpoints HTTP 非 2xx | 展示上游错误，保留上次缓存（若有） |
| preset 创建失败 | 不改 DSH settings / 会话模型 |
| selectModel 失败 | 返回错误；settings 可能已写入，提示用 `/model` 手选新 preset |

## 14. Model Experience

间接。途径：

- 两个工具的 schema 进入系统提示词工具表。
- `switch_openrouter_provider` 改变后续请求的 `provider/model`。不改写当前 step 已组装请求。
- 侧栏面板的文案和错误 **不进入** session 日志。

KV Cache：换 OpenRouter 供应商会使 **provider 侧**前缀缓存失效。DSH 侧 prompt 前缀不变。由本包的 `applyProvider` 拥有这次失效。

## 15. 测试

行为测试，不 mock 掉打分公式：

1. **resolve-model**：`@preset/deepseek-v4-flash-0731-deepinfra`、带 `· DeepInfra` 的显示名、LM Studio 路由、多命中。
2. **score**：给定固定 endpoints fixture（可从现网 V4 Flash 0731 截一版），断言 Top 5 稳定、ctx&lt;100k 被过滤、权重和校验。
3. **apply-provider**：preset POST 被调用的 body（`order`/`allow_fallbacks`）、settings mutate 路径、selectModel 参数；preset 失败时 settings 不被调用。
4. **tools**：规范 JSON 含 `recommended.length <= 5`。

不强制第一版 E2E 打真实 OpenRouter（依赖 Key 与账单）；fixtures 覆盖主路径。可另做手动冒烟：对当前 Flash 0731 跑 recommend，确认 `provider` 字段与点选后的一次最小 chat 一致。

## 16. 实现顺序

1. `resolve-model` + `score` + fixtures  
2. `openrouter.ts`（endpoints + preset）  
3. `apply-provider`（settings + selectModel + saveSelection）  
4. Host routes + Directory  
5. 两个工具  
6. 左侧栏 trigger + overlay  
7. 设置卡片  
8. 打包 `dsh.bundle`，用 web profile 安装冒烟  

## 17. 已知限制

- 人工入口是左侧栏底部常驻按钮；composer 旁无按钮，也无 `/providers` 命令。
- 不删除旧 preset；多次切换会在 OpenRouter 账号留下多个 slug。
- 不改已有 DSH 路由 key 名称（可能仍叫 `openrouter-deepinfra`）。
- OpenRouter `/models` 列表较大，匹配在 Host 做；可把 id/name 做成内存索引，不必每次全量模糊。
- `throughput_last_30m` 是 OpenRouter 近 30 分钟统计，不是 SLA。
- 量化分是序数偏好，不是质量评测。

## 18. 以后可以做、现在不做

- composer 旁当前供应商胶囊  
- 把路由显示名统一成 `OpenRouter`  
- 清理未再引用的旧 preset  
- 对非 OpenRouter 的 OpenAI 兼容网关做同类推荐  
- 按「编码 / 长上下文 / 最便宜」预设权重档位  
