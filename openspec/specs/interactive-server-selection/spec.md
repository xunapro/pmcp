# interactive-server-selection Specification

## Purpose

定义交互式终端体验：可选服务器列表唯一来源于用户级注册表文件（由 `pmcp init` 从客户端全局配置初始化/增量更新）、checkbox 多选列表、依据既有配置的状态回显，以及通向落盘的确认/取消流程。

## Requirements

### Requirement: 已知服务器的 checkbox 列表
pmcp SHALL 展示一个交互式 checkbox（多选）列表，包含注册表中的每一个服务器——注册表条目唯一来自用户级注册表文件 `~/.pmcp/registry.json`——各自以可读的名称标识。

#### Scenario: 空项目首次运行
- **WHEN** 用户在没有任何 MCP 配置文件的目录中运行 `pmcp`
- **THEN** pmcp 展示所有注册表服务器的 checkbox 列表，且均未被预选

### Requirement: 当前启用状态被预选
当注册表中的某个服务器已在本项目任一受管配置文件中启用时，pmcp SHALL 将其显示为已勾选，使勾选态在每次运行时反映持久化状态。

#### Scenario: 从既有配置回显
- **WHEN** `.mcp.json` 已声明注册表服务器 "filesystem"，用户运行 `pmcp`
- **THEN** "filesystem" 条目显示为已勾选

#### Scenario: 配置中未启用的服务器不勾选
- **WHEN** `.mcp.json` 存在但未声明某个注册表服务器
- **THEN** 该服务器显示为未勾选

### Requirement: 未知条目仅保留不受管控
当既有配置文件声明了不在 pmcp 注册表中的 MCP 服务器时，pmcp SHALL 在保存时保持这些服务器不动；checkbox 列表 SHALL 只包含注册表内的服务器。

#### Scenario: 配置中的自定义服务器
- **WHEN** `.mcp.json` 包含一个不在注册表中的服务器 `my-custom-mcp`，用户保存变更
- **THEN** `my-custom-mcp` 保留在 `.mcp.json` 中且定义不变，也不会作为可勾选条目出现

### Requirement: 确认即保存，取消即中止
当用户确认选择时 pmcp SHALL 持久化所选集合；当用户取消提示时 SHALL 不做任何写入直接退出。

#### Scenario: 用户确认选择
- **WHEN** 用户勾选/取消若干服务器后确认
- **THEN** pmcp 将该选择应用到项目的配置文件

#### Scenario: 用户取消选择
- **WHEN** 用户在确认步骤选择不继续
- **THEN** pmcp 退出且不写入任何配置文件

### Requirement: 保存后的摘要
保存完成后，pmcp SHALL 打印简要摘要说明写入了什么（按文件列出启用与禁用的服务器），便于用户核对结果。

#### Scenario: 保存后输出摘要
- **WHEN** 用户确认了一个启用一个服务器、禁用另一个服务器的选择
- **THEN** pmcp 在退出码 0 前打印列出启用与禁用服务器的摘要

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

### Requirement: 用户级注册表文件
pmcp SHALL 从当前用户主目录下的 `~/.pmcp/registry.json` 读取服务器注册表，该文件 SHALL 为交互列表的唯一事实源；pmcp 的交互与保存流程 SHALL NOT 自动创建或覆盖此文件（它仅由 `pmcp init` 命令产生/更新或用户手工编辑）。每个注册表条目 SHALL 只保留一份统一（canonical）启动定义，含两形态：本地条目为 `command`/`args?`/`env?`，远程条目为 `url` 与 `type`（`http`/`sse`/`ws` 之一，采用 Claude Code 词汇以保真写回）。写入项目配置文件时 SHALL 按目标客户端格式即时生成专属定义。为兼容历史文件，加载时 pmcp SHALL 将旧版双格式条目（含 `claude`/`opencode` 字段）归一化为统一格式（两字段定义不一致时以 `claude` 字段为准），且 SHALL NOT 因此重写文件。文件不存在时 pmcp SHALL 不进入服务器选择交互，打印提示引导用户运行 `pmcp init` 初始化，并以退出码 0 结束，且 SHALL NOT 创建任何文件。文件解析失败时 pmcp SHALL 向 stderr 输出指明该文件的错误并以非零码退出，且不修改任何文件。

#### Scenario: 文件缺失时空列表提示
- **WHEN** 用户在 `~/.pmcp/registry.json` 不存在时运行 `pmcp`
- **THEN** pmcp 打印提示引导运行 `pmcp init`，不弹出任何选择交互，以退出码 0 结束，且不创建任何文件

#### Scenario: 统一格式条目保存时生成目标格式
- **WHEN** 注册表条目仅含统一启动定义（`command: "npx"`、`args: [...]`），用户勾选该条目并同时写入两种格式
- **THEN** `.mcp.json` 与 `opencode.json` 中的输出各自符合对应客户端结构，且均由该同一条目定义派生

#### Scenario: 远程条目保存时生成目标格式
- **WHEN** 注册表条目含远程统一定义（`type: "http"`、`url: "https://..."`），用户勾选该条目并同时写入两种格式
- **THEN** `.mcp.json` 中输出 `{"type":"http","url":...}`，`opencode.json` 中输出 `{"type":"remote","url":...}`，两者均合法

