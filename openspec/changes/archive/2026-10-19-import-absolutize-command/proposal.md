# Proposal

## Why

`pmcp` 在 `init` / `register` 从客户端配置（`.mcp.json`、`opencode.json`、`~/.claude.json`、OpenCode 用户级配置）导入服务器时，把本地条目的 `command` 原样写入注册表。当配置里用的是**相对文件路径**（例如 `opencode.json` 中 `command: ["src\\ArgocdMcp\\...\\ArgocdMcp.exe"]`）时，这些相对路径被存进**用户级全局注册表**后失去"项目根目录"上下文——在其它项目目录启用该服务器时相对路径无法解析，命令失效。而裸命令名（`uvx`、`npx`）依赖 PATH，跨项目是安全的。

## What Changes

- **导入时绝对化**：`collectProjectEntries` / `collectGlobalEntries` 在构建统一（canonical）条目后，对本地条目的 `command` 做绝对化——项目条目按项目目录解析、全局条目按用户主目录解析。
- **保留裸命令名**：`uvx` / `npx` 等不含路径分隔符、不以 `.` 或 `~` 开头的命令保持不变，仍靠 PATH 解析。
- **展开 `~`**：`~` 开头的路径展开为用户主目录。
- **远程条目不受影响**：含 `url` 的远程条目无 `command`，不参与绝对化。
- **冲突选边也绝对化**：`register` 中 `.mcp.json` 与 `opencode.json` 对同 id 定义不同而选边时，被选中的定义同样绝对化。
- **BREAKING**：无。仅改变导入到注册表的 `command` 路径形态；对已存在的注册表条目无自动改写。

## Capabilities

### New Capabilities

无新增能力目录。

### Modified Capabilities

- `interactive-server-selection`: 新增 requirement「导入时绝对化本地命令路径」，覆盖 `pmcp init` / `pmcp register` 构建统一条目时的命令路径规范化。

## Impact

- **代码**：`src/sources.js` —— 新增 `isBareCommand` / `absolutizeCommand` 助手，`collectProjectEntries`（按项目目录）与 `collectGlobalEntries`（按主目录）应用绝对化并导出 `absolutizeCommand`；`src/registry.js` —— `registerToRegistry` 冲突选边分支对候选定义应用绝对化。
- **文档**：`AGENTS.md`（统一条目说明补导入绝对化）、`README.md` / `README_ZH.md`（canonical 定义说明补导入绝对化）。
- **依赖**：零新依赖。
- **兼容性**：已存在于注册表的相对路径条目不被自动改写；裸命令名行为不变；远程条目不变。
