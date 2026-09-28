# Design

## Context

Motivation 见 proposal.md。现状相关结构：`src/registry.js` 已有 `loadRegistry`、`collectGlobalEntries`、`initRegistry`（含"只新增/同名确认覆盖/永不删除/幂等"合并循环与逐项 confirm）；`src/model.js` 提供双客户端格式 ⇄ canonical 的归一/生成；`src/persistence.js` 的 `readJsonObject` 对非法 JSON 直接抛错（消息指明文件与路径）；`src/ui.js` 已有 prompts 封装与 `cancelExit`；`src/index.js` 用 commander 装配 `init`/`lang`。

`pmcp init` 的"来源收集 + 合并确认 + 落盘"三阶段与 register 完全同构，唯一差异是来源（客户端全局 vs 项目文件）与注册表缺失时的处理（init 创建、register 提示）。因此核心思路是抽公共合并核心、换来源收集器。

## Goals / Non-Goals

**Goals:**
- 抽取并复用以注册表为目标的合并流程，`init` 与 `register` 共享，语义一致。
- 增量：只新增、同名定义不同逐项确认（默认否）、永不删除、幂等；`register` 额外做项目内双文件不一致的选边提示。
- 保持 Invariant 1/2/3/5 完好，Invariant 4 扩为"`init` 与 `register` 维护注册表，仅 `init` 可创建"。
- 零新依赖，纯 CommonJS 增量。

**Non-Goals:**
- 不回写客户端全局文件（`~/.claude.json` 等）。
- 不做双向同步或"启用状态"的跨项目镜像——`register` 只动 `~/.pmcp/registry.json` 的可选列表，不碰任何项目文件。
- 不改变主命令与 `init`/`lang` 既有行为。

## Decisions

### D1: 抽取 `mergeIntoRegistry(doc, entries, prompts)` 公共合并核心
把 `initRegistry` 里的合并循环（`src/registry.js:141-160`）抽为纯增量合并函数：对每个来源条目，缺失→追加；同定义（复用 init 的 `JSON.stringify(canonicalToClaude(a)) === JSON.stringify(canonicalToClaude(b))` 比较）→跳过；定义不同→逐项 confirm（默认否）→按结果替换或保留。返回 `{ doc, added, updated, skippedChanges }`，不做 IO。`init` 与 `register` 各自负责"装载现有注册表 + 落盘 + 摘要打印 + 缺失处理"，使两命令行为差异局部化：
- `init`：注册表缺失→视为空文档继续，最终`fs.mkdirSync` + 写文件（创建）。
- `register`：注册表缺失→复用主命令的 `registry.missing` 提示，退出码 0，不写任何文件。

理由：合并逻辑只有一份，两路径的确认覆盖语义天然一致；替代方案是复制循环，会埋下语义漂移。同定义判断沿用 init 现有实现并提取为 `sameLaunchDef(a,b)` 供跨文件去重与注册表比对复用；env 键序差异可能判定为不同→仅多触发一次默认否的确认，安全。

### D2: 新增 `collectProjectEntries(projectDir, notices)` 来源收集器
与 `collectGlobalEntries`（`src/registry.js:82-117`）同构，但来源为当前项目文件且语义不同：
- 用 `persistence.readJsonObject`（**严格**读取）读 `.mcp.json` 与 `opencode.json`：任一文件缺失→视为无该来源；任一文件非法 JSON/非对象→直接抛错（沿用 `project.*` 消息，指明文件名），由上层以非零码终止且不碰注册表。init 的全局文件用宽松 `readGlobalFile`（notice 后跳过）是因约束"全局文件缺失不致命"；项目文件按 cli-invocation delta 是致命错误。
- 按 id 汇总两来源原始定义（`{id: {claude?, opencode?}}`）：
  - 单来源 → 该来源归一为 canonical → 候选条目。
  - 双来源且 `sameLaunchDef` 相同 → 归一一次 → 候选条目（去重）。
  - 双来源且不同 → 进 `conflicts` 列表（携带两份原始定义），不自动裁决。
  - 无法归一（`toCanonicalFromX` 返回 null，如仅 `url`）→ `unconvertible` 计数 + notice，跳过。
