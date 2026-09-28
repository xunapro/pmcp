# PMCP — 项目级 MCP 管理器

管理**项目级** MCP 服务器配置。全局配置的 MCP 服务器会污染每一个项目、让用不到的项目持续消耗资源；`pmcp` 让每个项目只启用自己真正需要的服务器——通过终端 checkbox 界面。

`pmcp` 会把勾选结果写回项目目录内的客户端配置文件：

| 客户端 | 项目文件 | 配置段 |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `mcpServers` |
| OpenCode | `opencode.json` | `mcp` |

## 环境要求

- Node.js >= 18——无构建步骤；两个 npm 依赖（commander、prompts）在安装时自动拉取

## 安装

支持 **Windows / Linux / macOS**，**任意终端**（cmd、PowerShell、Git Bash、sh、zsh…）可用，无需手工配置 PATH 等环境变量：`npm` 会把 `pmcp` 命令注册进它自己的全局 bin 目录（安装 Node.js 后该目录本就在 PATH 中），并按操作系统生成对应的启动器（Windows 为 `pmcp.cmd`/`pmcp.ps1`，Unix 为符号链接）。

```bash
# 在项目目录内（或 `npm pack` 产出的 pmcp-1.0.0.tgz 解包目录内）：
npm install -g .
# 等价的便捷脚本：
npm run setup

# 开发模式（全局命令指向源码目录，改动即时生效）：
npm install && npm link
```

验证安装：

```bash
pmcp --version   # 或：npm run verify
```

免安装方式：`npx --yes <路径或包名> [command]`。

## 快速上手

```bash
pmcp init        # 一次性：从客户端全局配置生成 ~/.pmcp/registry.json
pmcp             # 在项目目录内运行：checkbox 界面，空格切换勾选、回车确认
pmcp register    # 把当前项目的服务器提升进 ~/.pmcp/registry.json（init 的反向）
pmcp lang zh     # 界面切换为中文（默认英文）
```

若项目内既没有 `.mcp.json` 也没有 `opencode.json`，`pmcp` 会询问要创建哪种（些）文件。注册表之外的服务器永远原样保留、不受影响。

## 借助 AI agent 安装与使用

本仓库自带 `AGENTS.md`——面向 agent 的文档（OpenCode、Claude Code 等编码 agent 会自动读取），内含安装步骤、数据格式与安全不变量。按顺序把下面三段提示词交给 agent 即可。

**提示词 1——安装工具：**

> 在本机安装 pmcp：
> 1. 检查 `node --version`，要求 >= 18；缺失或过旧时先用平台包管理器安装/升级 Node.js（Windows：`winget install OpenJS.NodeJS.LTS`，macOS：`brew install node`，Linux：发行版自带包管理器或 nvm）；
> 2. 在本仓库目录执行 `npm install`（拉取依赖 commander、prompts），再执行 `npm install -g .`（等价于 `npm run setup`）为当前用户注册 `pmcp` 命令——任何操作系统/终端都无需手工配置环境变量；
> 3. 验证：`pmcp --version` 输出 `1.0.0`，`pmcp --help` 退出码 0；
> 4. 报告命令的安装位置与任何错误。

**提示词 2——初始化注册表（首次运行）：**

> 阅读本仓库根目录的 `AGENTS.md`，运行 `pmcp init`，从现有客户端全局配置（`~/.claude.json`、OpenCode 用户配置）生成 `~/.pmcp/registry.json`。报告结果，包括被跳过的条目（既无 command 亦无 url、或 type 不受支持的条目）。若 `pmcp init` 因不存在任何客户端全局配置而以退出码 1 结束，请按 AGENTS.md 的统一条目格式手写 `~/.pmcp/registry.json`。不要在非 TTY 环境运行裸 `pmcp` 命令（它是交互式 checkbox UI）。

**提示词 3——按项目管理服务器（日常使用）：**

