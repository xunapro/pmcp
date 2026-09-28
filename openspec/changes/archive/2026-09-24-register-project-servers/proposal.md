# Proposal

## Why

当前 `pmcp` 只有一条方向：注册表 → 项目（交互式 checkbox 选取）。若某个已在一项目中验证可用的服务器想在其它项目复用，用户只能手写 `~/.pmcp/registry.json`，或依赖 `pmcp init`——而 init 只从客户端全局配置（`~/.claude.json` 等）拉取，项目里手工维护的优质定义无法回流到用户级注册表。新增反向通道，让"当前项目里正在用的 MCP"一键沉淀为全局可用，是 v1.0 方向能力的自然补全。

## What Changes

- 新增子命令 `pmcp register`：读取当前工作目录的 `.mcp.json` 与 `opencode.json`，将其中声明（且可归一化）的服务器合并进 `~/.pmcp/registry.json`。
- 合并语义与 `pmcp init` 严格对齐：**只新增**、**同名定义不同则逐项确认覆盖（默认否）**、**永不删除**、**幂等**（重复执行零重复零询问）、仅含 `url` 的远程条目**跳过并提示**。
- 新增项目内跨文件冲突处理：同一 id 在两个项目文件中的定义不一致时，**提示用户选边** `[Claude(.mcp.json) | OpenCode | 跳过]` —— 与 init 的"Claude 优先"自动裁决刻意不对称，因为项目文件可能真实分叉。
- 注册表文件缺失时 `register` **不创建**，打印引导提示先跑 `pmcp init`，退出码 0，零文件创建（复用主命令同款行为）。
- 客户端全局文件（`~/.claude.json`、OpenCode 用户配置）保持只读，`register` 永不触碰（不破坏 Invariant 1）。
- 命令语义：`register` 只把定义加入可用列表，**不**顺带在其它项目启用任何服务器（启用仍是各项目交互 checkbox 的职责）。

## Capabilities

### New Capabilities

无新增能力。此变更在两个既有能力内新增 requirement，不引入新能力目录。

### Modified Capabilities
- `cli-invocation`: 新增 `pmcp register` 子命令的调用面 requirement（以当前工作目录为项目、可读项目的两种配置文件、退出行为与语言文案一致）。
- `interactive-server-selection`: 新增 `pmcp register` 合并规则的 requirement（双项目文件来源收集、跨文件冲突选边提示、与 init 对齐的只新增/确认覆盖/永不删除/幂等、注册表缺失提示、处于已有"用户级注册表文件"所定义的注册表唯一事实源与维护规则框架下）。

## Impact

- **代码**：`src/registry.js` —— 抽取可复用的"从来源合并进注册表"核心（现 `collectGlobalEntries` + `initRegistry` 的合并循环），新增 `collectProjectEntries` 与 `registerToRegistry`；`src/index.js` —— 装配 `register` 子命令并补 `module.exports` re-export；`src/ui.js` —— 新增选边提示，复用覆盖确认；`src/i18n.js` —— 新增 en/zh 文案（命令描述、选边提示、跳过提示、summary 计数）；`src/model.js` —— 预计无改动（归一化/生成函数已就绪）。
- **文档**：`AGENTS.md` Invariant 4 措辞从"只有 `pmcp init` 写注册表"扩展为"`init` 与 `register` 共同维护、仅 `init` 可创建"；非 TTY 安全子命令清单需说明 `register` 交互依赖；`README.md` / `README_ZH.md` 补偿目录更新。
- **依赖**：零新依赖（仍仅 commander、prompts）。
- **兼容性**：`register` 为纯新增子命令，不改变主命令与 `init`/`lang` 既有行为，无 **BREAKING**。
