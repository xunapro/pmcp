# Tasks

## 1. i18n 文案

- [x] 1.1 在 `src/i18n.js` 的 `MESSAGES.en` 与 `MESSAGES.zh` 成对新增 register 相关键（`cli.registerDesc`、`register.conflictMessage`、`register.choiceClaude`/`choiceOpencode`/`choiceSkip`、`register.summary`、`register.nothingToRegister`、项目版跳过提示键），并验证 `node --check src/i18n.js` 通过、zh 表之外无 CJK 字符串
- [x] 1.2 验证新增 i18n 键可用：`node -e "const m=require('./src/index.js'); m.setLanguage(require('os').homedir(),'en'); for (const k of [m.cliRegisterDesc_KEY? 用数组手列键]) console.log(m.t(k,{...}))"`，en 与 zh 各渲染一遍确认无缺失占位符

## 2. model.js 定义比较助手

- [x] 2.1 在 `src/model.js` 新增并导出 `sameLaunchDef(a, b)`（比较 `canonicalToClaude` 后 JSON 相等），并在 `module.exports` 暴露；验证 `node -e` 对相同/不同 canonical 定义分别返回 true/false

## 3. registry.js 合并核心与 register 编排

- [x] 3.1 从 `initRegistry` 抽取 `mergeIntoRegistry(doc, entries, promptfn)` 纯合并核心（只新增/同定义跳过/差异确认默认否），将 `initRegistry` 改为调用它；验证 `init` 场景逐步回归：`pmcp init` 在临时 HOME 场景下 added/updated/跳过计数与抽取前行为一致
- [x] 3.2 新增 `collectProjectEntries(projectDir, notices)`：用 `persistence.readJsonObject` 严格读取 `.mcp.json`/`opencode.json`，按 id 汇总两来源定义，产出 `{ entries, conflicts, unconvertible }`（单来源采纳、双来源 `sameLaunchDef` 相同去重、双来源不同进 conflicts、无法归一跳过计数）；验证非法 JSON 项目文件下抛错且消息指明文件名
- [x] 3.3 实现 `registerToRegistry(projectDir, home)` 编排：注册表缺失→打印 `registry.missing` 提示退出码 0 且零写入；conflicts 逐项走选边提示后归一进候选；`mergeIntoRegistry` 有变化才 `writeJsonObject`；打印含五类计数的摘要；无来源/无可归一条目时打零结果摘要；验证错误路径（项目 JSON 损坏、注册表损坏）非零码退出且注册表不被修改
- [x] 3.4 在 `src/registry.js` 的 `module.exports` 与 `src/index.js` 兼容 re-export 中补 `collectProjectEntries`、`registerToRegistry`（并同步 `sameLaunchDef`）；验证 `node -e "console.log(Object.keys(require('./src/index.js')).length)"` 计数增加且无重复键

## 4. ui.js 选边提示

- [x] 4.1 新增 `promptSourceChoice(id)`：`prompts.select` 提供 Claude Code(.mcp.json)/OpenCode(opencode.json)/跳过 三个选项；后台取消不终止流程、返回 null（视为跳过该 id）；验证交互路径返回值与取消路径

## 5. index.js command 装配

- [x] 5.1 在 commander 装配 `program.command('register')`（描述走 `t('cli.registerDesc')`），action 调 `registerToRegistry(process.cwd(), userHome)`；验证 `pmcp --help` 出现 register 且 `pmcp register` 在临时 HOME 下输出 init 引导提示、退出码 0

## 6. 文档

- [x] 6.1 更新 `AGENTS.md`：Invariant 4 措辞改为"`~/.pmcp/registry.json` 仅由 `pmcp init` 创建、由 `init` 与 `register` 维护改写"；非 TTY 安全子命令清单注明 `register` 为交互依赖命令（管道下确认全部取消视为否/跳过）
- [x] 6.2 更新 `README.md` 与 `README_ZH.md`：新增 `register` 子命令的用法与对比（与 `init` 的方向差异）、目录结构、非 TTY 行为说明；验证两文档命令示例与实际输出一致

## 7. 回归与验证

- [x] 7.1 运行 AGENTS.md 校验：`for f in index i18n model registry persistence ui; do node --check "src/$f.js"; done` 全绿；`node -e "const m=require('./src/index.js');console.log(Object.keys(m).length)"` 无异常；`pmcp --version` 输出 1.0.0 退出码 0；`pmcp --help` 含 register
- [x] 7.2 临时 HOME 冒烟（不改真实 `~/.pmcp`）：registry 缺失时 `pmcp register` 提示先 init、退出码 0、零创建；损坏项目 JSON 与损坏注册表两条路径均非零码且不修改任何文件
- [x] 7.3 临时 HOME 功能冒烟：预置 registry.json + 双项目文件，覆盖"只新增/双文件同 id 选边/同名覆盖确认（含非 TTY 取消=跳过）/幂等重复/远程跳过/从不删除"各一条路径，逐一断言注册表最终内容，并人工核对 5 条 Invariants 全部保持
