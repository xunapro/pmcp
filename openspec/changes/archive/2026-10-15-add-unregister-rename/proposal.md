# Proposal

## Why

`~/.pmcp/registry.json` 目前只能通过 `pmcp init` / `pmcp register` 单向增长（只新增、不删除、不改名），用户想移除不再需要的服务器、或希望给服务器一个更友好的显示名称时，只能手工编辑注册表文件。此外，主流程 `pmcp` 在项目已存在受管配置文件时会自动跳过“写哪种客户端格式”的询问，用户每次运行都无法调整要写入的目标格式。

## What Changes

- **新增 `pmcp unregister`**：交互式列出注册表条目，让用户多选要移除的条目，并从 `~/.pmcp/registry.json` 移除。若某个被移除的服务器当前已在**本项目**的配置文件中启用，则额外询问是否同时将其从项目配置文件中移除。
- **新增 `pmcp rename`**：修改注册表条目的显示名称 `name`（不改动 `id`，`id` 是项目文件中使用的键）。同时支持参数形式 `pmcp rename <id> <new-name>` 与交互式 `pmcp rename`（列出条目选择后再输入新名称）。
- **主流程目标格式选择不再自动跳过**：`pmcp` 在保存前总是弹出“要写入哪种客户端格式”的多选列表，并**预选当前已在项目中受管的格式**（若项目没有任何受管文件则默认全选），允许用户每次运行调整。此前当项目已有受管文件时会直接沿用这些文件、跳过询问。

以上 `unregister` / `rename` 使 `~/.pmcp/registry.json` 可由这两条命令改写（此前仅 `init` / `register` 可改写），属于对“注册表只增不改”不变量的扩展；`unregister` / `rename` 的取消与 Ctrl+C 仍遵循零写入、退出码 0、无堆栈的既有约定。

## Capabilities

### New Capabilities
- `registry-management`: 覆盖 `pmcp unregister` 与 `pmcp rename` 两条子命令——从用户级注册表移除条目、修改条目显示名称，以及它们在交互列表、确认/取消、语言与退出码上的行为；并明确这两条命令成为可改写 `~/.pmcp/registry.json` 的新成员。

### Modified Capabilities
- `interactive-server-selection`: 修改“目标格式选择”行为——不再因项目存在受管文件而自动跳过客户端格式询问，而是总是展示多选列表并预选当前受管格式；同时补充 `pmcp unregister` 在“从项目文件移除服务器”时与既有保存/移除语义的衔接。

## Impact

- **代码**：`src/index.js`（新增 commander 子命令与主流程改动）、`src/registry.js`（`unregister` / `rename` 逻辑与注册表改写）、`src/ui.js`（unregister 多选、rename 选择/文本输入、目标格式预选）、`src/persistence.js`（从项目配置文件移除指定服务器的辅助逻辑）、`src/i18n.js`（新增 en/zh 消息）。
- **不变量**：`~/.pmcp/registry.json` 的可改写命令由 `init`/`register` 扩展为 `init`/`register`/`unregister`/`rename`；`AGENTS.md` 第 4 条不变量与“非交互操作”说明需同步更新。
- **文档**：`README.md` / `README_ZH.md` 的命令表与说明需补充 `unregister` / `rename` 及目标格式选择行为变化。
- **兼容性**：注册表条目格式、项目配置文件格式均不变；`rename` 不改 `id`，不影响项目文件键；`unregister` 对不在当前项目启用的服务器只改注册表。
