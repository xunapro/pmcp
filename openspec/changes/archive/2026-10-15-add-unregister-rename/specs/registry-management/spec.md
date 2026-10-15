# Spec Delta

## Purpose

提供 pmcp unregister 与 pmcp rename 两条子命令，用于从用户级注册表移除条目、修改条目显示名称，并规定其确认/取消、语言与退出码行为及对项目配置文件的联动。

## ADDED Requirements

### Requirement: pmcp unregister 列出并移除注册表条目
pmcp SHALL 提供 `pmcp unregister` 子命令：读取用户级注册表 `~/.pmcp/registry.json`，以交互式多选列表列出全部条目供用户选择要移除的条目；用户确认后 SHALL 从注册表中删除所选条目并写回注册表文件。取消（含后台取消与 Ctrl+C）SHALL 零写入、以退出码 0 结束且不输出错误堆栈。注册表文件缺失时 SHALL 打印引导运行 `pmcp init` 的提示并以退出码 0 退出，且 SHALL NOT 创建任何文件；注册表解析失败时 SHALL 向 stderr 输出指明该文件的错误并以非零码退出。界面文案沿用当前激活语言。

#### Scenario: 移除单个条目
- **WHEN** 注册表含条目 "git"，用户运行 `pmcp unregister` 并勾选 "git" 后确认
- **THEN** "git" 从注册表中被移除，其余条目保持不变，以退出码 0 退出

#### Scenario: 移除多个条目
- **WHEN** 注册表含条目 "git" 与 "filesystem"，用户在 `pmcp unregister` 中勾选两者后确认
- **THEN** 两者均从注册表移除，其余条目保持不变

#### Scenario: 用户取消选择
- **WHEN** 用户在 `pmcp unregister` 中按 Ctrl+C 或选择不继续
- **THEN** 注册表文件未被修改，以退出码 0 退出且无错误堆栈

#### Scenario: 注册表缺失
- **WHEN** `~/.pmcp/registry.json` 不存在，用户运行 `pmcp unregister`
- **THEN** pmcp 打印引导运行 `pmcp init` 的提示，以退出码 0 退出，不创建任何文件

#### Scenario: 注册表解析失败
- **WHEN** `~/.pmcp/registry.json` 不是合法 JSON，用户运行 `pmcp unregister`
- **THEN** pmcp 向 stderr 输出指明该文件的错误并以非零码退出，不修改任何文件

#### Scenario: 文案跟随激活语言
- **WHEN** 用户已通过 `pmcp lang zh` 激活中文后运行 `pmcp unregister`
- **THEN** unregister 的提示、确认与摘要均使用中文

### Requirement: unregister 对启用中的服务器询问是否同时从项目移除
当被移除的服务器当前在**当前项目**的受管配置文件（`.mcp.json` 或 `opencode.json`）中启用时，`pmcp unregister` SHALL 在删除注册表条目之前询问用户是否同时将这些服务器从当前项目的配置文件中移除；仅在用户确认时才从项目文件移除，取消则只改注册表、不动项目文件。未在当前项目任何受管文件中启用的被移除服务器 SHALL NOT 触发此询问。

#### Scenario: 移除已启用服务器并确认同时移除
- **WHEN** 服务器 "git" 在注册表与当前项目 `.mcp.json` 中均存在且启用，用户 `pmcp unregister` 移除它并确认同时从项目移除
- **THEN** "git" 从注册表与 `.mcp.json` 中均被移除，`mcpServers` 中不再包含它

#### Scenario: 移除已启用服务器但拒绝同时移除
- **WHEN** 服务器 "git" 在注册表与当前项目 `.mcp.json` 中均启用，用户 `pmcp unregister` 移除它但在询问时选择不同时移除
- **THEN** "git" 仅从注册表移除，`.mcp.json` 中的 "git" 条目原样保留

#### Scenario: 移除未启用服务器不询问
- **WHEN** 服务器 "filesystem" 在注册表中但未出现在当前项目任何配置文件中，用户 `pmcp unregister` 移除它
- **THEN** 仅从注册表移除，不出现“是否同时从项目移除”的询问

### Requirement: pmcp rename 修改条目显示名称
pmcp SHALL 提供 `pmcp rename` 子命令修改注册表条目的显示名称 `name`，且 SHALL NOT 改动条目的 `id` 与启动定义（command/args/env 或 url/type）。SHALL 支持两种形式：带参数形式 `pmcp rename <id> <new-name>` 直接指定 id 与新名称；不带参数时交互式列出条目供用户选择，再提示输入新名称。注册表缺失时 SHALL 打印引导运行 `pmcp init` 的提示并以退出码 0 退出；参数形式中 id 不存在时 SHALL 向 stderr 输出错误并以非零码退出；新名称 SHALL NOT 为空。

#### Scenario: 参数形式改名
- **WHEN** 注册表含 id 为 "git" 的条目，用户运行 `pmcp rename git "Git 仓库"`
- **THEN** 该条目 `name` 更新为 "Git 仓库"，`id` 与启动定义保持不变，以退出码 0 退出

#### Scenario: 交互式改名
- **WHEN** 用户运行不带参数的 `pmcp rename`，在条目列表中选择 "git" 并输入新名称 "Git 仓库"
- **THEN** "git" 条目的 `name` 更新为 "Git 仓库"，`id` 与启动定义保持不变

#### Scenario: id 不存在
- **WHEN** 注册表中不存在 id 为 "nonexistent" 的条目，用户运行 `pmcp rename nonexistent foo`
- **THEN** pmcp 向 stderr 输出指明该 id 的错误并以非零码退出，注册表文件不被修改

#### Scenario: 空名称被拒绝
- **WHEN** 用户运行 `pmcp rename git ""` 或在交互式中输入空名称
- **THEN** pmcp 提示名称不能为空并以非零码退出，注册表文件不被修改

#### Scenario: 注册表缺失
- **WHEN** `~/.pmcp/registry.json` 不存在，用户运行 `pmcp rename`
- **THEN** pmcp 打印引导运行 `pmcp init` 的提示，以退出码 0 退出，不创建任何文件

#### Scenario: 改名不改项目文件
- **WHEN** 用户改名某注册表条目的 `name` 后运行 `pmcp`
- **THEN** 项目配置文件中的该服务器（以 `id` 为键）保持不变，仅注册表的显示名称变化

### Requirement: unregister 与 rename 只改动所选条目并保留其余
`pmcp unregister` 与 `pmcp rename` 在改写 `~/.pmcp/registry.json` 时 SHALL 保持未被选中/未改名的条目原样（含其 `_raw` 原始形状与旧版 `claude`/`opencode` 双字段条目），并写出格式良好的 JSON。

#### Scenario: 其它条目不受影响
- **WHEN** 注册表含 "git"、"filesystem" 与旧版双字段条目 "legacy"，用户 `pmcp unregister` 移除 "git"
- **THEN** "filesystem" 与 "legacy" 条目原样保留（含 "legacy" 的原始双字段形状），注册表文件为合法 JSON
