# Tasks

## 1. 提取 src/sources.js

- [x] 1.1 新建 `src/sources.js`，从 `src/registry.js` 原样搬移 `readGlobalFile`、`collectGlobalEntries`、`collectProjectEntries`（含 `collectGlobalEntries` 内的 Claude 优先注释），配齐依赖导入（fs、path、i18n、model、persistence）并导出三函数；验证 `node --check src/sources.js` 通过、`node -e "console.log(Object.keys(require('./src/sources.js')).join())"` 输出 `readGlobalFile,collectGlobalEntries,collectProjectEntries`、保持 LF 行尾

## 2. 精简 registry.js

- [x] 2.1 从 `src/registry.js` 删除三个收集器函数，导入改为 `const { readGlobalFile, collectGlobalEntries, collectProjectEntries } = require('./sources');`，从第一批导入中移除不再使用的 `TARGETS` 与 `readJsonObject`，`module.exports` 收窄为 `registryFilePath / normalizeUserEntry / loadRegistry / mergeIntoRegistry / initRegistry / registerToRegistry`；验证 `node --check src/registry.js` 通过、`node -e "Object.keys(require('./src/registry.js'))"` 不含三个收集器

## 3. 更新 index.js 导入

- [x] 3.1 `src/index.js` 的 `collectGlobalEntries`/`collectProjectEntries` 改从 `./sources` 导入并保持 re-export；验证 `Object.keys(require('./src/index.js')).join()` 与重构前完全一致（19 个键、无重复、无缺失）

## 4. 更新 AGENTS.md

- [x] 4.1 更新模块布局"六模块"为"七模块"并补 `sources.js` 职责，依赖链改为 `index → {registry, sources, persistence, ui, i18n}`、`registry → {sources, persistence, model, i18n}`、`sources → {persistence, model, i18n}`；验证 grep 无残留旧依赖描述（`registry → {persistence, model, i18n}` 旧链只在已更新处出现）

## 5. 回归

- [x] 5.1 全量校验：`for f in index i18n model persistence registry sources ui; do node --check "src/$f.js"; done` 全绿；`pmcp --version` 输出 1.0.0、`pmcp --help` 含 register 与 init；`Object.keys(require('./src/index.js')).length` 保持 19
- [x] 5.2 临时 HOME 冒烟：预置客户端全局 + 双项目文件，覆盖 `pmcp init`（added/updated/kept/remote-skip）与 `pmcp register`（只新增/双文件选边跳过/覆盖默认否/幂等/远程跳过/永不删除/注册表缺失引导）各路径，断言输出计数与注册表内容正确，5 条 Invariants 保持
