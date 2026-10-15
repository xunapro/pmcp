# Design

## Context

当前 `~/.pmcp/registry.json` 只能由 `pmcp init` / `pmcp register` 增量改写（只新增、改需确认、从不删除）。`src/index.js` 通过 commander 装配 `init` / `register` / `lang` 三个子命令与主流程；`src/registry.js` 负责注册表读/归一/合并；`src/ui.js` 提供 `promptServers` / `promptTargets` / `promptConfirm` 等 prompts；`src/persistence.js` 的 `save()` 把所选集合写进受管项目文件并移除未选中项。主流程 `run()` 在 `state.managed` 非空时直接把 `targetKeys` 设为 `state.managed`，自动跳过目标格式询问。

参见 proposal.md 的 Why；spec 见 `specs/registry-management/spec.md` 与 `specs/interactive-server-selection/spec.md`。

## Goals / Non-Goals

**Goals:**
- 新增 `pmcp unregister`：交互式多选移除注册表条目；对当前项目已启用的服务器，询问是否同时从项目配置文件移除。
- 新增 `pmcp rename`：修改注册表条目显示名称 `name`，支持参数形式与交互式，不改 `id` 与启动定义。
- 主流程总是询问目标格式，预选当前受管格式，允许每次运行调整。
- `unregister` / `rename` 成为可改写 `~/.pmcp/registry.json` 的命令，并遵循既有取消（零写入、退出码 0、无堆栈）、JSON 失败先读后写、语言跟随等约定。

**Non-Goals:**
- 不改动 `id`（项目文件中使用的键），`rename` 只改显示名称。
- 不改动注册表/项目文件的条目格式或生成规则。
- 不为 `unregister` 增加“批量作用于所有项目”的能力，仅作用于当前工作目录项目。
- 不引入新依赖；不改 `src/index.js` 对外的兼容导出集合（新增内部函数即可，必要时追加 re-export）。

## Decisions

### Decision 1: 逻辑归属 —— unregister/rename 放 registry.js，命令在 index.js，交互在 ui.js
新增 `unregisterFromRegistry(home, ids, projectDir, ...)` 与 `renameRegistryEntry(home, id, newName, ...)` 到 `src/registry.js`，与 `initRegistry` / `registerToRegistry` 同层；`src/index.js` 用 commander 装配 `unregister` / `rename` 子命令；新交互（unregister 多选、rename 选择+文本、目标格式预选）放在 `src/ui.js`。
- **备选**：把逻辑写进 `src/index.js`。否决：`index.js` 只做装配与编排，职责拆分原则要求注册表读写留在 `registry.js`。

### Decision 2: unregister 从项目文件移除 —— 新增外科式删除而非复用 save()
新增 `removeFromProject(projectDir, ids, state)` 到 `src/persistence.js`：对 `state.managed` 中的每个受管文件，从 `mcpServers`/`mcp` 段落删除指定 `ids`，保留其余键与未知服务器，并写出文件。
- **备选**：复用 `save()`，把 `selectedIds` 设为“当前启用集合减去被移除项”。否决：`save()` 会重写所有启用服务器并依赖“被移除项仍留在 registry”，逻辑绕且引入不必要的重写。外科式删除更贴近“只移除这几个 id”的语义，并复用 `readState` 的 `state.data`。

### Decision 3: rename 更新 name 同时更新 _raw
`normalizeUserEntry` 会把文件里的原始条目存到 `_raw`；`registryEntryToFile` 在存在 `_raw` 时原样返回它。因此改名时除更新 `entry.name` 外，还必须同步更新 `entry._raw.name`，否则写回的文件仍是旧名。对旧版 `claude`/`opencode` 双字段条目，这样既保留原始形状又反映新名称。
- **备选**：丢弃 `_raw` 重构条目。否决：会丢失旧版双字段形状，违背“保留其余原样”。

### Decision 4: 目标格式总是询问并预选受管格式
`promptTargets(preselectedKeys)` 改为接受预选集合：`preselectedKeys` 非空时预选这些键，为空（新项目）时默认预选全部受支持格式。`run()` 去掉“`state.managed` 非空则直接沿用”的分支，改为总是调用 `promptTargets(state.managed)`；保留“无受管文件且未选任何服务器”时的 `noneSelected` 提前返回，避免空选仍问格式。

### Decision 5: unregister/rename 的取消与空选语义
- `unregister`：多选列表为空（注册表无条目）→ 打印“无可移除条目”并以退出码 0 退出；用户未选任何项直接确认 → 视为取消，零写入、退出码 0。
- `unregister` 对“同时从项目移除”用**单个合并确认**列出所有受影响的服务器 id（一次询问），用户确认才执行 `removeFromProject`，否则只改注册表。
- `rename`：参数形式 `pmcp rename <id> <new-name>` 无需确认，id 不存在或名称为空时报错并以非零码退出；交互式 `pmcp rename` 在非 TTY 下取消（零写入、退出码 0）。

### Decision 6: 注册表改写统一走 `doc.map(registryEntryToFile)`
`unregister` 删除所选条目后、`rename` 更新 name 后，都用 `writeJsonObject(registryFilePath(home), doc.map(registryEntryToFile))` 写回，保证未触及条目（含 `_raw` 形状）原样、输出合法 JSON。

## Risks / Trade-offs

- **unregister 不可逆（对仅存在于注册表的条目）** → 若被移除条目不在任何客户端全局配置中，`pmcp init` 无法自动恢复。缓解：移除前明确确认、摘要列出被移除 id；文档提示用户可手工补回。这与用户“希望支持移除”的目标一致，属于接受的取舍。
- **总是询问目标格式可能略打扰** → 每次运行都要确认格式。缓解：多选默认预选受管格式，多数情况直接回车即可；这是用户明确要求的“不自动跳过”。
- **取消目标格式后旧文件服务器保留** → 若用户取消勾选某受管文件，该文件不被写入，其已启用服务器仍在。缓解：符合“只写被选中文件”的语义，spec 已明确。
- **rename 只改显示名称，用户可能误以为能改 id** → 缓解：`--help`/文档/错误信息明确说明 `rename` 改的是显示名称 `name`，不改 `id`。
- **非 TTY 下 `unregister`/交互式 `rename` 全部取消** → 与既有 `register` 一致，零写入退出码 0；文档（AGENTS.md）提示 agent 在非交互场景直接编辑 `~/.pmcp/registry.json`。

## Migration Plan

- 无数据迁移：注册表/项目文件格式不变。
- 部署：`npm run setup`（`npm install -g .`）或 `npm link`；改动即时生效。
- 回滚：`npm run teardown`（`npm uninstall -g pmcp`）卸载；`~/.pmcp/registry.json` 可手工恢复（`unregister` 为删除操作，无自动回滚；`rename` 可再次改名恢复）。
- 需同步更新：`AGENTS.md`（第 4 条不变量扩展为 `init`/`register`/`unregister`/`rename` 可改写注册表；非交互操作说明）与 `README.md`/`README_ZH.md`（命令表与目标格式行为说明）。

## Open Questions

无。影响 spec、方案或任务拆分的决策均已在本设计中确定。
