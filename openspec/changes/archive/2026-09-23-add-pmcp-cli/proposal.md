# Proposal

## Why

MCP 服务器通常由客户端工具在全局配置，污染了每个项目的环境，并让项目为根本用不到的服务器持续消耗资源。PMCP（`pmcp`）是一个终端工具，用于动态管理**项目级**的 MCP 配置，让每个项目只启用它真正需要的 MCP 服务器。

## What Changes

- 为包新增 `pmcp` 命令行入口（通过 `package.json` 的 `bin` 字段声明），基于 `commander` 实现命令解析。
- 新增交互式 checkbox 终端 UI（基于 `prompts`），列出可选 MCP 服务器；当前启用状态通过读取已有配置文件回显（勾选态持久化回显）。
- 新增用户级注册表存储 `~/.pmcp/registry.json`：交互可选列表的唯一来源；文件缺失时展示空列表并提示初始化，pmcp 不自动创建。每个条目只保留**一份统一（canonical）启动定义**（command/args/env），面向客户端的专属格式在写入项目配置时按目标格式**动态生成**（历史双格式条目加载时归一化兼容）。
- 新增 `pmcp init` 命令：从客户端全局初始化——Claude Code 全局配置（`~/.claude.json`）与 OpenCode 用户级配置（`~/.config/opencode/opencode.json`），两者始终只读——初始化或增量更新注册表：只新增条目；同名定义有差异时逐项二次确认后才覆盖（默认不覆盖）；从不删除已有条目；幂等可重复执行。不再维护内置默认注册表（DEFAULT_REGISTRY），也不再启动时动态合并全局配置。
- 支持两种项目配置格式：
  - **Claude Code**：`.mcp.json`（`mcpServers` 映射）
  - **OpenCode**：`opencode.json`（`mcp` 映射）
- 新增按格式落盘：勾选结果写回项目中存在的配置文件，且不破坏 PMCP 不管理的条目。
- 新增 CLI 多语言支持：默认英文，支持简体中文；通过 `pmcp lang <en|zh>` 设置并持久化到 `~/.pmcp/settings.json`，i18n 仅覆盖 pmcp 自身文案（提示/错误/摘要/help）。
- 新增 `src/` 模块集（按 D2 拆分）：入口 `index.js`（CLI 装配、交互流程编排、兼容 re-export）、`i18n.js`（双语消息目录与语言解析）、`model.js`（TARGETS 与 canonical↔各客户端格式转换）、`registry.js`（注册表读取归一与 `pmcp init`）、`persistence.js`（项目文件 read-modify-write 落盘）、`ui.js`（checkbox 交互与摘要）。
- 新增双语文档：`README.md`（英文）与 `README_ZH.md`（中文，互链）——安装、快速上手、命令、注册表格式、限制、卸载，并含"借助 AI agent 安装与使用"三段提示词（安装工具/初始化注册表/日常管理）；`AGENTS.md` 为 agent 可读的初始化与操作文档（OpenCode/Claude Code 等自动加载）。
- 跨平台安装保障：`.gitattributes` 固化 `*.js` LF 行尾（shebang 在 Linux/macOS 可执行）；`package.json` 增加 `setup`/`teardown`/`verify` 便捷脚本与包元数据（description、keywords、files 打包 README_ZH.md）。

## Capabilities

### New Capabilities
- `cli-invocation`：`pmcp` 命令入口——bin 声明、CLI 解析、目标项目目录、错误与退出行为、多语言（默认 en/支持 zh）与 `pmcp lang` 设置子命令。
- `interactive-server-selection`：Checkbox 终端 UI——可选服务器注册表唯一来自用户级文件 `~/.pmcp/registry.json`（由 `pmcp init` 从客户端全局配置初始化/增量更新：只增、改需确认、不删），按现状预勾选，确认/取消流程。
- `config-persistence`：读取现有 `.mcp.json` / `opencode.json` 状态，并按各客户端格式写回服务器条目，同时不破坏无关配置。

### Modified Capabilities

（无——本项目为全新项目，没有已存在的 specs）

## Impact

- `package.json`：新增运行时依赖 `commander`、`prompts`；声明 `bin: { "pmcp": "./src/index.js" }`；增加 `setup`/`teardown`/`verify` scripts 与 `description`/`keywords`/`files` 元数据。
- `src/` 多模块：新增主引擎，按 D2 修订拆分为 index/i18n/model/registry/persistence/ui 六个文件（CLI 入口、交互 checkbox、用户级注册表与 `pmcp init` 更新策略、统一条目按目标格式即时生成落盘、双语消息目录）；不内置服务器条目列表；`index.js` 保留兼容 re-export。
- 新增 `README.md`、`README_ZH.md`、`AGENTS.md`、`.gitattributes`：文档与打包元数据，不影响运行时行为。
- 用户主目录新增 `~/.pmcp/registry.json`（`pmcp init` 创建）与 `~/.pmcp/settings.json`（`pmcp lang` 创建）；`~/.claude.json` 与 OpenCode 用户级配置只读使用（不存在/损坏则警告跳过，绝不写回）。
- 不修改项目内任何现有代码与配置；PMCP 写入范围限于目标项目的 MCP 配置文件与自身注册表文件。
