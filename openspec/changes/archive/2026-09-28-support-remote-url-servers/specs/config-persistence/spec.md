# Spec Delta

## MODIFIED Requirements

### Requirement: Claude Code 配置格式
pmcp SHALL 按 Claude Code 期望的结构（以服务器名为 key 的 `mcpServers` 对象）读写 `.mcp.json`，使 Claude Code 可直接消费其结果。每个注册表条目的定义按 spawn 形态生成：本地条目写 `command`/`args`/`env`（stdio，不写 `type` 字段）；远程条目写 `type`（`http`、`sse`、`ws` 之一）与 `url`。

#### Scenario: 保存启用项到 .mcp.json
- **WHEN** 用户确认勾选了若干本地注册表服务器，且 `.mcp.json` 是受管文件
- **THEN** `.mcp.json` 的 `mcpServers` 中恰好包含这些注册表服务器，且启动定义合法

#### Scenario: 保存远程条目到 .mcp.json
- **WHEN** 注册表存在远程条目（canonical 含 `url` 与 `type: "http"`），用户勾选并确认
- **THEN** `.mcp.json` 的 `mcpServers` 中写入 `{"type": "http", "url": ...}`，且条目合法可被 Claude Code 消费

### Requirement: OpenCode 配置格式
pmcp SHALL 按 OpenCode 期望的结构（以服务器名为 key 的 `mcp` 对象）读写 `opencode.json`，并保留 `opencode.json` 中所有其他顶层键。本地条目写 `type: "local"` 与 `command` 数组；远程条目统一写 `type: "remote"` 与 `url`，传输类型由 `url` 的 scheme 由 OpenCode 端判定，不额外区分 http/sse/ws。

#### Scenario: 保存启用项到 opencode.json
- **WHEN** 用户确认勾选了某个本地注册表服务器，且 `opencode.json` 是受管文件
- **THEN** `opencode.json` 的 `mcp` 中包含合法 local MCP 定义的该服务器，且与 `mcp` 无关的键（如 `$schema`、provider 设置）保持不变

#### Scenario: 保存远程条目到 opencode.json
- **WHEN** 注册表存在远程条目（canonical 含 `url` 与 `type`），用户勾选并确认
- **THEN** `opencode.json` 的 `mcp` 中写入 `{"type": "remote", "url": ...}`，不被写成 local 命令定义

### Requirement: 写出合法 JSON 并保留未知内容
pmcp SHALL 写出格式良好的 JSON，并且 SHALL NOT 修改或删除它不管理的服务器条目与对象键；对受管条目中与启动定义无关的额外字段（含远程条目的 `headers`、`oauth`、`timeout` 等）SHALL 在重写时保留。

#### Scenario: 与手工编辑共存
- **WHEN** 用户手动在某个既有服务器定义里加了未文档化的键，而 pmcp 之后保存的选择未涉及该服务器
- **THEN** 该手工定义（含未文档化的键）原样写回

#### Scenario: 远程条目的附加字段保留
- **WHEN** `.mcp.json` 的受管远程条目除 `type`/`url` 外还带 `headers` 与 `timeout`，用户保存未改动该条目
- **THEN** 该条目的 `headers` 与 `timeout` 保持不变，仅 pmcp 重新生成的部分保持与注册表一致
