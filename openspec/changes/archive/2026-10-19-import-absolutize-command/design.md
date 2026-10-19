# Design

## Context

现状见 proposal.md。`sources.js` 的 `collectProjectEntries(projectDir)` 与 `collectGlobalEntries(home)` 通过 `toCanonicalFromClaude` / `toCanonicalFromOpencode`（model.js）构建统一（canonical）条目，本地条目带 `command` 字符串。配置里的相对文件路径（如 `src\ArgocdMcp\...\exe`、`./bin/mytool`）被原样存入全局注册表，跨项目使用时因缺少项目上下文而失效。`registerToRegistry` 的冲突选边分支用 `toCanonicalFromClaude` / `toCanonicalFromOpencode` 直接构建候选条目，同样未做绝对化。

## Goals / Non-Goals

**Goals:**
- 导入（`init` / `register`）时，将本地条目的相对文件路径 `command` 解析为绝对路径。
- 裸命令名（`uvx`、`npx`）保持不变，靠 PATH 解析。
- `~` 前缀路径展开为用户主目录。
- 远程条目（含 `url`）不受影响。
- 冲突选边得到的定义同样绝对化。
- 保持 Invariant 1/2/3/4/5 完好、零新依赖、`require('src/index.js')` 兼容面不破坏。

**Non-Goals:**
- 不改写已存在的注册表条目（不在加载时绝对化）。
- 不绝对化 `args`（args 可能是标志、值、主机端口等，非路径，存在误判风险）。
- 不做 PATH 解析或命令存在性校验。
- 不改变导出/保存路径的行为。

## Decisions

### D1: 在 sources 层导入后处理，而非改 model 转换函数
在 `collectProjectEntries` / `collectGlobalEntries` 构建 `entries` 后统一应用 `absolutizeCommand`，保持 `model.js` 的纯转换函数（`toCanonicalFrom*`）签名不变。项目条目按 `projectDir` 解析，全局条目按 `home` 解析。

### D2: 判定"裸命令名"以路径分隔符与 `.`/`~` 前缀为准
`isBareCommand(cmd)`：`cmd` 为字符串、非空、不以 `.` 或 `~` 开头、不含 `/` 或 `\` → 视为裸命令名，原样保留。这样 `uvx`、`npx`、`node` 保留，`src\...`、`./x`、`../x`、`~/x` 走绝对化。

### D3: `absolutizeCommand(cmd, baseDir)` 的优先级
1. 非字符串/空 → 原样返回。
2. `path.isAbsolute` → 原样返回（已是绝对路径）。
3. `isBareCommand` → 原样返回。
4. `~` 前缀 → 展开为 `os.homedir()`（`~/x` → `<home>/x`）。
5. 其余 → `path.resolve(baseDir, cmd)`。

### D4: 冲突选边候选同样绝对化
`registerToRegistry` 冲突选边分支用 `absolutizeCommand(canon.command, projectDir)` 处理被选中的 claude/opencode 定义，保证与 `collectProjectEntries` 直接收录的条目一致。

## Risks / Trade-offs

- [全局配置里相对路径的基准目录选择] → 全局来源（`~/.claude.json`、`~/.config/opencode/opencode.json`）都在主目录下，按 `home` 解析是合理默认；极少出现、且远好于保留相对路径导致跨项目失效。
- [Windows 上 POSIX 风格 `/usr/bin/foo`] → 在 Windows 平台 `path.isAbsolute` 将其视为根相对路径，保留原样；该场景在 Windows 项目配置中极罕见。
- [`args` 中的相对路径不绝对化] → 接受。`args` 语义复杂（标志/值/端口），误绝对化风险高于收益；本次只处理 `command` 本体。

## Migration Plan

- 无数据迁移：仅影响未来导入到注册表的 `command` 形态；已存在条目不被改写。
- 回滚：恢复 `sources.js` / `registry.js` 相关改动并删除导入绝对化逻辑；已绝对化的条目由用户自行处理。
- 文档随本变更落地（AGENTS.md、README.md / README_ZH.md）。

## Open Questions

无阻塞项。
