# Spec Delta

## ADDED Requirements

### Requirement: pmcp register 合并当前项目服务器到注册表
pmcp SHALL 提供 `pmcp register` 子命令，将当前项目 `.mcp.json`（`mcpServers` 键）与 `opencode.json`（`mcp` 键）中声明的服务器合并进用户级注册表 `~/.pmcp/registry.json`，其维护语义与 `pmcp init` 对齐：**只新增**——注册表中不存在的 id 经归一为统一格式定义后追加；**改需确认**——同名条目的项目定义与注册表条目不一致时 SHALL 逐项询问用户是否覆盖（默认不覆盖，取消即不覆盖），仅在确认后写入归一后的新定义；**不删除**——注册表中未出现在任何项目来源里的条目保持不变。

`pmcp register` SHALL 幂等：重复执行不产生重复条目、不重复询问无变化项。无法归一的条目（如仅含 `url` 的远程服务器）SHALL 跳过并提示。两个项目文件声明同 id 但归一化定义不一致时，SHALL 提示用户选择以哪一份定义为准（选项为 Claude Code 定义、OpenCode 定义与跳过；后台取消即跳过该 id），SHALL NOT 自动裁决。

`pmcp register` 的流程取消（提示后台取消或 Ctrl+C）SHALL 对注册表零写入且不影响其它条目，以退出码 0 结束且无错误堆栈输出。注册表文件不存在时 SHALL 打印引导用户先运行 `pmcp init` 的提示并以退出码 0 退出，SHALL NOT 创建或改写任何文件；注册表解析失败时 SHALL 向 stderr 输出指明该文件的错误并以非零码退出。`~/.claude.json` 与 OpenCode 用户级配置在 register 流程中 SHALL 保持只读。

#### Scenario: 双文件各贡献无人服务器
- **WHEN** `.mcp.json` 声明 `git`、`opencode.json` 声明 `playwright`，注册表两者皆无，用户运行 `pmcp register`
- **THEN** 两个条目均以统一格式追加进注册表，无确认提示，以退出码 0 退出

#### Scenario: 项目文件同 id 定义不同需选边
- **WHEN** `.mcp.json` 与 `opencode.json` 都声明服务器 `server` 且定义不同，注册表中无 `server`，用户在选边提示中选择 Claude Code 定义
- **THEN** 注册表新增 `server` 条目，其定义由 `.mcp.json` 归一而来，仅出现一次

#### Scenario: 同名不同定义需确认覆盖
- **WHEN** 注册表条目 `git` 定义与 `.mcp.json` 中的一致，用户运行 `pmcp register` 并在确认提示中选择覆盖
- **THEN** 仅该条目更新为项目中的新定义；若用户选择否（默认），条目保持原定义

#### Scenario: 重复 register 幂等
- **WHEN** 用户首次执行 `pmcp register` 成功后，未修改任何文件即再次执行
- **THEN** 不产生重复条目、不出现任何确认提示，以退出码 0 退出

#### Scenario: 从不删除
- **WHEN** 注册表中条目 `old-server` 未出现在当前项目的任何文件中，用户运行 `pmcp register`
- **THEN** `old-server` 仍保留在注册表文件中

#### Scenario: 远程条目跳过并提示
- **WHEN** 当前项目的 `.mcp.json` 仅含一个 `url` 字段的远程服务器，注册表中无同名条目，用户运行 `pmcp register`
- **THEN** 该远程条目不被写入注册表，pmcp 打印一条说明其被跳过的提示

#### Scenario: 注册表缺失时引导 init
- **WHEN** `~/.pmcp/registry.json` 不存在，用户运行 `pmcp register`
- **THEN** pmcp 打印引导运行 `pmcp init` 的提示，以退出码 0 退出，不创建任何文件

#### Scenario: 登记不影响任何项目的启用状态
- **WHEN** 用户在某项目执行 `pmcp register` 成功
- **THEN** 当前项目的 `.mcp.json` / `opencode.json` 与所有其它项目的配置均不被创建、修改或删除，仅注册表发生变化

#### Scenario: 项目选边提示取消即跳过
- **WHEN** 两文件对同 id 定义不一致的选边提示被后台取消（如非 TTY 管道执行）
- **THEN** 该 id 不被写入注册表，其余条目继续按合并规则处理，以退出码 0 退出

#### Scenario: 客户端全局文件保持只读
- **WHEN** 用户执行任何 `pmcp register` 流程
- **THEN** `~/.claude.json` 与 OpenCode 用户级配置逐字节不变