#### Scenario: 旧双格式文件兼容
- **WHEN** 注册表文件含旧版条目（带 `claude` 与 `opencode` 两个字段）
- **THEN** pmcp 正常加载并用于展示与保存（归一化以 `claude` 字段为准），且不改写注册表文件

#### Scenario: 用户编辑注册表后生效
- **WHEN** 用户在 `~/.pmcp/registry.json` 中新增或删除条目后再次运行 pmcp
- **THEN** checkbox 列表按修改后的文件内容展示，且 pmcp 不改动该文件

#### Scenario: 注册表文件损坏
- **WHEN** `~/.pmcp/registry.json` 不是合法 JSON
- **THEN** pmcp 打印指明该文件的错误并以非零码退出，不修改任何文件

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

### Requirement: pmcp register 合并当前项目服务器到注册表
pmcp SHALL 提供 `pmcp register` 子命令，将当前项目 `.mcp.json`（`mcpServers` 键）与 `opencode.json`（`mcp` 键）中声明的服务器合并进用户级注册表 `~/.pmcp/registry.json`，其维护语义与 `pmcp init` 对齐：**只新增**——注册表中不存在的 id 经归一为统一格式定义后追加；**改需确认**——同名条目的项目定义与注册表条目不一致时 SHALL 逐项询问用户是否覆盖（默认不覆盖，取消即不覆盖），仅在确认后写入归一后的新定义；**不删除**——注册表中未出现在任何项目来源里的条目保持不变。

`pmcp register` SHALL 幂等：重复执行不产生重复条目、不重复询问无变化项。远程条目（仅含 `url`，opencode 侧 `type:"remote"`、claude 侧 `type:"http"`/`sse`/`ws`）SHALL 归一为 `{url, type}` 并收录；无法归一的条目（如 `type:"sdk"`/`plugin` 等无命令亦无网络 URL、或形状不合法）SHALL 跳过并提示。两个项目文件声明同 id 但归一化定义不一致时，SHALL 提示用户选择以哪一份定义为准（选项为 Claude Code 定义、OpenCode 定义与跳过；后台取消即跳过该 id），SHALL NOT 自动裁决。

`pmcp register` 的流程取消（提示后台取消或 Ctrl+C）SHALL 对注册表零写入且不影响其它条目，以退出码 0 结束且无错误堆栈输出。注册表文件不存在时 SHALL 打印引导用户先运行 `pmcp init` 的提示并以退出码 0 退出，SHALL NOT 创建或改写任何文件；注册表解析失败时 SHALL 向 stderr 输出指明该文件的错误并以非零码退出。`~/.claude.json` 与 OpenCode 用户级配置在 register 流程中 SHALL 保持只读。

#### Scenario: 双文件各贡献无人服务器
- **WHEN** `.mcp.json` 声明一个服务器、`opencode.json` 声明另一个服务器，注册表两者皆无，用户运行 `pmcp register`
- **THEN** 两个条目均以统一格式追加进注册表，无确认提示，以退出码 0 退出

#### Scenario: 项目文件同 id 定义不同需选边
- **WHEN** `.mcp.json` 与 `opencode.json` 都声明同一服务器且定义不同，注册表中无该服务器，用户在选边提示中选择 Claude Code 定义
- **THEN** 注册表新增该服务器条目，其定义由 `.mcp.json` 归一而来，仅出现一次

#### Scenario: 同名不同定义需确认覆盖
- **WHEN** 注册表某条目定义与 `.mcp.json` 中的一致，用户运行 `pmcp register` 并在确认提示中选择覆盖
- **THEN** 仅该条目更新为项目中的新定义；若用户选择否（默认），条目保持原定义

#### Scenario: 重复 register 幂等
- **WHEN** 用户首次执行 `pmcp register` 成功后，未修改任何文件即再次执行
- **THEN** 不产生重复条目、不出现任何确认提示，以退出码 0 退出

#### Scenario: 从不删除
- **WHEN** 注册表中某条目未出现在当前项目的任何文件中，用户运行 `pmcp register`
- **THEN** 该条目仍保留在注册表文件中

#### Scenario: 远程条目收录进注册表
- **WHEN** 当前项目的 `.mcp.json` 含一个 `type:"http"` 与 `url` 字段的远程服务器，注册表中无同名条目，用户运行 `pmcp register`
- **THEN** 注册表新增该条目，统一定义为 `{url, type:"http"}`，不因远程而跳过

#### Scenario: 远程条目写回两侧
- **WHEN** 注册表已含一个远程条目（`{url, type:"ws"}`），用户勾选并确认写入两种格式
- **THEN** `.mcp.json` 写入 `{"type":"ws","url":...}`，`opencode.json` 写入 `{"type":"remote","url":...}`

#### Scenario: 远程条目跳过并提示
- **WHEN** 当前项目的 `.mcp.json` 含一个 `type:"sdk"` 且既无 `url` 亦无 `command` 的条目，注册表中无同名条目，用户运行 `pmcp register`
- **THEN** 该条目被跳过并打印说明真实原因的提示（无命令亦无网络 URL，`type` 不受支持），其余条目不受影响；含 `url`/`http` 的远程条目不在此列，会被正常收录

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
