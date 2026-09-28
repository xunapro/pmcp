# AGENTS.md — PMCP

面向 AI agent 的项目初始化与操作文档。人类文档见 README.md（中文版 README_ZH.md）。

## What this is

`pmcp` = Project MCP Manager。Node.js CLI（CommonJS，零构建），交互式管理项目级 MCP 配置，写入 `.mcp.json`（Claude Code）与 `opencode.json`（OpenCode）。实现按职责拆分为 `src/` 七模块：入口 `index.js`（commander 装配、`run()` 编排、兼容 re-export）+ `i18n.js` / `model.js` / `registry.js` / `persistence.js` / `sources.js` / `ui.js`；依赖单向：index → {registry, sources, persistence, ui, i18n}，registry → {sources, persistence, model, i18n}，sources → {persistence, model, i18n}，persistence/ui → {model, i18n}，model/i18n 零内部依赖。`registry.js` 负责注册表读/归一/合并编排，来源收集（客户端全局 `collectGlobalEntries`、项目 `collectProjectEntries`）在 `sources.js`。

## Bootstrap on a fresh machine

按顺序执行；每步都有可验证的输出，失败即停：

```bash
node --version          # 前置要求: >= 18
npm install             # 安装依赖（commander、prompts）
npm install -g .        # 全局安装并注册 pmcp 命令（Windows/Linux/macOS、任意终端通用，无需手工设置 PATH）
pmcp --version          # 期望输出 1.0.0，退出码 0
```

开发模式可用 `npm link` 替代全局安装（改源码即时生效）。

## First-run initialization (per user account)

```bash
pmcp init               # 从 ~/.claude.json 与 ~/.config/opencode/opencode.json 建 ~/.pmcp/registry.json
pmcp lang zh            # 可选，默认 en
```

- 前置条件：至少一个全局来源文件存在且 JSON 合法，否则 `pmcp init` 退出码 1。
- init 语义：只新增、同名差异逐项确认（默认否）、从不删除、全局文件永远只读。
- 若用户没有任何客户端全局配置（全新环境）：直接按下方格式手写 `~/.pmcp/registry.json`，这是被支持的路径。

## Operating non-interactively (agent note)

`pmcp` 主命令是 TTY checkbox 交互，**agent 不要在管道中运行裸 `pmcp`**。程序化场景：

- 改可选列表：编辑 `~/.pmcp/registry.json`（唯一事实源，`pmcp init`/`pmcp register` 可对其增量改写，其余流程不改写它）。
- 改项目启用集：直接编辑项目 `.mcp.json` / `opencode.json` 的 `mcpServers` / `mcp` 段，条目定义用下方生成规则，与 pmcp 落盘结果等价。
- 非 TTY 下仅这些子命令可安全直接运行：`pmcp --help`、`pmcp --version`、`pmcp lang [en|zh]`、`pmcp init`（差异确认会被取消并视为否）。`pmcp register` 属交互依赖命令：非 TTY 下选边与覆盖确认全部取消（视为否/跳过），不会写入；程序化增改注册表仍直接编辑 `~/.pmcp/registry.json`。

## Data files & formats

`~/.pmcp/registry.json` — 条目为单份 canonical 启动定义，含两形态：

```json
[{ "id": "git", "name": "Git", "description": "Git tools",
   "command": "uvx", "args": ["mcp-server-git"], "env": { "K": "V" } },
 { "id": "remote-example", "name": "Remote Example", "description": "SaaS MCP",
   "url": "https://mcp.example.com", "type": "http" }]
```

本地形态为 `command` + 可选 `args`/`env`；远程形态为 `url` + `type`（`http` / `sse` / `ws`，采用 Claude Code 词汇保真）。两形态互斥：含 `url` 即远程。旧版双字段条目（含 `claude`/`opencode`）仍可加载，按 `claude` 字段归一、文件不重写。

落盘生成规则（save 时即时生成，勿在注册表内存双格式）：

- claude 本地 → `{ "command": ..., "args": ..., "env": ... }`（无 `enabled`/`type` 字段）；claude 远程 → `{ "type": "http"|"sse"|"ws", "url": ... }`
- opencode 本地 → `{ "type": "local", "command": [command, ...args], "environment": ..., "enabled": true }`（`command` 必为数组）；opencode 远程 → `{ "type": "remote", "url": ..., "enabled": true }`（传输类型由 url scheme 在客户端判定）

`~/.pmcp/settings.json` — `{ "language": "en" | "zh" }`，由 `pmcp lang` 读写；损坏时按 en 继续、不重写。

项目文件写入是 read-modify-write：只增删注册表内的键，其余键与未知服务器原样保留；序列化 `JSON.stringify(obj, null, 2) + "\n"`。

## Invariants (do not break)

1. 全局来源文件（`~/.claude.json`、OpenCode 用户配置）永远只读。
2. 取消交互 / Ctrl+C：零写入，退出码 0，无堆栈输出。
3. JSON 解析失败：stderr 指明文件、退出码 1、任何写入之前终止（先读后写）。
4. 交互/保存流程不创建或改写 `~/.pmcp/registry.json`（仅 `pmcp init` 创建它；`pmcp init` 与 `pmcp register` 可对其增量改写）。
5. 无法归一的条目（既无 `command` 亦无 `url`，或 `type` 不是受支持的本地/远程传输类型，如 sdk/plugin）：跳过并提示，不支持。

## Code conventions

- 全部用户可见文案在 `src/i18n.js` 的 `MESSAGES = { en, zh }` 中，其他模块只调 `t(key, params)`；除 MESSAGES 的 zh 表外源码不得出现 CJK 字符串。
- 新增消息必须同时提供 en 与 zh 两条。
- CommonJS、无构建步骤、不引入新依赖（现有：commander、prompts）。
- `src/index.js` 首行 shebang，`src/` 全部 js 必须保持 LF 行尾（`.gitattributes` 已固化）；否则 Linux/macOS 安装后无法执行。
- `src/index.js` 的 `module.exports` 是对外兼容 API（拆分后 re-export 各模块公共函数），外部脚本只 require `src/index.js`，勿直接依赖子模块路径。

## Verifying changes

```bash
for f in index i18n model registry persistence ui; do node --check "src/$f.js"; done
node -e "const m=require('./src/index.js');console.log(Object.keys(m).length)"
pmcp --version && pmcp --help
# 冒烟（临时 HOME，避免动真实 ~/.pmcp）：
#   以 HOME/USERPROFILE 指向临时目录运行 pmcp → 期望"registry missing 提示 + 退出码 0 + 零创建"
```

完整回归（2.2–8.2 场景脚本）在会话期临时目录，不在仓库内；改动核心逻辑后至少重跑上面的冒烟并人工核对 5 条 Invariants。

## Rollback

无迁移、纯新增工具：`npm run teardown`（`npm uninstall -g pmcp`），可选删 `~/.pmcp`。项目文件由用户自行恢复。
