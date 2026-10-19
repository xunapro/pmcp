# Design

## Context

现状见 proposal.md。`src/model.js` 只识别 OpenCode 旧版布局：`TARGETS.opencode.section` 固定为 `'mcp'`，`sources.js` / `persistence.js` 一律用 `parsed['mcp']` 作为服务器容器，`canonicalToOpencode` 硬编码 `enabled: true`。最新版 OpenCode 的 `mcp.servers` 布局会把服务器挂在 `mcp.servers` 下，并用 `disabled`（默认 `false` 即启用）代替 `enabled`；旧逻辑读不到 `mcp.servers` 下的服务器，写回时也会把 `mcp.servers` 当普通键、并写出不被新版 schema 接受的 `enabled` 字段。相关 spec 见 `specs/config-persistence` 与 `specs/interactive-server-selection` 的 delta。

## Goals / Non-Goals

**Goals:**
- 读入：自动识别 `opencode.json` 的新旧两种布局，两种都能正确导入（`collectGlobalEntries` / `collectProjectEntries`）。
- 写回：保留文件既有布局——旧版写 `mcp` 直接布局（`enabled: true`），新版写 `mcp.servers`（`disabled: false`）；全新文件默认新版 `mcp.servers` 并写 `$schema`。
- 保留 `mcp` 下的保留键（`timeout`、`servers`）与所有未受管键；`readState` / `removeFromProject` 同样识别两种布局。
- 保持 Invariant 1/2/3/4 完好、零新依赖、`require('src/index.js')` 兼容面不破坏。

**Non-Goals:**
- 不做新旧布局的自动迁移/升级：pmcp 只保留文件既有布局，不把旧版文件改写为新版。
- 不解析 `mcp.timeout`、`disabled`/`enabled` 语义：服务器是否启用仍按"容器中出现即启用"（与既有 spec 一致），pmcp 仅重写被管理条目的启动定义字段。
- 不改变交互/保存/取消流程的既有用户路径。

## Decisions

### D1: 布局识别以 `mcp.servers` 是否为对象为准
`opencodeLayout(doc)`：`mcp` 为对象且 `mcp.servers` 为对象 → `'v2'`，否则 `mcp` 存在 → `'v1'`，`mcp` 缺失 → `'v2'`（新文件默认最新版）。
替代方案（用 `enabled`/`disabled` 字段反推布局）被否：字段缺失时无法区分，且 `mcp.servers` 是唯一明确的结构信号。

### D2: 服务器容器用统一提取函数，读入时剔除 `mcp` 保留键
`opencodeServers(doc)`：`mcp.servers` 为对象时返回它（v2）；否则返回 `mcp`（v1）并剔除保留键 `timeout`/`servers`，避免把 `mcp.timeout` 误当服务器。返回 null 表示无容器。`sources.js` 与 `persistence.js` 的读取路径（`collectGlobalEntries`、`collectProjectEntries`、`readState`）统一改用它。

### D3: 写回用 `setOpencodeServers` 还原布局与保留键
`setOpencodeServers(doc, servers)`：按 `opencodeLayout(doc)` 决定写回位置——v2 写 `doc.mcp = { ...mcp, servers }`（保留 `timeout` 等），v1 写 `doc.mcp = { ...reserved, ...servers }`（`reserved` 为保留键）。`save` / `removeFromProject` 的写回路径统一改用它，避免直接改 `doc['mcp']`。

### D4: `canonicalToOpencode(entry, layout)` 按布局选 `enabled`/`disabled`
v1 用 `enabled: true`，v2 用 `disabled: false`。省略 `layout` 时默认 v1（`enabled: true`），保持对外 re-export 契约。v2 显式写 `disabled: false` 是为了覆盖既有条目里可能存在的 `disabled: true`（与 v1 中 `enabled: true` 覆盖 `enabled: false` 的语义对齐）。

### D5: `save` 对 OpenCode 走"提取容器 → 浅合并 → 写回容器"分支
`save` 内对 `key === 'opencode'` 单独处理：用 `opencodeServers` 取当前容器（v1 剔除保留键的副本），浅合并 `{ ...existingDef, ...generated }` 后经 `setOpencodeServers` 写回；新建文件时先写 `$schema`。Claude 分支保持 `doc['mcpServers']` 逻辑不变。`canonicalToOpencode` 的 `layout` 用 `opencodeLayout(doc)` 计算一次。

## Risks / Trade-offs

- [opencode `mcp.timeout` 在 v1 布局存在时被 `opencodeServers` 剔除、写回时由 `setOpencodeServers` 还原] → 已验证：v1 读入剔除 `timeout`、写回还原；v2 的 `mcp.timeout` 与 `mcp.servers` 并存，`{ ...mcp, servers }` 保留。
- [v2 布局下某服务器被用户手动设 `disabled: true`，pmcp 重写后变为 `disabled: false`（启用）] → 与既有 v1 行为（`enabled: false` → `enabled: true`）一致，且"容器中出现即启用"是既有 spec 语义，非本次引入。
- [混合布局（`mcp` 直接挂服务器同时又有 `mcp.servers`）] → 以 `mcp.servers` 为准（v2），直接挂的服务器保留但不被管理；极端边缘，接受。
- [`canonicalToOpencode` 省略 layout 的默认值为 v1] → 外部调用方若沿用旧签名得到 `enabled: true`，行为与旧版一致，无破坏。

## Migration Plan

- 无数据迁移：`opencode.json` 读入与写回均兼容新旧布局；注册表文件与 `canonicalToOpencode` 默认签名不变。
- 回滚：`npm run teardown` 卸包；项目文件由用户管理；`AGENTS.md` / README 恢复旧版单布局措辞即可回到旧语义。
- 文档随本变更落地（AGENTS.md 落盘规则与非 TTY 说明、README.md / README_ZH.md）。

## Open Questions

无阻塞项。已记录的取舍：新文件默认 v2 布局（最新版）；不自动把旧版文件升级为新版。