> 在 `<项目路径>` 中，为 Claude Code 与 OpenCode 同时启用 `~/.pmcp/registry.json` 里的 `<id 列表>` 服务器，条目定义按 AGENTS.md 的生成规则写入；pmcp 不管理的键与服务器一律保留。

当然，也可以自己在项目目录运行 `pmcp`，用 checkbox 界面交互管理。

## 命令一览

| 命令 | 说明 |
| --- | --- |
| `pmcp` | 对当前目录进行交互式服务器选择 |
| `pmcp init` | 从 `~/.claude.json` 与 `~/.config/opencode/opencode.json` 初始化/更新 `~/.pmcp/registry.json`。全局文件永远只读；注册表只新增条目、同名差异需逐项确认后才覆盖、从不删除。可重复执行（幂等）。 |
| `pmcp register` | 与 `init` 方向相反：把**当前项目**的服务器（`.mcp.json` + `opencode.json`）合并进 `~/.pmcp/registry.json`，规则相同（只新增、逐项确认、永不删除、幂等）。若两个项目文件对同一服务器定义不一，`pmcp` 会询问注册哪一份（或跳过）；注册表缺失时提示先运行 `pmcp init`。绝不触碰项目文件与客户端全局文件。 |
| `pmcp lang [en\|zh]` | 查看或设置界面语言（持久化到 `~/.pmcp/settings.json`） |
| `pmcp --help` / `--version` | 用法 / 版本号，不进入交互 |

退出码：`0` 成功或用户取消（取消绝不写文件）；`1` 致命错误（如注册表/配置 JSON 损坏——此时任何文件都不会被修改）。

## 注册表格式

`~/.pmcp/registry.json` 是 checkbox 列表的唯一事实源。每一份统一（canonical）定义只存一条，示例：

```json
[
  {
    "id": "git",
    "name": "Git",
    "description": "Git repository tools",
    "command": "uvx",
    "args": ["mcp-server-git"],
    "env": { "KEY": "value" }
  },
  {
    "id": "remote-example",
    "name": "Remote Example",
    "description": "SaaS MCP 服务器",
    "url": "https://mcp.example.com",
    "type": "http"
  }
]
```

每个条目只保存**一份统一（canonical）启动定义**，含两形态：**本地**（`command` + 可选 `args`/`env`）与**远程**（`url` + `type`，`type` 为 `http`/`sse`/`ws`，采用 Claude Code 词汇）。面向各客户端的专属格式在写入时即时生成。

保存本地条目时：Claude Code 得到 `{ "command": "uvx", "args": ["mcp-server-git"], "env": {...} }`；OpenCode 得到 `{ "type": "local", "command": ["uvx", "mcp-server-git"], "environment": {...}, "enabled": true }`。保存远程条目时：Claude Code 得到 `{ "type": "http", "url": ... }`（按存储的 `type` 原样写出）；OpenCode 得到 `{ "type": "remote", "url": ..., "enabled": true }`。历史的双格式条目（含 `claude`/`opencode` 字段）仍可加载，按 `claude` 字段归一化，且不重写文件。你也可以手工编辑该文件——只有 `pmcp init`（及其反向 `pmcp register`）可以改写它，且只有 `pmcp init` 能创建它。

## 已知限制

- 支持远程（`url` 型）服务器：注册表以 `{ "url", "type" }`（`http`/`sse`/`ws`）保存；既无 command 亦无 url、或 type 不受支持的条目（如 sdk/plugin）会被跳过并提示。
- `opencode.json` 必须是纯 JSON（若为含注释的 JSONC，注释会在重写时丢失）。
- 写文件为整体 `writeFileSync`（非原子写），v1 接受该权衡。

## 卸载

```bash
npm run teardown   # 即 npm uninstall -g pmcp
rm -rf ~/.pmcp     # 可选：删除注册表与设置
```

---

[English version: README.md](README.md)
