# config-persistence Specification

## Purpose

定义 pmcp 如何为每个受支持的客户端读写项目级 MCP 配置，在保证跨格式状态一致的同时不破坏无关配置。

## Requirements

### Requirement: Claude Code 配置格式
pmcp SHALL 按 Claude Code 期望的结构（以服务器名为 key 的 `mcpServers` 对象）读写 `.mcp.json`，使 Claude Code 可直接消费其结果。每个注册表条目的定义按 spawn 形态生成：本地条目写 `command`/`args`/`env`（stdio，不写 `type` 字段）；远程条目写 `type`（`http`、`sse`、`ws` 之一）与 `url`。

#### Scenario: 保存启用项到 .mcp.json
- **WHEN** 用户确认勾选了若干本地注册表服务器，且 `.mcp.json` 是受管文件
- **THEN** `.mcp.json` 的 `mcpServers` 中恰好包含这些注册表服务器，且启动定义合法

#### Scenario: 保存远程条目到 .mcp.json
- **WHEN** 注册表存在远程条目（canonical 含 `url` 与 `type: "http"`），用户勾选并确认
- **THEN** `.mcp.json` 的 `mcpServers` 中写入 `{"type": "http", "url": ...}`，且条目合法可被 Claude Code 消费

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

### Requirement: 启用集合是既有文件的并集
当两种格式的配置文件都已存在时，pmcp SHALL 在任一文件出现某注册表服务器时将其视为当前已启用；保存后 SHALL 使每个受管文件的注册表条目与最终选择保持一致。

#### Scenario: 服务器只存在于一个文件
- **WHEN** `.mcp.json` 声明了 "git" 而 `opencode.json` 没有，用户未改动勾选直接确认，且两个文件都受管
- **THEN** 保存后 `.mcp.json` 与 `opencode.json` 都以各自格式包含 "git"

### Requirement: 禁用服务器时从受管文件移除
当用户取消勾选一个此前已启用的注册表服务器时，保存 SHALL 从每个受管配置文件中移除该服务器的条目。

#### Scenario: 取消勾选并保存
- **WHEN** "github" 当前在 `.mcp.json` 中启用，用户取消勾选并确认
- **THEN** `.mcp.json` 中不再包含 "github" 条目

### Requirement: 写出合法 JSON 并保留未知内容
pmcp SHALL 写出格式良好的 JSON，并且 SHALL NOT 修改或删除它不管理的服务器条目与对象键；对受管条目中与启动定义无关的额外字段（含远程条目的 `headers`、`oauth`、`timeout` 等）SHALL 在重写时保留。

#### Scenario: 与手工编辑共存
- **WHEN** 用户手动在某个既有服务器定义里加了未文档化的键，而 pmcp 之后保存的选择未涉及该服务器
- **THEN** 该手工定义（含未文档化的键）原样写回

#### Scenario: 远程条目的附加字段保留
- **WHEN** `.mcp.json` 的受管远程条目除 `type`/`url` 外还带 `headers` 与 `timeout`，用户保存未改动该条目
- **THEN** 该条目的 `headers` 与 `timeout` 保持不变，仅 pmcp 重新生成的部分保持与注册表一致

### Requirement: 不产生空壳文件
当保存的选择中没有任何启用服务器时，pmcp SHALL NOT 创建此前不存在的配置文件；对已存在的受管文件，pmcp SHALL 保留文件本身，仅让其中受管注册表段落为空。

#### Scenario: 全部取消勾选（文件已存在）
- **WHEN** `.mcp.json` 已存在且含一个受管服务器，用户取消所有勾选并确认
- **THEN** `.mcp.json` 仍存在，`mcpServers` 为空对象

#### Scenario: 新项目未选任何服务器
- **WHEN** 没有任何配置文件，用户以零选中确认
- **THEN** pmcp 不创建任何配置文件
