# Design

## Context

见 proposal.md - Why。当前仓库是空白项目：仅有 `package.json`（`pmcp` v1.0.0，CommonJS，无依赖、无代码、无 README）。因此本设计描述的是从零搭建，约束只来自提案本身：Node.js + CommonJS、依赖 `commander` 与 `prompts`、实现在 `src/` 目录内（初始为单文件 `src/index.js`，后按 D2 修订拆分）、支持 Claude Code（`.mcp.json`）与 OpenCode（`opencode.json`）两种格式。

## Goals / Non-Goals

**Goals:**
- 一条命令 `pmcp` 进入 checkbox 交互，勾选即启用、取消勾选即禁用，状态跨运行持久化并回显。
- 对两种客户端格式做正确的读/写映射，互不污染对方文件，也不破坏文件中 PMCP 管理范围之外的内容。
- 出错与取消路径绝不留下半写状态。

**Non-Goals:**
- 不做全局 MCP 配置管理（只管项目目录）。
- v1 不支持在 UI 内添加自定义服务器条目（条目通过 `pmcp init` 导入或编辑 `~/.pmcp/registry.json` 扩展）；运行时交互也不自动创建注册表文件。
- 不管理 `.mcp.json` / `opencode.json` 中与 MCP 无关的键（只保留，不编辑）。
- 不回写客户端全局配置（`~/.claude.json`、OpenCode 用户级配置只读）。
- 不支持远程（SSE / streamable HTTP）MCP 服务器类型的注册表条目。
- 不做配置合法性向客户端 schema 的完整校验。
- i18n v1 不做系统 locale 自动检测、不提供临时 `--lang`/环境变量覆盖（只认 `~/.pmcp/settings.json` + `pmcp lang`）。

## Decisions

### D1: 依赖选择 — `commander` + `prompts`
按提案固定：`commander` 做 CLI 解析（`--help` / `--version` 免费获得），`prompts` 提供 `multiselect`（checkbox）与 `cancel` 语义。备选 `inquirer` 更重、API 更面向类式流程；`prompts` 体积小、对取消处理清晰。

### D2: 入口 + 分层拆分（初始单文件，后修订）
初始以单文件 `src/index.js` 实现；功能修订（init、i18n、统一条目模型）叠加后文件超过 550 行、CLI/文案/格式转换/注册表/持久化/UI 职责混杂，故按职责拆分（仍 CommonJS、零构建、`bin` 指向不变）：

- `src/index.js` — 入口：shebang、commander 装配、`run()` 交互流程编排；**保留公共函数的 re-export**，外部 `require('src/index.js')` 兼容，验证脚本零改动。
- `src/i18n.js` — `MESSAGES`、`t`、`resolveLanguage`/`setLanguage` 与当前语言态（原单文件共享可变 `currentLang` 收敛于本模块，跨模块读写天然解决）。
- `src/model.js` — `TARGETS`、`clone`、canonical↔claude/opencode 双向转换与 `registryEntryToFile`（纯格式映射，无 I/O、无其他内部依赖）。
- `src/registry.js` — 注册表读取与归一（`loadRegistry`/`normalizeUserEntry`）、全局来源读取与合并（`readGlobalFile`/`collectGlobalEntries`）、`initRegistry`。
- `src/persistence.js` — 项目文件读写（`readJsonObject`/`readState`/`save`/`writeJsonObject`）。
- `src/ui.js` — prompts 交互封装与摘要输出（`promptServers`/`promptTargets`/`promptConfirm`/`cancelExit`/`printSummary`）。

依赖方向单向：index → {registry, persistence, ui, i18n}；registry → {persistence, model, i18n}（复用 `writeJsonObject`）；persistence/ui → {model, i18n}；model、i18n 不依赖任何其他模块。拆分只搬代码、不改行为。备选：继续单文件（v1 的原始权衡，已随规模失效）、拆 `src/lib/*` 深层目录（体量不需要，一层 `src/` 足够）。

### D3: 注册表条目统一格式与用户级存储
每个注册表条目只保留**一份统一（canonical）启动定义**；面向客户端的专属格式不落库，在写入项目文件时即时生成：

