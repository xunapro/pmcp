# Design

## Context

动机见 proposal.md。现状：`src/model.js` 的 canonical 是单一本地形态 `{command, args?, env?}`，`toCanonicalFromClaude` / `toCanonicalFromOpencode` 用硬编码 `type` 白名单（`stdio` / `local`）做归一，其余一律判 null → 远程与未知类型被同一条 `skipUnconvertible` 消息吞掉；`canonicalToClaude/Opencode` 与 `registryEntryToFile` 只面向本地；`src/persistence.js` 的 `readState`/`save` 用 `canonicalToClaude/Opencode` 生成定义并整条目覆盖。跨客户端 type 词汇不对称（opencode 扁平 `local`/`remote` vs claude `stdio`/`http`/`sse`/`ws`）是本次核心约束。相关 spec 要求见 `specs/config-persistence` 与 `specs/interactive-server-selection` 的 delta。

## Goals / Non-Goals

**Goals:**
- canonical 扩展为本地/远程双形态，远程为 `{url, type}`（`type` ∈ `"http"|"sse"|"ws"`，claude 词汇，保真写回）。
- 读入：claude `http`/`streamable-http`/`sse`/`ws` 与 opencode `remote` 均归入远程形态并收录；`sdk`/`plugin`/未知/形状非法才跳过，跳过提示指明真实原因。
- 写回：canonical 远程 → `.mcp.json` `{type,url}`、`opencode.json` `{type:"remote",url}`；本地写回不变。
- 保持 Invariant 1/2/3/4 完好；Invariant 5 语义从"远程跳过"改为"仅无网络对应类型跳过"。
- 零新依赖，CommonJS 增量，`require('src/index.js')` 兼容面不破坏。

**Non-Goals:**
- 不实现远程注册等运行时能力——pmcp 只管配置的归一与写回，连接/鉴权由各客户端自身完成。
- 不做 opencode `remote` → 具体 http/sse 的精确判定（opencode 端按 url scheme 自决）；从 opencode 读入时 type 由 scheme 推断（`wss://`→`ws`，否则 `http`），`sse` 仅能来自 claude 来源或手写注册表。
- 不改变交互/保存流程的既有用户路径（checkbox、确认、摘要、取消语义全部不变）。
- 不支持 claude `sdk`（进程内，非网络）与 opencode `plugin` 类条目归一。

## Decisions

### D1: canonical 双形态以 `url` 字段区分，`type` 用 claude 词汇
注册表条目形态判定：含 `url` → 远程形态 `{url, type}`；不含 `url`（仅 `command`）→ 本地形态。远程 `type` 仅取 `"http"|"sse"|"ws"`，以此保真写回 claude；写回 opencode 时统一映射 `type:"remote"`、url 原样，传输类型由 opencode 端按 scheme 派生。
替代方案（canonical 不存 type，写回 claude 时一律 `http`）被否：会把 `sse`/`ws` 服务器的传输类型静默降级，写回后不可逆。

### D2: 模型层新增统一归一与分类入口，既有 `toCanonicalFrom*` 保留为兼容薄壳
`src/model.js` 新增：
- `classify(def, key)` → `'local' | 'remote' | 'invalid'`：按形态判定归一可行性。local 要求 type ∈ {`stdio`,`local`} 或缺省 + 对应形状（claude`command:string` / opencode`command:array`）；remote 要求 claude type ∈ {`http`,`streamable-http`,`sse`,`ws`} 且含 `url`，或 opencode type ∈ {`remote`} 且含 `url`；其余（`sdk`/`plugin`/未知 type/形状不符/空 command/有 url 无 type 等）→ `invalid`。
- `canonicalOf(def, key)` → canonical 或 null：`classify` 为 local 时复用现有归一逻辑，`remote` 时返回 `{url, type}`（opencode 来源按 D1 的 scheme 推断）。
- 保留 `toCanonicalFromClaude` / `toCanonicalFromOpencode`，内部改调 `canonicalOf`，返回值允许含 `url`（`.mcp.json` 兼容 re-export 契约不变，仅语义扩为双形态）。
- `simpleRemoteType(url)`：`wss://` → `ws`，否则 `http`（`sse` 不作为自动推断结果）。
- `isLocalEntry(entry)` / `isRemoteEntry(entry)`：按 `url` 有无判别，供各调用点走统一分支，避免散落 `'url' in def` 判断。

