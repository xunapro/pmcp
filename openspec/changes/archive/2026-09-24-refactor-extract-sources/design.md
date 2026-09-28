# Design

## Context

动机见 proposal.md。现状依赖：`registry.js` 同时拥有读侧（`loadRegistry`/`normalizeUserEntry`/`registryFilePath`）、来源收集（`collectGlobalEntries`/`collectProjectEntries`/`readGlobalFile`）与写侧编排（`mergeIntoRegistry`/`initRegistry`/`registerToRegistry`）。AGENTS.md 约束依赖单向：`registry → {persistence, model, i18n}`；外部脚本只 `require('src/index.js')`，不直接依赖子模块路径。

## Goals / Non-Goals

**Goals:**
- 把三个来源函数原样搬入新模块，逻辑零改动。
- 保持 `require('src/index.js')` 的导出键集合与数量完全不变。
- 维持依赖单向与 LF 行尾、零新依赖。

**Non-Goals:**
- 不改任何行为、输出、格式、spec（`skip_specs: true`）。
- 不顺手改 i18n/model/persistence/ui。
- 不动 package.json / 版本号 / README 命令文档（不涉及模块划分）。

## Decisions

### D1: 搬哪些函数
`readGlobalFile`、`collectGlobalEntries`、`collectProjectEntries` 连同其私有依赖移入 `src/sources.js`。依赖：`fs`（readGlobalFile 读文件）、`path`、`./i18n`（`t`）、`./model`（`toCanonicalFromClaude/Opencode`、`sameLaunchDef`、`TARGETS`）、`./persistence`（`readJsonObject`）。`registry.js` 保留注册表文件路径、读取/归一化与全部写侧编排。

### D2: 依赖方向与导出面
`sources.js` 依赖 `{persistence, model, i18n}`，不依赖 registry/ui → 单向链成立。导出三个函数；**不再经 registry.js 转手**。`index.js` 改从 `./sources` 导入 `collectGlobalEntries`/`collectProjectEntries` 并继续 re-export（外部面不变；`readGlobalFile` 本就未进 index 外部面，`mergeIntoRegistry` 亦然，均不新增导出）。`registry.js` 的 `module.exports` 收窄为主人职责函数（去掉三个收集器），其导入 `{ toCanonicalFromClaude, toCanonicalFromOpencode, sameLaunchDef, registryEntryToFile }` 与 `writeJsonObject` 保持不变，移除不再使用的 `TARGETS`/`readJsonObject`。

### D3: 搬移方式
逐函数原样搬移，不重写逻辑、不重排语句。`collectGlobalEntries` 内注释（Claude 优先规则）随函数保留。

## Risks / Trade-offs

- [搬移引入行为漂移] → 函数原样剪切；搬完后跑完整临时 HOME 冒烟矩阵：`init`（added/updated/kept/remote-skip）与 `register`（只新增/选边/覆盖确认/幂等/远程跳过/永不删除），外加 exports 键集、`--version`/`--help` 回归。
- [外部代码若按路径 `require('src/registry.js')` 取收集器会断] → AGENTS.md 明确禁止依赖子模块路径，外部面是 `src/index.js`（不变）；本次不提供 registry 路径的收集器别名。

## Migration Plan

- 纯内部重构，无数据迁移。回滚：git 单文件还原；`src/sources.js` 删除、registry/index 还原导入即可。
