# Proposal

## Why

`src/registry.js` 已长到 316 行，混装三类职责：注册表读取/归一化、来源收集（客户端全局 + 当前项目）、合并与注册/初始化编排。三种维护语义（只新增/确认覆盖/永不删除）在 init、register 两条路径及两个收集器之间交织，继续堆下去会放大理解成本。按既有缝合线拆分，把"来源规范化"与"落盘编排"两个关切分开，行为零变化。

## What Changes

- 新增 `src/sources.js`：从 `src/registry.js` 原样搬移 `readGlobalFile`、`collectGlobalEntries`、`collectProjectEntries`。
- `src/registry.js` 裁到 ~215 行：保留 `registryFilePath`、`normalizeUserEntry`、`loadRegistry`、`mergeIntoRegistry`、`initRegistry`、`registerToRegistry`，收集器改为从 `./sources` 导入。
- `src/index.js` 的 `collectGlobalEntries`/`collectProjectEntries` 改从 `./sources` 导入并保持 re-export 同名同量（`require('src/index.js')` 外部面完全不变）。
- `AGENTS.md` 模块布局：六模块 → 七模块，依赖链更新为 `index → {registry, sources, persistence, ui, i18n}`、`registry → {sources, persistence, model, i18n}`、`sources → {persistence, model, i18n}`。
- 无 CLI 输出、文件格式、交互行为变化；纯重构，`skip_specs: true`。

## Capabilities

无。纯内部重构，不改变任何可观察行为。

## Impact

- 代码：新增 `src/sources.js`；`src/registry.js` 精简；`src/index.js` 导入路径微调。
- 文档：`AGENTS.md` 模块布局与依赖链段落。
- 依赖：零新依赖；CommonJS、LF 行尾、CJK 只出现于 i18n zh 表等不变。
- 版本号与 package.json：不变。
