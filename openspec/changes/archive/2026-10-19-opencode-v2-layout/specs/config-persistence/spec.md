# Spec Delta

## MODIFIED Requirements

### Requirement: OpenCode 配置格式
pmcp SHALL 按 OpenCode 期望的结构读写 `opencode.json`，并保留 `opencode.json` 中所有其他顶层键。OpenCode 存在新旧两种布局：旧版在 `mcp` 下直接以服务器名为 key（条目用 `enabled` 布尔标志）；新版在 `mcp.servers` 下以服务器名为 key（条目用 `disabled` 布尔标志，默认 `false` 即启用）。pmcp SHALL 在读取时自动识别两种布局，并在写回时保留文件既有布局；对全新创建的 `opencode.json`，pmcp SHALL 使用新版 `mcp.servers` 布局并写入 `"$schema": "https://opencode.ai/config.json"`。本地条目写 `type: "local"` 与 `command` 数组；远程条目统一写 `type: "remote"` 与 `url`，传输类型由 `url` 的 scheme 由 OpenCode 端判定，不额外区分 http/sse/ws。旧版本地条目用 `enabled: true`，新版本地条目用 `disabled: false`；远程条目同理。

#### Scenario: 保存启用项到旧版 opencode.json
- **WHEN** 用户确认勾选了某个本地注册表服务器，且 `opencode.json` 是受管文件并采用旧版 `mcp` 直接布局
- **THEN** `opencode.json` 的 `mcp` 中包含合法 local MCP 定义的该服务器（含 `enabled: true`），且与 `mcp` 无关的键（如 `$schema`、provider 设置）保持不变

#### Scenario: 保存启用项到新版 opencode.json
- **WHEN** 用户确认勾选了某个本地注册表服务器，且 `opencode.json` 是受管文件并采用新版 `mcp.servers` 布局
- **THEN** `opencode.json` 的 `mcp.servers` 中包含合法 local MCP 定义的该服务器（含 `disabled: false`），且 `mcp` 下的 `timeout` 等保留键与顶层键保持不变

#### Scenario: 全新 opencode.json 使用新版布局
- **WHEN** 项目中不存在 `opencode.json`，用户勾选某服务器并确认写入 OpenCode 格式
- **THEN** pmcp 新建的 `opencode.json` 使用 `mcp.servers` 布局并包含 `"$schema": "https://opencode.ai/config.json"`

#### Scenario: 保存远程条目到 opencode.json
- **WHEN** 注册表存在远程条目（canonical 含 `url` 与 `type`），用户勾选并确认
- **THEN** `opencode.json` 的 `mcp`（或 `mcp.servers`）中写入 `{"type": "remote", "url": ...}`，不被写成 local 命令定义
