# Spec Delta

## ADDED Requirements

### Requirement: 导入时绝对化本地命令路径
pmcp 在 `pmcp init` 与 `pmcp register` 从客户端配置文件构建统一（canonical）条目时，SHALL 将本地条目的 `command` 中相对文件路径解析为绝对路径：项目条目按当前项目目录解析，全局条目按用户主目录解析。裸命令名（如 `uvx`、`npx`，不含 `/` 或 `\`、不以 `.` 或 `~` 开头）SHALL 保持不变，仍靠 PATH 解析；`~` 开头的路径 SHALL 展开为用户主目录；已是绝对路径的 `command` SHALL 原样保留。远程条目（含 `url`）SHALL NOT 受影响。

#### Scenario: 项目相对命令被绝对化
- **WHEN** 某项目 `opencode.json`（或 `.mcp.json`）声明本地服务器 `command: ["src\\server.exe"]`，用户运行 `pmcp register`
- **THEN** 注册表该条目 `command` 为 `<项目目录>\\src\\server.exe`（绝对路径）

#### Scenario: 裸命令名保持不变
- **WHEN** 某项目 `opencode.json` 声明本地服务器 `command: ["uvx", "mcp-server-git"]`，用户运行 `pmcp register`
- **THEN** 注册表该条目 `command` 仍为 `uvx`，`args` 为 `["mcp-server-git"]`

#### Scenario: 全局相对命令按主目录绝对化
- **WHEN** 用户主目录下 OpenCode 用户级配置声明本地服务器 `command: ["./bin/mytool"]`，用户运行 `pmcp init`
- **THEN** 注册表该条目 `command` 为 `<主目录>\\bin\\mytool`（绝对路径）

#### Scenario: 远程条目不受影响
- **WHEN** 某项目 `opencode.json` 声明远程服务器（`type: "remote"` 与 `url`），用户运行 `pmcp register`
- **THEN** 注册表该条目仍为 `{url, type}`，不因绝对化逻辑产生 `command` 字段

#### Scenario: 冲突选边结果被绝对化
- **WHEN** 当前项目 `.mcp.json` 与 `opencode.json` 对同 id 声明不同定义（均为相对命令），用户在选边提示中选择 Claude Code 定义后运行 `pmcp register`
- **THEN** 注册表该条目 `command` 为按项目目录绝对化的路径