### D3: sources 收集器用 `classify` 分流跳过原因
`collectGlobalEntries` / `collectProjectEntries` 全程改用 `canonicalOf+classify`：
- 三态分流：local/remote → 候选条目；`invalid` → 跳过并打 `*.skipInvalid`（原 `skipUnconvertible` 文案改为专门描述"无命令亦无网络 URL/形状非法/type 不支持"），计数不变（`skippedUnconvertible`）。
- 删除"远程 url 不支持"的语义与文案——远程不再跳过。
- init 的"两来源冲突以 claude 为准"与 register 的选边逻辑不变，但归一结果可能是远程形态，`sameLaunchDef` 需对双形态都成立。

### D4: `sameLaunchDef` 对齐双形态
现有实现 `JSON.stringify(canonicalToClaude(a)) === JSON.stringify(canonicalToClaude(b))` 在 `canonicalToClaude` 覆盖远程后自然可对比本地/远程：本地 → `{command,args?,env?}` 序列化，远程 → `{type,url}` 序列化；两形态之间永不相同（本地含 command、远程含 url），不会误判为冲突。保持行为，不新增分支。

### D5: `canonicalToClaude` / `canonicalToOpencode` 写回双形态
- `canonicalToClaude(local)`：`{command,args?,env?}`（不变）；`canonicalToClaude(remote)`：`{type, url}`。
- `canonicalToOpencode(local)`：`{type:"local", command:[...], enabled:true}`（不变）；`canonicalToOpencode(remote)`：`{type:"remote", url, enabled:true}`。

### D6: `registryEntryToFile` 保留远程字段
增加：`if (entry.url) { out.url, out.type }`。本地分支不变。输出仍是单一 canonical（一条目一形态），不产生双字段旧格式。

### D7: `readState` 不变，`save` 改为"生成定义与既有条目浅合并"
`readState` 只按 id 存在性判定启用，形态无关，无需改。
`save` 当前用生成定义**整条目覆盖**受管条目，会抹掉用户在同一条目上维护的 `headers`/`timeout` 等附加字段。改为浅合并：`nextSection[id] = { ...existingDef, ...generatedDef }`，generated 键优先。本地/远程、受管与否都覆盖，实现一行改动，行为增益与 spec（config-persistence delta："远程条目的附加字段保留"）对齐。风险见 Risks。

### D8: i18n 文案
en/zh 成对新增/改写：
- 新键 `.skipInvalid`（global/register 两处）：描述真实跳过原因（无命令亦无 URL、或 type 不受支持），不再出现"remote url"字样。
- 既有 `skipUnconvertible` 若被移除，需同时更新所有引用点与 summary 计数注释；或直接复用为 invalid 语义键，删除"远程"措辞。实现取后者：改文案、保键名，引用点不动。
- AGENTS.md/README 的措辞同步（见 tasks）。

## Risks / Trade-offs

- [opencode `remote` 读入时 `sse` 无法精确还原（scheme 推断只得 `http`/`ws`）] → 接受为已知损失：`sse` 仅来自 claude 来源或手写 canonical；写回两侧后 claude 侧若从 opencode 读入过会以 `http` 呈现，功能无损（streamable-http 兼容），文档注明。
- [save 的浅合并会保留用户自定义键，可能让 spec 密钥/旧字段滞留] → 只保留既有条目的键、生成键优先，不会引入比现状更多数据，且与"保留未知内容"既有要求一致；受管条目若故意清字段需手工编辑配置文件。
- [`toCanonicalFromClaude/Opencode` re-export 契约的返回对象新增 `url` 形态] → 外部仅 `require('src/index.js')`，新增可空字段不破坏既有消费路径；提交前跑 AGENTS.md 校验（node --check、require 冒烟、临时 HOME 冒烟）与人工核对 Invariant 1/2/5。
- [本地/远程跨来源冲突判定：同一 id 在 `.mcp.json` 是本地、`opencode.json` 是远程] → `sameLaunchDef` 判不同 → 触发选边（register）或 claude 优先（init），语义自洽，无静默合并。
- [非 TTY 下 register 的远程条目同样受"确认全部取消"约束] → 与本地一致，AGENTS.md 已声明 register 不在非 TTY 安全清单；agent 程序化场景仍直接编辑注册表。

## Migration Plan

- 无数据迁移：远程条目此前无法写入注册表，无存量；本地/旧双格式条目加载路径不变（`normalizeUserEntry` 对 `command` 字符串仍走 claude 归一，`claude`/`opencode` 旧字段仍兼容）。注册表文件 schema 向后兼容。
- 回滚：`npm run teardown` 卸包；项目文件由用户管理；`AGENTS.md` 恢复远程 Non-Goal 措辞即可回到旧语义。
- 文档随本变更落地（AGENTS.md Invariant 5、数据格式、落盘规则、README）。

## Open Questions

无阻塞项。已记录的取舍：opencode 来源的远程 type 由 scheme 推断且不为 `sse`；save 浅合并将"保留未知内容"从仅未受管条目扩展到受管条目。
