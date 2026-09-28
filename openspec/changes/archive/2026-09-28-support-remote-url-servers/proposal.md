# Proposal

## Why

`pmcp register` 与 `pmcp init` 目前对仅含 `url` 的远程服务器一律"跳过并提示"（AGENTS.md 将其列为 v1 Non-Goal）。但远程 URL 服务器是标配形态（如各类 SaaS MCP），用户无法把它们登记进注册表复用，只能手写 `~/.pmcp/registry.json`。此外 `type` 词汇在两种客户端间不一致（opencode 的 `local`/`remote` 扁平抽象 vs claude 的 `stdio`/`http`/`sse`/`ws`）导致跨格式误判（把 `type:"local"` 的 `.mcp.json` 条目误报为"远程不支持"）。本次变更让远程 URL 服务器成为一等公民：可归一、可登记、可写回两侧，同时统一两客户端的 `type` 映射。

## What Changes

- **canonical 双形态**：注册表条目从单一 `{command, args?, env?}` 扩展为本地/远程两形态 —— 本地 `{command, args?, env?}`、远程 `{url, type}`（`type` ∈ `"http" | "sse" | "ws"`，用 claude 词汇保真，写回时映射到 opencode 的 `remote`）。
- **读入归一**：`collectGlobalEntries` / `collectProjectEntries` 对远程条目不再跳过 —— claude 侧 `type:"http"/"streamable-http"/"sse"/"ws"` 归一为 `{url,type}`；opencode 侧 `type:"remote"` 归一为 `{url, type}`（`wss://`→`ws`，否则 `http`）。`type:"local"` 与 `stdio` 归一向本地。仅 `sdk`/`plugin` 等无网络对应的类型才跳过并明确提示。
- **写回生成**：canonical 远程 → claude 写 `{"type": <http|sse|ws>, "url": ...}`；opencode 写 `{"type":"remote", "url": ...}`。本地形态写回保持不变（AGENTS.md 落盘规则更新）。
- **跨格式 type 映射统一**：用一张表定义 `opencode ↔ claude ↔ canonical` 的 type 对应，消除"`type:"local"` 被误判为远程"的误导性跳过。
- **各流程适配双形态**：`loadRegistry`/`normalizeUserEntry`、`mergeIntoRegistry` 的 `sameLaunchDef` 比较、`readState`/`save`（checkbox 启用、写回）全部识别并正确处理解析后的远程条目；`registryEntryToFile` 保留并发含远程字段。
- **删除 Non-Goal 约束**：AGENTS.md 移除"远程服务器类型是 v1 的 Non-Goal"与 Invariant 5 措辞改为"仅无网络对应的类型（sdk/plugin）跳过并提示"。
- **跳过原因不再一刀切**：跳过提示拆分——真远程不再跳过；仅 `sdk`/`plugin`/未知 type/形状不合法才跳过，提示指明真实原因（en/zh 成对）。
- **BREAKING**：`~/.pmcp/registry.json` 的 canonical 定义新增远程形态（含 `url`/`type`）。既有本地条目（含 command）向后兼容、正常加载；远程条目此前无法写入，故无存量迁移问题。

## Capabilities

### New Capabilities

无新增能力目录。远程支持横切现有能力，在既有 spec 内新增/修改 requirement，符合项目现有的扁平能力组织。

### Modified Capabilities
- `config-persistence`: "Claude Code 配置格式"与"OpenCode 配置格式"两个 requirement 需将写回规则从"仅本地命令定义"扩展为本地+远程双形态（`.mcp.json` 写 `http/sse/ws`，`opencode.json` 写 `remote`）；"写出合法 JSON 并保留未知内容"的读改写范围需覆盖远程条目。
- `interactive-server-selection`: "用户级注册表文件"requirement 中 canonical 定义从 `command/args/env` 单形态改为本地/远程双形态；`pmcp init` 与 `pmcp register` 两个 requirement 中"无法归一的条目（如仅含 `url` 的远程服务器）跳过并提示"改为"远程 URL 条目归一为 `{url,type}` 并收录，仅无网络对应的类型（sdk/plugin）跳过并提示"。

## Impact

- **代码**：`src/model.js` —— canonical 双形态 + type 映射表 + 本地/远程双向归一与写回生成（`toCanonicalFromClaude/Opencode`（或新 `toCanonicalFromRemote`）、`canonicalToClaude/Opencode`、`sameLaunchDef`、`registryEntryToFile`）；`src/sources.js` —— 远程条目收集与跳过原因分类；`src/registry.js` —— `normalizeUserEntry`/`mergeIntoRegistry` 适配双形态；`src/persistence.js` —— `readState`/`save` 对远程条目的启用识别与写回；`src/i18n.js` —— 新增远程相关文案（en+zh 成对，源码不出现 CJK）；`src/index.js` —— re-export 兼容面若有新增函数需补。
- **文档**：`AGENTS.md`（删除远程 Non-Goal、更新 Invariant 5 措辞、注册表数据格式示例、落盘生成规则、非 TTY 说明）；`README.md` / `README_ZH.md`。
- **依赖**：零新依赖。
- **兼容性**：本地条目与既有注册表文件完全向后兼容；无存量远程条目（此前被跳过）。**BREAKING** 仅体现在 canonical 允许的新字段上。