```js
{
  id: "filesystem",
  name: "Filesystem",
  description: "Local file access",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
  env: { KEY: "<placeholder>" } // 可选
}
```

生成方向（保存时）：claude → `{command, args, env}`；opencode → `{type:"local", command:[command,...args], environment:env, enabled:true}`。归一方向（init/加载时）：claude 定义原样即 canonical；opencode local 定义取 `command[0]→command、其余→args、environment→env`；旧版 registry 条目（含 `claude`/`opencode` 双字段）以 `claude` 字段归一（文件不重写）。无法归一的（仅含 `url` 等）跳过并提示。

条目由 `pmcp init`（见 D7）从客户端全局配置导入或用户手工编写产生；pmcp **不再内置默认注册表**（历史版本曾 seed 的 `filesystem`/`git`/`github`/`memory` 条目在旧用户的 `registry.json` 中作为普通条目保留，不再由程序生成）。注册表文件解析失败 → 指明文件名的错误 + 非零退出，不写任何文件（区别于全局来源文件损坏，见 D7 与 R5）。文件不存在 → 交互列出空注册表并提示运行 `pmcp init`，**不自动创建**（创建是 init 命令或用户的显式动作，保持"程序永不悄悄写用户注册表"的不变量）。

### D4: 受管文件判定与状态回显
- 受管文件 = 项目目录内存在的 `.mcp.json`、`opencode.json`，以及「两个都不存在」时用户在 UI 中勾选创建的格式。
- 当前启用集合 = 注册表服务器在**任一**受管文件中出现的并集（对应 spec「并集」要求）。
- 非注册表服务器完全不进入 UI，保存时原样保留（read-modify-write，而非整文件重写模板）。此处「注册表」= `~/.pmcp/registry.json` 的条目（唯一来源，见 D3/D7）。

### D5: 保存语义
对每个受管文件：读入 JSON → 只替换 `mcpServers` / `mcp` 中属于注册表的键（选中则写入**由条目统一启动定义即时生成的该客户端格式定义**，未选中则删除该键）→ 其余键不动 → `JSON.stringify(obj, null, 2) + "\n"` 写回。注册表段全部未选中时保留空对象（`{}`），不删除文件；零选中且文件本不存在则不创建。写入用单次 `fs.writeFileSync`，v1 接受非原子写的风险（见 R2）。

### D6: 取消与错误路径
`prompts({ onCancel })` 统一返回 → `process.exit(0)`，不写文件；JSON 解析失败 → 错误到 stderr + `process.exit(1)`，且在任何写入之前完成全部读取（先读后写，失败即止）。

### D7: `pmcp init`——从全局配置初始化/更新注册表（只增、改需确认、不删）
`pmcp init` 读取两个全局来源（Claude Code `~/.claude.json` 的 `mcpServers`、OpenCode 用户级 `~/.config/opencode/opencode.json` 的 `mcp`），格式归一后写入 `~/.pmcp/registry.json`。运行时交互**不再**动态合并全局配置——注册表文件是唯一来源。

- **只读来源**——绝不写回或格式化全局文件；其语义由客户端自己负责。
- **格式归一**——来源定义先归一为 D3 的 canonical 形式再比较与写入（claude `{command,args,env}` 原样即 canonical；opencode local 取 `command[0]→command、其余→args、environment→env`）；两来源同 id 定义不一致时以 **Claude Code 来源为准**（OpenCode 只补缺失 id，不跨来源拼接字段）；无法归一的（如仅含 `url` 的远程条目，Non-Goals 已排除）跳过并提示。
- **三分支更新策略**：新 id → 以统一格式直接追加；同名且归一后定义与注册表一致 → 不动（幂等）；同名但归一后有差异 → 逐项 confirm（默认否），确认后才以统一格式覆盖该条目。
- **不删除**——注册表中任何条目不因未出现在来源里而被移除（手工条目、历史条目同样保留）。
- 首次 init（文件不存在）→ 创建 `~/.pmcp` 目录并新建文件；两来源均不可用（缺失/非法 JSON）→ 提示并以退出码 1 结束，已有注册表不动；单个来源不可用 → 警告后按可用来源继续。
- **非交互假设**：stdin 非 TTY 时「改」确认一律按否处理（新增照常进行）并列出被跳过的差异条目——新增无风险，修改必须显式意愿。
- init 写入的条目 `name`/`description` 属用户数据：写入后语言切换或重复 init（未确认覆盖时）不改写它们。

