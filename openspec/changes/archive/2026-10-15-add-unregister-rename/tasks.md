# Tasks

## 1. i18n 消息

- [x] 1.1 在 `src/i18n.js` 的 `MESSAGES.en` 与 `MESSAGES.zh` 中新增 unregister 相关消息（`cli.unregisterDesc`、`unregister.message`、`unregister.confirmProjectRemove`、`unregister.summary`、`unregister.noneToRemove`），并校验 `node --check src/i18n.js` 通过、en/zh 各有一条
- [x] 1.2 在 `src/i18n.js` 的 `MESSAGES.en` 与 `MESSAGES.zh` 中新增 rename 相关消息（`cli.renameDesc`、`cli.renameIdArg`、`cli.renameNameArg`、`rename.message`、`rename.namePrompt`、`rename.notFound`、`rename.emptyName`、`rename.success`、`rename.noneToRename`），并校验 `node --check src/i18n.js` 通过、en/zh 各有一条

## 2. persistence 辅助

- [x] 2.1 在 `src/persistence.js` 新增 `removeFromProject(projectDir, ids, state)`：对 `state.managed` 中每个受管文件，从 `mcpServers`/`mcp` 段落删除指定 `ids`，保留其余键与未知服务器并写回；校验 `node --check src/persistence.js` 通过
- [x] 2.2 导出 `removeFromProject`，并校验 `Object.keys(require('./src/persistence.js'))` 含该函数

## 3. registry 辅助

- [x] 3.1 在 `src/registry.js` 新增 `unregisterFromRegistry(home, ids, projectDir, ...)`：加载注册表（缺失→提示 `pmcp init` 并退出码 0；解析失败→stderr 报错退出码 1），用 `readState` 判断被移除 id 是否在当前项目启用，按需触发 `removeFromProject`，删除所选条目后 `writeJsonObject(..., doc.map(registryEntryToFile))` 写回；校验 `node --check src/registry.js` 通过
- [x] 3.2 在 `src/registry.js` 新增 `renameRegistryEntry(home, id, newName)`：加载注册表，定位 id（不存在→stderr 报错退出码 1），更新 `entry.name` 与 `entry._raw.name`，`writeJsonObject(..., doc.map(registryEntryToFile))` 写回；校验 `node --check src/registry.js` 通过
- [x] 3.3 在 `src/index.js` 的 `module.exports` 追加 `unregisterFromRegistry`、`renameRegistryEntry`、`removeFromProject`，并校验 `node -e "const m=require('./src/index.js');console.log(Object.keys(m).length)"` 能正常运行

## 4. ui 交互

- [x] 4.1 修改 `src/ui.js` 的 `promptTargets(preselectedKeys)`：`preselectedKeys` 非空时预选这些键，为空时默认预选全部受支持格式；校验 `node --check src/ui.js` 通过
- [x] 4.2 在 `src/ui.js` 新增 unregister 交互（多选全部注册表条目）与“是否同时从项目移除”的合并确认（列出受影响 id），并校验 `node --check src/ui.js` 通过
- [x] 4.3 在 `src/ui.js` 新增 rename 交互（条目选择 + 文本输入新名称，空名拒绝），并校验 `node --check src/ui.js` 通过
- [x] 4.4 在 `src/ui.js` 导出新增的交互函数，并校验 `node -e "const u=require('./src/ui.js');console.log(Object.keys(u).length)"` 能正常运行

## 5. index.js 命令装配与主流程

- [x] 5.1 在 `src/index.js` 用 commander 新增 `unregister` 子命令，`action` 调用 `unregisterFromRegistry(process.cwd(), home, ...)`；校验 `pmcp --help` 输出含 `unregister`
- [x] 5.2 在 `src/index.js` 用 commander 新增 `rename [id] [name]` 子命令，参数齐全走 `renameRegistryEntry`，缺参走交互；校验 `pmcp --help` 输出含 `rename`
- [x] 5.3 修改 `src/index.js` 的 `run()`：去掉“`state.managed` 非空直接沿用”分支，改为总是 `promptTargets(state.managed)`，保留“无受管文件且未选服务器”时提前返回 `noneSelected`；校验 `node --check src/index.js` 通过
- [x] 5.4 校验 `pmcp --version` 输出 1.0.0、`pmcp --help` 退出码 0

## 6. 文档

- [x] 6.1 更新 `AGENTS.md`：第 4 条不变量改为 `init`/`register`/`unregister`/`rename` 可改写 `~/.pmcp/registry.json`，并在“非交互操作”小节补充 `unregister`/交互式 `rename` 在非 TTY 下取消、`rename <id> <new>` 可非交互执行
- [x] 6.2 更新 `README.md` 与 `README_ZH.md`：命令表加入 `unregister`、`rename`，说明主流程总是询问目标格式并预选受管格式
- [x] 6.3 校验文档改动不引入 CJK 到 `src/` 源码（除 `MESSAGES.zh` 外），并核对与 `AGENTS.md` 的 invariants 一致

## 7. 回归验证

- [x] 7.1 对 `index i18n model registry persistence ui` 逐个运行 `node --check src/<file>.js`，全部通过
- [x] 7.2 以临时 HOME 冒烟：`pmcp` 在无 `~/.pmcp/registry.json` 时输出 registry missing 提示、退出码 0、零创建
- [x] 7.3 以临时 HOME 手工写入注册表后冒烟：`pmcp unregister` 可列出条目并移除；`pmcp rename <id> <name>` 改显示名且不动 `id`；`pmcp` 主流程总是弹出目标格式询问并预选受管格式
- [x] 7.4 核对 5 条 invariants：取消/非 TTY 零写入、JSON 失败先读后写、全局来源只读、未触及条目原样保留
