# Tasks

## 1. model.js：canonical 双形态与转换

- [x] 1.1 新增 `classify(def, key)` 返回 `'local'|'remote'|'invalid'`：按 D2 规则判定（local 需 type∈{stdio,local}或缺省+对应命令形状；remote 需 claude type∈{http,streamable-http,sse,ws}+url 或 opencode type∈{remote}+url；其余 invalid）。验证：`node --check src/model.js`，并用临时脚本对上述各 case 断言 classify 返回值
- [x] 1.2 新增 `simpleRemoteType(url)`：`wss://` 前缀→`'ws'`，其余→`'http'`。验证：临时脚本断言 `simpleRemoteType('wss://x')==='ws'`、`simpleRemoteType('https://x')==='http'`
- [x] 1.3 新增 `canonicalOf(def, key)`：local 走现有归一逻辑，remote 返回 `{url, type}`（opencode 来源 type 用 `simpleRemoteType`），invalid 返回 null。验证：临时脚本断言本地/远程/invalid 三态的输出对象
- [x] 1.4 改造 `toCanonicalFromClaude` / `toCanonicalFromOpencode` 内部改调 `canonicalOf`，返回值允许含 `url`。验证：`node --check` + 临时脚本断言 claude `{type:"ws",url}` 现返回 `{url,type:"ws"}`
- [x] 1.5 新增 `isLocalEntry(entry)` / `isRemoteEntry(entry)`（按 `url` 有无判别）。验证：临时脚本断言含/不含 url 条目的判别结果
- [x] 1.6 改造 `canonicalToClaude` / `canonicalToOpencode` 支持远程形态（D5）。验证：临时脚本断言 `canonicalToClaude({url,type:"sse"})` 输出 `{type:"sse",url}`、`canonicalToOpencode({url,type:"ws"})` 输出 `{type:"remote",url}`
- [x] 1.7 改造 `registryEntryToFile` 保留远程字段 `url`/`type`（D6）。验证：临时脚本断言含 url 条目落盘含 url+type、本地条目不变
- [x] 1.8 经 `sameLaunchDef`（D4）确认本地/远程双形态可正确比较且互不相同。验证：临时脚本断言本地与远程定义不误判为相同、同形态相同定义判同

## 2. sources.js：收集器分流与跳过提示

- [x] 2.1 `collectGlobalEntries` 改用 `canonicalOf + classify`：local/remote 进候选，invalid 打提示跳过。验证：临时 HOME + 构造 `~/.claude.json`（含 http/stdio/sdk 条目）跑 init 冒烟，断言远程收录、sdk 跳过
- [x] 2.2 `collectProjectEntries` 同上改造，跨文件冲突与选边逻辑支持远程形态。验证：临时项目含 `.mcp.json`(http) + `opencode.json`(remote) 同 id 跑 register 选边冒烟，断言收录正确
- [x] 2.3 移除"远程 url 不支持"文案语义，invalid 提示改为描述真实原因（无命令亦无 URL/type 不受支持）。验证：跑跳过场景冒烟，断言提示不再含远程字样

## 3. registry.js / persistence.js：条目加载与保存

- [x] 3.1 `normalizeUserEntry` 支持远程 `{url,type}` 条目加载（command 字符串仍走 claude 归一），旧双字段 `claude`/`opencode` 兼容路径不变。验证：临时注册表含远程条目跑 `pmcp --help` + 临时 HOME 冒烟加载成功
- [x] 3.2 `save` 改为浅合并：`nextSection[id] = {...existingDef, ...generatedDef}`（generated 优先）。验证：临时项目远程条目带 `headers`/`timeout`，保存后断言附加字段保留
- [x] 3.3 `readState` 确认无需改动（按 id 存在性启用，形态无关），并跑一次含远程条目项目的启用回显冒烟。验证：临时项目 `.mcp.json` 含远程条目，`pmcp` 冒烟断言回显勾选
- [x] 3.4 `mergeIntoRegistry` 的 `sameLaunchDef` 比较路径确认对远程形态幂等。验证：重复 register 冒烟断言零重复零询问

## 4. i18n.js：文案

- [x] 4.1 en/zh 成对改写跳过提示（保留键名、删"远程 url"措辞，或新增 `*.skipInvalid` 键并更新引用）。验证：grep 无残留"remote url"字样文案，两条语言均存在
- [x] 4.2 检查 `global.skipUnconvertible` / `register.skipUnconvertible` 引用点（sources.js）与文案一致。验证：`pmcp init`/`pmcp register` 中英文冒烟各跑一遍
- [x] 4.3 源码除 MESSAGES 的 zh 表外无 CJK 字符串。验证：grep 非 i18n.js 文件无中文字符

## 5. 文档与对外契约

- [x] 5.1 AGENTS.md：删除"远程服务器类型是 v1 的 Non-Goal"，Invariant 5 改为"仅无网络对应类型（sdk/plugin）跳过并提示"；注册表数据格式示例补远程形态；落盘生成规则补远程。验证：通读 AGENTS.md 无远程 Non-Goal 残留，五条 Invariant 与新语义一致
- [x] 5.2 `src/index.js` re-export 兼容面：若新增函数（如 `canonicalOf`/`classify`/`simpleRemoteType`）需补 re-export。验证：`node -e "require('./src/index.js')"` 冒烟 + `pmcp --version` 输出正确
- [x] 5.3 README.md / README_ZH.md 补远程支持说明。验证：两文件阅读一致且无"远程不支持"残留

## 6. 回归验证

- [x] 6.1 跑全部静态检查：`for f in index i18n model registry persistence ui; do node --check "src/$f.js"; done`。验证：全部通过
- [x] 6.2 require 冒烟：`node -e "const m=require('./src/index.js');console.log(Object.keys(m).length)"`。验证：打印正常无异常
- [x] 6.3 `pmcp --version && pmcp --help`。验证：退出码 0，输出正确
- [x] 6.4 临时 HOME 冒烟："registry missing 提示 + 退出码 0 + 零创建"仍成立。验证：断言三次行为与 Invariant 1/2/3 一致
- [x] 6.5 远程端到端冒烟：临时项目 register（一条远程 http 条目）→ 临时 HOME 注册表含该条目 → `pmcp` 勾选写回两种格式。验证：`.mcp.json` 含 `{type,url}`、`opencode.json` 含 `{type:"remote",url}`，退出码 0
- [x] 6.6 人工核对 Invariant 1/2/3/4/5（新语义）：取消零写入、损坏 JSON 报错且不写、全局文件只读、注册表仅 init/register 维护。验证：各场景逐个手跑