备选：保留"同名以注册表为准的静默策略"（旧设计）——但用户无法借它更新全局侧已变更的启动命令；三分支策略在"自动化"与"不悄悄改用户数据"之间取得平衡。

### D8: i18n——消息目录与语言解析
- **范围**：仅 pmcp 自身文案（交互提示/确认/摘要/错误/警告、`--help`/`--version` 文本、init 时生成的导入来源描述）。注册表条目 `name`/`description` 写入文件后属**用户数据**，不随界面语言切换而翻译或改写。
- **机制**：`src/i18n.js` 内 `MESSAGES = { en: {...}, zh: {...} }` 目录 + `t(key, params)`（拆分后语言状态收敛于该模块）；`lang()` 读取 `~/.pmcp/settings.json` 的 `language`（合法值 `en`/`zh`，默认 `en`）。
- **语言解析时机**：commander 的 description/help/版本说明在构建程序前就需定稿 → 启动时先读一次 settings（任何失败静默回退 en），再构建命令；`pmcp` 默认命令与 `pmcp lang` 子命令共用同一解析函数。
- **settings 损坏策略（与 registry.json 的 fatal 不同，有意为之）**：settings 只影响显示、不参与任何数据决策，损坏时提示并按 en 继续，`pmcp lang <code>` 可无损重建；让一个纯显示偏好文件阻断工具启动得不偿失。registry.json 是注册表事实源，读错会产生错误数据，因此必须 fatal（见 D3/D6）。
- **`pmcp lang <code>`**：校验 ∈ {en, zh} → read-modify-write `~/.pmcp/settings.json`（目录不存在则创建；保留未知其他键）；无参 → 打印激活语言；非法 code → 错误（列出支持值）+ 退出码 1，不写文件。

### D9: 文档分层与跨平台安装保障
面向不同读者拆三类文档：`README.md`（英文）与 `README_ZH.md`（中文）互链、内容对齐，服务人类用户；`AGENTS.md` 服务 AI agent——新机器 bootstrap 步骤（每步可验证）、首次 init、非交互操作指引（agent 不在管道中运行裸 `pmcp`，程序化改写注册表/项目文件）、数据格式与落盘生成规则、不可破坏的 invariants、代码约定与验证方法（OpenCode/Claude Code 自动加载仓库根 AGENTS.md）。README 的 agent 章节内置三段可复制提示词：安装工具（含 Node 前置检查与各平台安装命令）、初始化注册表（含 init 退 1 时手写 registry.json 的回退）、按项目管理服务器。跨 OS 安装不依赖手工设置环境变量——命令注册由 npm 全局安装机制完成（bin shim）；`.gitattributes` 固化 `*.js` LF 行尾，保证 shebang 在 Linux/macOS 可执行；`package.json` 以 scripts（`setup` = `npm install -g .`、`teardown`、`verify`）固化安装命令。npm 打包：`README.md` 自动收录，`README_ZH.md` 经 `files` 显式收录，`AGENTS.md` 仅存仓库不发布。

## Risks / Trade-offs

