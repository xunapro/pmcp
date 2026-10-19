# Spec Delta

## MODIFIED Requirements

### Requirement: pmcp init 初始化与更新注册表
pmcp SHALL 提供 `pmcp init` 子命令，从客户端全局初始化配置——Claude Code 的 `~/.claude.json`（`mcpServers` 键）与 OpenCode 的用户级配置 `~/.config/opencode/opencode.json`（`mcp` 键，或新版 `mcp.servers` 键）——初始化或增量更新 `~/.pmcp/registry.json`。两个全局文件 SHALL 始终只读，pmcp SHALL NOT 写回或格式化它们。更新规则：**只新增**——注册表中不存在的服务器 id 经归一为统一格式定义后追加；远程条目（含 `url` 的服务器，opencode 侧 `type:"remote"`、claude 侧 `type:"http"`/`sse`/`ws`）SHALL 归一为 `{url, type}` 并收录；无法归一的条目（如 `type:"sdk"`/`plugin` 等无命令亦无网络 URL、或形状不合法）跳过并提示。**改需确认**——同名条目的全局定义归一后与注册表条目不一致时，pmcp SHALL 逐项询问用户是否覆盖（默认不覆盖），仅在确认后写入统一格式的新定义。**不删除**——注册表中未出现在任何来源里的条目保持不变。两来源声明同 id 但定义不一致时 SHALL 以 Claude Code 来源为准。`pmcp init` SHALL 幂等：重复执行不产生重复条目、不重复询问无变化项。两个来源均不可用（缺失或非法 JSON）时 `pmcp init` SHALL 打印提示并以非零码退出，且不修改注册表文件。

#### Scenario: 首次 init 创建注册表
- **WHEN** `~/.pmcp/registry.json` 不存在，`~/.claude.json` 声明了若干服务器，用户运行 `pmcp init`
- **THEN** 创建注册表文件，包含这些条目的统一格式定义（每条目仅一份启动定义），退出码 0

#### Scenario: init 收录远程服务器
- **WHEN** `~/.claude.json` 声明一个远程服务器（`type:"http"` 与 `url`），注册表中无同名条目，用户运行 `pmcp init`
- **THEN** 注册表新增该条目，其统一定义为 `{url, type:"http"}`，不因远程而跳过

#### Scenario: init 跳过无命令无 URL 的条目
- **WHEN** `~/.claude.json` 声明一个 `type:"sdk"` 且既无 `url` 亦无 `command` 的条目，用户运行 `pmcp init`
- **THEN** 该条目被跳过并打印说明原因的提示，其余条目不受影响

#### Scenario: 重复 init 只新增
- **WHEN** 注册表已含与全局一致的某条目，全局配置新增了另一条目，用户再次运行 `pmcp init`
- **THEN** 新条目被追加，既有条目原样保留，不出现询问，无重复条目

#### Scenario: 同名不同定义需确认
- **WHEN** 注册表某条目定义与 `~/.claude.json` 不一致，用户运行 `pmcp init` 并在确认提示中选择覆盖
- **THEN** 仅该条目更新为归一后的统一格式全局定义；若用户选择否（默认），条目保持原定义

#### Scenario: 两来源同 id 冲突以 Claude Code 为准
- **WHEN** `~/.claude.json` 与 OpenCode 用户级配置都声明同一服务器且定义不同，注册表中无该条目，用户运行 `pmcp init`
- **THEN** 注册表中该服务器仅出现一次，其统一格式定义由 Claude Code 来源归一而来

#### Scenario: 从不删除
- **WHEN** 注册表中某条目已不存在于任何全局配置，用户运行 `pmcp init`
- **THEN** 该条目仍保留在注册表文件中

#### Scenario: 来源均不可用
- **WHEN** `~/.claude.json` 与 OpenCode 用户级配置都不存在或均非法 JSON，用户运行 `pmcp init`
- **THEN** pmcp 打印提示并以非零码退出，注册表文件（若存在）不被修改

#### Scenario: 全局文件保持只读
- **WHEN** 用户执行任何 `pmcp init` 流程
- **THEN** `~/.claude.json` 与 OpenCode 用户级配置逐字节不变