- 返回 `{ entries: [], conflicts: [], unconvertible: n }`。

### D3: 项目内冲突选边提示（ui.js）
新增 `promptSourceChoice(id)`：`prompts.select`，选项 `[Claude Code (.mcp.json)`, `OpenCode (opencode.json)`, `跳过]`；后台取消（`onCancel` 不终止流程）→ 返回 null，视为跳过该 id，其余继续，退出码 0——对齐 spec"选边提示取消即跳过"。选中的一侧归一进候选条目。此提示与 D1 的覆盖确认是**两层独立确认**，取消语义各自定义（选边取消=跳过该 id；覆盖确认取消=不覆盖），不会互相吞状态。

### D4: `registerToRegistry(projectDir, home)` 命令编排
流程：`resolveLanguage` → `collectProjectEntries`（抛错则 stderr+非零码退出）→ `loadRegistry`，null 时打 `registry.missing`、退出码 0 → 对 `conflicts` 逐个 `promptSourceChoice` 并归一进候选 → `mergeIntoRegistry` → 有变化才 `writeJsonObject` → 摘要。总量统计含 `added / updated / skippedChanges / conflictsSkipped / unconvertible`。无任何项目文件或无候选条目时打印零结果摘要，退出码 0。

### D5: CLI 装配与兼容面（index.js）
`program.command('register').description(...)`，action 内 `await registerToRegistry(process.cwd(), userHome)`；`module.exports` 增补 `collectProjectEntries`、`registerToRegistry` 的 re-export（外部只 require `src/index.js`）。两次 confirm/选择均走 prompts，非 TTY 下取消即跳过——与 init 一致地"安全空操作"，AGENTS.md 会明确 `register` 不在非 TTY 安全子命令清单内。

### D6: i18n（src/i18n.js）
en/zh 成对新增：`cli.registerDesc`；`register.conflictMessage`（选边，含 id）；`register.choiceClaude/choiceOpencode/choiceSkip`；`register.summary`（含五类计数参数）；`register.nothingToRegister`（无来源/无可归一条目时）。复用既有 `registry.missing`、`project.*`（读项目文件报错）、`global.skipUnconvertible` 风格的跳过提示（按需新增其项目版键）。除 MESSAGES 的 zh 表外源码不出现 CJK。

### D7: 文档
- `AGENTS.md` Invariant 4 措辞改为：交互/保存流程不创建或改写注册表（只有 `pmcp init` 与 `pmcp register` 写它，且仅 `init` 能创建）。
- AGENTS.md 非 TTY 安全子命令清单补一句：`register` 属交互依赖命令，管道下确认会全部取消（视为否/跳过）。
- 新增子命令描述进 `--help` 文案；README 补偿目录更新。

## Risks / Trade-offs

- [两层确认（选边 + 覆盖）可能让带着大量条目的用户觉得繁琐] → 都默认否/跳过，且摘要列出每类计数，误操作不产生破坏。选边仅在项目文件内真分叉时出现，属低频路径。
- [非 TTY/管道执行 `register` 会表现为"什么都没注册"（提示全部取消）] → AGENTS.md 明确 `register` 不进非 TTY 安全清单；agent 程序化场景仍直接编辑 `~/.pmcp/registry.json`。此为安全性取舍，与 init 一致。
- [抽取合并核心触及 init 既有路径] → 提交前跑 AGENTS.md 完整校验（`node --check`、require 冒烟、`pmcp --version/--help`、临时 HOME 冒烟）并人工复核 init 场景 2.2–8.2，确保行为零回退。
- [`sameLaunchDef` 用 canonicalToClaude 的 JSON compare，env 键序差异视为不同] → 只会导致多一次默认否确认，不会错误覆盖；可接受。

## Migration Plan

- 纯新增命令，无迁移。回滚：`npm run teardown` 卸包；`pmcp` 主流程/`init`/`lang` 不受影响。项目文件由用户自行管理（register 不触碰任何项目文件）。
- 文档（AGENTS.md、README）随本变更一起落地。

## Open Questions

无阻塞项。细节假设已记录：项目无任何文件或全无可归一条目时打印零结果摘要并以退出码 0 结束（不报错、不写注册表）。