- **R1: `opencode.json` 可能是 JSONC（含注释）** → read-modify-write 会丢注释。v1 假设纯 JSON；文档化该限制。缓解（未来）：引入 `jsonc-parser` 做保留式编辑。
- **R2: 直接覆盖写非原子** → 崩溃时可能损坏用户配置。缓解：写前校验新内容可 `JSON.parse`；失败面仅限写入瞬间，接受为 v1 权衡。
- **R3: 注册表启动定义过时**（包名、参数变化）→ 生成的配置不可用。缓解：条目本就来自用户自己的全局配置，重跑 `pmcp init` 对差异条目确认后同步，或直接编辑 `registry.json`。
- **R4: 并集回显的语义**：服务器只在一个文件里也会显示为已勾选，确认后两个文件都会获得它。与 spec 一致，但需在 UI/摘要里向用户展示将写入哪些文件，避免意外。
- **R5: `~/.claude.json` 可能巨大且非纯 MCP** → Claude Code 的全局文件混有大量非 MCP 状态且可能很大；pmcp 只读取其中 `mcpServers` 子键，解析失败即警告跳过，不改写、不格式化该文件。
- **R6: 全局导入与用户注册表定义冲突** → 同名条目可能命令不同。由 `pmcp init` 的三分支策略处理（D7）：默认保留用户定义，逐项确认后才覆盖；非交互环境一律不覆盖。
- **R7: 远程/不可转换条目** → 全局里仅含 `url` 的服务器无法映射到 local 双形态（Non-Goal 已排除远程）。跳过并在启动信息提示，不静默丢弃。
- **R8: 文案散落导致漏翻译** → 若提示字符串继续内联在流程代码里，新增文案容易只写一种语言。缓解：所有用户可见字符串收敛进 `MESSAGES` 目录，流程只引用 `t(key)`；验收含「源码中除消息目录外无硬编码 UI 文案」检查。
- **R9: 历史版本生成的 registry.json**（含曾内置 seed 的 filesystem/git/github/memory 条目）→ 作为普通用户数据原样保留；本版不再自动生成内置条目，`pmcp init` 只增不改（除确认后覆盖）不删，不需要这些条目的用户可自行手工删除。
- **R10: 旧版双格式条目与新统一格式共存** → 靠加载时归一化兼容（以 `claude` 字段为准，见 D3）；双字段本身互不一致的条目，落盘输出将跟随 `claude` 字段，可能与旧版"各写各的"行为不同——归一化消除了这种歧义，且文件不被重写。
- **R11: 文档描述与实现漂移** → README（中英）与 AGENTS.md 记录了 canonical 条目格式、落盘生成规则、退出码与安装命令；条目模型或命令行为再变化时必须同步三份文档（本次修订即为一次同步）。缓解：三份文档与 specs/tasks 同仓评审，agent 提示词只引用 AGENTS.md 而非硬编码第二份规则。
- **R12: 模块拆分属纯重构，风险在行为漂移** → 以现有验证脚本（2.2–9.3 全场景）作为回归门槛：拆分后脚本经 `index.js` 兼容导出零改动运行、全部通过才算完成；同时保持 `src/index.js` 首行 shebang 与 LF 行尾（.gitattributes 固化）不受搬动影响。

## Migration Plan

纯新增（新工具、新文件），无迁移。行为变更点：① 默认语言由中文变为英文（希望中文者运行 `pmcp lang zh`）；② 不再有内置注册表/自动 seed——历史版本生成的 `~/.pmcp/registry.json` 原样保留为普通条目（R9），从未初始化过的用户交互前需先运行 `pmcp init`；③ 条目存储由双格式改为单份统一格式——旧双格式文件加载时自动归一（R10），无需手工迁移，`init` 写入的新条目为统一格式。回滚 = 删除整个 `src/` 目录、还原 `package.json`、删除新增的 `README.md`/`README_ZH.md`/`AGENTS.md`/`.gitattributes`、（可选）删除运行产生的 `~/.pmcp/`（registry.json 与 settings.json）。

## Open Questions

- `github` 条目的 token 是否要在 UI 中提供输入框（v1 先写占位符 `GITHUB_PERSONAL_ACCESS_TOKEN` 到 env 即可）。
- `pmcp init` 是否要提供批量覆盖确认的 `--yes`/`--force` 旗标（v1 不做，逐项确认已够用）。
- 统一格式未来是否为远程服务器增加 `url` 字段（v1 Non-Goal 排除远程，canonical 仅 command/args/env）。
- 未来若增加临时语言覆盖（`--lang` 参数或环境变量），其与 `~/.pmcp/settings.json` 的优先级需定义（当前设计：只认 settings 文件，无临时覆盖）。
