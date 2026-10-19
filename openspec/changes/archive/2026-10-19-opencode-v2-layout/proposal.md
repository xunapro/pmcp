# Proposal

## Why

`pmcp` 目前的导入（读取 `opencode.json`）与导出（写入 `opencode.json`）只支持 OpenCode 的旧版布局：服务器名直接挂在 `mcp` 下，条目用 `enabled` 布尔标志。最新版 OpenCode（`$schema: https://opencode.ai/config.json`）改用 `mcp.servers` 布局，条目用 `disabled` 布尔标志（默认 `false` 即启用）。旧逻辑会忽略新版 `mcp.servers` 下的服务器（导入漏项），并在写回时把 `mcp.servers` 当成一个普通服务器键、或把 `enabled`/`disabled` 字段写错，破坏新版配置。

## What Changes

- **读入兼容两种布局**：`collectGlobalEntries` / `collectProjectEntries` 读取 `opencode.json` 时自动识别——`mcp.servers` 为对象时读新版，否则读旧版 `mcp` 直接布局；保留 `mcp` 下的 `timeout` 等保留键不被误当作服务器。
- **写回保留既有布局**：`save` / `removeFromProject` 写回时保留文件既有布局——旧版写 `mcp` 直接布局（条目 `enabled: true`），新版写 `mcp.servers`（条目 `disabled: false`，显式覆盖已有的 `disabled: true`），并保留 `mcp.timeout` 等保留键与全部未受管键。
- **新文件默认新版**：全新创建的 `opencode.json` 使用新版 `mcp.servers` 布局，并写入 `"$schema": "https://opencode.ai/config.json"`。
- **`readState` 识别两种布局**：交互回显与 unregister 联动识别 `mcp.servers` / `mcp` 两种容器。
- **BREAKING**：无。既有旧版 `opencode.json` 与注册表文件完全向后兼容；本变更仅是扩大 `opencode.json` 的读写布局支持。

## Capabilities

### New Capabilities

无新增能力目录。OpenCode 双布局支持横切既有能力，在现有 spec 内修改 requirement。

### Modified Capabilities

- `config-persistence`: "OpenCode 配置格式" requirement 需扩展为"读取与写回时兼容新旧两种布局（`mcp` 直接 / `mcp.servers`），写回保留既有布局、新文件默认新版并写 `$schema`"；新增/改写相应 scenario。
- `interactive-server-selection`: `pmcp init` 的 requirement 中"OpenCode 用户级配置（`mcp` 键）"需更新为"（`mcp` 键，或新版 `mcp.servers` 键）"。

## Impact

- **代码**：`src/model.js` —— 新增 `opencodeLayout` / `opencodeServers` / `setOpencodeServers` 布局识别与容器读写助手，`canonicalToOpencode(entry, layout)` 增加布局参数（v1 用 `enabled: true`，v2 用 `disabled: false`）；`src/sources.js` —— `collectGlobalEntries` / `collectProjectEntries` 改用 `opencodeServers` 提取服务器容器；`src/persistence.js` —— `readState` / `save` / `removeFromProject` 识别并按布局读写 `opencode.json`；`src/index.js` —— re-export 兼容面新增三个布局函数。
- **文档**：`AGENTS.md`（落盘生成规则、非 TTY 说明）、`README.md` / `README_ZH.md`（OpenCode 段说明与生成规则）。
- **依赖**：零新依赖。
- **兼容性**：旧版 `opencode.json` 与既有注册表文件完全向后兼容；`canonicalToOpencode` 省略 `layout` 时仍默认旧版 `enabled: true`，对外 re-export 契约不变。
