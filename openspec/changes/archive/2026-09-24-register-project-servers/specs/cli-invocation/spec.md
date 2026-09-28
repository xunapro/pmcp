# Spec Delta

## ADDED Requirements

### Requirement: pmcp register 子命令
pmcp SHALL 提供 `pmcp register` 子命令：以当前工作目录作为项目根目录，读取其中的 `.mcp.json` 与 `opencode.json`，将可归一化的服务器合并进用户级注册表 `~/.pmcp/registry.json`；流程正常完成时 SHALL 打印摘要并以退出码 0 退出，界面文案沿用当前激活语言。当任一项目文件不是合法 JSON 时 SHALL 向 stderr 输出指明该文件的错误并以非零码退出，且 SHALL NOT 修改注册表。

#### Scenario: 注册当前项目的服务器
- **WHEN** 用户在同时含 `.mcp.json` 与 `opencode.json`（且均声明服务器）的项目目录中运行 `pmcp register`
- **THEN** 可归一化的服务器按合并规则进入 `~/.pmcp/registry.json`，打印摘要，以退出码 0 退出

#### Scenario: 项目配置文件损坏
- **WHEN** 当前目录的 `opencode.json` 是非法 JSON，用户运行 `pmcp register`
- **THEN** pmcp 打印指明该文件的错误并以非零码退出，注册表文件不被修改

#### Scenario: 文案跟随激活语言
- **WHEN** 用户已通过 `pmcp lang zh` 激活中文后运行 `pmcp register`
- **THEN** register 的提示、确认与摘要均使用中文，专业名词（如服务器 id）保持原样
