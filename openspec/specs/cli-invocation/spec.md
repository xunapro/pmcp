# cli-invocation Specification

## Purpose

定义 `pmcp` 命令行工具的调用方式：作为控制台命令的安装、目标项目目录的确定、内置参数以及进程退出行为。

## Requirements

### Requirement: pmcp 控制台命令可用
包 SHALL 暴露 `pmcp` 控制台命令，使安装本包后在终端运行 `pmcp` 即可启动工具。

#### Scenario: 通过包 bin 安装命令
- **WHEN** 用户安装本包（如 `npm install -g .` 或 `npm link`）后运行 `pmcp`
- **THEN** pmcp 工具启动，而不是 shell 报未知命令错误

### Requirement: 目标项目解析
pmcp SHALL 以当前工作目录作为项目根目录，对其中的 MCP 配置文件进行读写。

#### Scenario: 在项目内运行
- **WHEN** 用户在包含 `.mcp.json` 或 `opencode.json` 的项目目录中运行 `pmcp`
- **THEN** pmcp 读取并在稍后更新该目录下的这些文件

### Requirement: 标准 CLI 参数
pmcp SHALL 支持 `--help` 输出用法说明、`--version` 输出包版本号，并且不进入交互界面即以成功状态退出。

#### Scenario: Help 参数
- **WHEN** 用户运行 `pmcp --help`
- **THEN** pmcp 打印描述该命令的用法文本并以退出码 0 退出

#### Scenario: Version 参数
- **WHEN** 用户运行 `pmcp --version`
- **THEN** pmcp 打印包版本号并以退出码 0 退出

### Requirement: 失败时报错并以非零码退出
当无法继续时（例如既有配置文件不是合法 JSON），pmcp SHALL 向 stderr 输出可读的错误信息并以非零退出码退出，且 SHALL NOT 修改任何配置文件。

#### Scenario: 既有配置损坏
- **WHEN** `opencode.json` 存在但内容是非法 JSON，用户运行 `pmcp`
- **THEN** pmcp 打印指明出错文件的错误信息并以非零码退出，且不写入任何配置文件

### Requirement: 取消时项目保持不变
当用户中止运行（例如在交互提示时按 Ctrl+C），pmcp SHALL 不对任何配置文件做改动。

#### Scenario: 用户按 Ctrl+C
- **WHEN** 用户在保存前取消交互选择
- **THEN** 没有配置文件被创建、修改或删除，且 pmcp 不输出错误堆栈即退出

### Requirement: 界面语言与持久化设置
pmcp SHALL 支持多语言界面：默认语言为英文（en），并支持简体中文（zh）。激活语言 SHALL 持久化在用户主目录 `~/.pmcp/settings.json` 的 `language` 键中。设置缺失或取值非法时 pmcp SHALL 回退到英文；设置文件解析失败时 pmcp SHALL 打印提示并按英文继续，SHALL NOT 因此退出，也 SHALL NOT 改写该文件。pmcp 输出的全部自身文案（交互提示、确认、摘要、错误、警告与 help/版本号文本）SHALL 使用激活语言。

#### Scenario: 默认英文
- **WHEN** 用户从未配置语言而运行 `pmcp`
- **THEN** 交互提示、摘要与错误信息均为英文

#### Scenario: 设置文件损坏时回退
- **WHEN** `~/.pmcp/settings.json` 不是合法 JSON，用户运行 `pmcp`
- **THEN** pmcp 打印一条提示、按英文正常运行，且不修改 settings.json

#### Scenario: 用户数据不受语言切换影响
- **WHEN** 注册表条目已创建（由 `pmcp init` 生成或用户手写），用户随后切换语言为 zh
- **THEN** 列表仍显示注册表文件中的原始条目描述，pmcp 不改写注册表文件

### Requirement: pmcp lang 子命令
pmcp SHALL 提供 `pmcp lang <code>` 子命令设置激活语言并持久化到 `~/.pmcp/settings.json`（有效取值为 `en`、`zh`）；`pmcp lang` 不带参数时 SHALL 打印当前激活语言并以退出码 0 退出；传入无效 code 时 SHALL 打印包含支持语言列表的错误并以非零码退出，且 SHALL NOT 修改 settings.json。

#### Scenario: 切换为中文
- **WHEN** 用户运行 `pmcp lang zh`
- **THEN** `~/.pmcp/settings.json` 的 `language` 持久化为 `"zh"`，后续运行 `pmcp` 的界面文案为中文

#### Scenario: 查看当前语言
- **WHEN** 已设置 zh 后用户运行 `pmcp lang`
- **THEN** pmcp 打印当前语言 `zh` 并以退出码 0 退出

#### Scenario: 不支持的语言代码
- **WHEN** 用户运行 `pmcp lang fr`
- **THEN** pmcp 打印错误（说明支持 en、zh）并以非零码退出，settings.json 保持不变
