# Spec Delta

## MODIFIED Requirements

### Requirement: 无配置时的目标格式选择
pmcp SHALL 在每次保存前询问用户要写入哪种（些）客户端格式，而不是在项目已存在受管配置文件时自动沿用这些文件。多选列表 SHALL 预选当前已在项目中受管的客户端格式；若项目没有任何受管文件，SHALL 默认预选全部受支持的客户端格式。pmcp SHALL 只写入被选中的客户端文件，未被选中的文件 SHALL 保持原样，不被创建、修改或删除。

#### Scenario: 新项目只选一种客户端
- **WHEN** 用户在没有任何 MCP 配置文件的项目中运行 `pmcp`，选中服务器后只选择 Claude Code 格式
- **THEN** pmcp 创建包含所选服务器的 `.mcp.json`，且不创建 `opencode.json`

#### Scenario: 既有项目预选受管格式
- **WHEN** 项目已存在受管的 `.mcp.json`（无 `opencode.json`），用户运行 `pmcp` 并直接确认默认预选
- **THEN** 目标格式多选列表预选 Claude Code 格式，保存后只更新 `.mcp.json`，`opencode.json` 不被创建

#### Scenario: 允许新增受管格式
- **WHEN** 项目已存在 `.mcp.json`，用户在目标格式多选列表中额外勾选 OpenCode 后确认
- **THEN** pmcp 同时写入 `.mcp.json` 与 `opencode.json`

#### Scenario: 允许取消既有受管格式
- **WHEN** 项目已存在 `.mcp.json` 与 `opencode.json`，用户在目标格式多选列表中取消勾选 OpenCode 后确认
- **THEN** pmcp 只更新 `.mcp.json`，`opencode.json` 原样保留
