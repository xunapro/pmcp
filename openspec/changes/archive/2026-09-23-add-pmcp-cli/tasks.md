# Tasks

## 1. 包与入口搭建

- [x] 1.1 修改 `package.json`：添加依赖 `commander`、`prompts`，声明 `"bin": { "pmcp": "./src/index.js" }`、`"files"` 与 `"engines"`；运行 `npm install` 验证安装成功
- [x] 1.2 创建 `src/index.js`，首行加 `#!/usr/bin/env node` shebang，用 `commander` 定义程序并挂接 `--version`；`npm link` 后运行 `pmcp --version` 验证打印 `1.0.0`，`pmcp --help` 验证打印用法并退出码 0

## 2. 注册表与读写引擎

- [x] 2.1 在 `src/index.js` 定义 `REGISTRY`（filesystem / git / github / memory，每条含 `claude` 与 `opencode` 两种格式定义），与 design.md D3 结构一致；以 `node -e` 加载并断言条目数与字段完整验证
- [x] 2.2 实现 `readState(projectDir)`：解析 `.mcp.json` 的 `mcpServers` 与 `opencode.json` 的 `mcp`，返回受管文件列表与注册表服务器的启用并集；JSON 解析失败时抛出指明文件名的错误。对含合法/非法 JSON 的临时目录运行验证（成功读取与错误信息各 1 例）
- [x] 2.3 实现 `save(projectDir, selectedIds, targets)`：read-modify-write——只增删注册表键、保留其余键与未知服务器、`JSON.stringify(…, null, 2) + "\n"` 写回；文件不存在则创建，零选中不创建。写后用 `JSON.parse` 读回断言（1）未知键保留（2）段内键与选择一致

## 3. 交互 UI

- [x] 3.1 用 `prompts` 的 `multiselect` 渲染注册表 checkbox 列表（按 `readState` 结果预勾选），确认步骤使用 `confirm`；在已有配置的临时项目里以脚本注入答案验证：预勾选正确、确认调用 save、取消不产生文件
- [x] 3.2 处理 `onCancel`/Ctrl+C：`process.exit(0)` 且无堆栈输出；验证取消后目标目录文件与运行前逐字节一致
- [x] 3.3 两文件均不存在时增加 `multiselect` 询问要创建的客户端格式（Claude Code / OpenCode，可多选），只创建所选文件；空目录验证选择 Claude Code 后仅生成 `.mcp.json`

## 4. 集成验证

- [x] 4.1 端到端手测脚本：（a）空目录 → 选 filesystem+git、勾两种格式 → 两文件生成且格式正确；（b）再次运行 → 状态回显为已勾选；（c）取消 git → `.mcp.json` 移除 git、`opencode.json` 移除 git、其余键与手工添加的 `my-custom-mcp` 原样保留；（d）`opencode.json` 写入非法 JSON → 报错退出码 1 且无任何写入
- [x] 4.2 保存成功后打印按文件分组的启用/禁用摘要，退出码 0；对照 4.1 各场景验证摘要内容

## 5. 用户级注册表与全局初始化导入（修订新增）

- [x] 5.1 实现用户级注册表存储：`loadRegistry()` 读取 `path.join(os.homedir(), '.pmcp', 'registry.json')`；文件不存在 → 创建目录并写入内置 `DEFAULT_REGISTRY`（filesystem/git/github/memory，条目结构同 D3）作为 seed，之后以文件为唯一来源；解析失败 → stderr 指明文件路径、退出码 1、零写入。验证：以临时 HOME 目录运行——首跑生成 seed 文件；向文件添加自定义条目后列表出现该条目、删除后消失；写坏 JSON 后断言退出码 1 且 HOME/项目文件逐字节未变
- [x] 5.2 实现全局初始化只读导入：解析 `~/.claude.json` 的 `mcpServers` 与 `~/.config/opencode/opencode.json` 的 `mcp`，按 D7 规则与注册表文件合并（用户级文件同名优先；claude `{command,args,env}` ↔ opencode `{type:'local',command[],environment}` 互转；仅含 `url` 的条目跳过并在启动信息提示）；来源缺失 → 静默跳过，非法 JSON → stderr 警告且不阻断。验证：构造三组假 HOME（合法全局配置/坏 JSON/无文件），断言合并集合、优先级、警告路径，且全局文件运行前后逐字节一致
- [x] 5.3 UI 与保存接入合并集合并回归：checkbox 列表来自合并集合，导入条目可勾选/取消，确认保存时按目标格式写入（导入条目使用转换后的定义）；以脚本注入答案端到端验证——仅存在于假 `~/.claude.json` 的 `chrome-devtools` 勾选后出现在项目 `.mcp.json` 与 `opencode.json` 中且两文件定义格式各自正确；重跑 3.1/3.2/3.3/4.1 既有场景全部通过（取消零改动、并集回显、未知条目保留不受影响）

## 6. 多语言支持（修订新增）

- [x] 6.1 消息目录与语言解析：在 `src/index.js` 建立 `MESSAGES = { en, zh }` + `t(key, params)`，替换全部内联用户可见文案（服务器选择提示、格式选择、确认、摘要启用/禁用行、错误与警告、未选择/取消提示、commander 的 description/help/version 文案、导入条目来源描述）；`lang()` 启动时读 `~/.pmcp/settings.json` 的 `language`（仅 `zh` 生效为中文，缺失/非法/解析失败 → en，解析失败另打印一条提示且不重写文件）；`DEFAULT_REGISTRY` 的 name/description 改为英文。验证：假 HOME 下断言——默认全英文文案；写入 `{"language":"zh"}` 后同一流程为中文；坏 settings → 提示 + 英文继续 + 文件未被改写
- [x] 6.2 `pmcp lang` 子命令：`pmcp lang zh|en` 校验后 read-modify-write settings.json（目录缺失创建、保留未知其他键）并成功退出 0；`pmcp lang` 无参打印当前激活语言退出 0；`pmcp lang fr` → 错误信息列出支持语言、退出码 1、settings.json 不被修改（若不存在也不得创建）。验证：在假 HOME 断言三种调用的退出码、settings.json 内容与界面语言联动（`pmcp --help` 文案随切换变化）
- [x] 6.3 回归与硬编码检查：将既有验证脚本断言更新为双语参数（默认 en，另跑一轮 zh 抽查关键消息）；重跑 2.2/2.3/3.1/3.2/3.3/4.1/4.2/5.1/5.2/5.3 全部场景通过；检索源码确认除 MESSAGES 目录与英文 seed 外无残留中文 UI 字符串

## 7. 移除内置注册表与 pmcp init 命令（修订新增）

- [x] 7.1 移除 DEFAULT_REGISTRY 与运行时动态合并：从 `src/index.js` 删除内置条目表；`loadRegistry` 不再 seed——文件缺失时交互路径不进入选择、打印"运行 pmcp init 初始化"提示后以退出码 0 结束且零创建（坏 JSON 仍退出码 1 零写入）；删除启动时 `loadGlobalEntries` 动态合并与同名优先代码路径；UI 列表与保存只读注册表文件条目；更新消息目录（移除 seed 相关、新增 init 流程与空注册表提示文案，中英双语）。验证：假 HOME 下文件缺失 → 仅提示、零文件创建、退出码 0；手写注册表后列表与文件一致；坏注册表仍退出码 1
- [x] 7.2 实现 `pmcp init` 子命令：只读来源 `~/.claude.json` 的 `mcpServers` + `~/.config/opencode/opencode.json` 的 `mcp`（保留 claude↔opencode 双向转换与两来源同 id 互补，远程/不可转换条目跳过并提示）；文件不存在 → mkdir 并创建；存在 → 三分支更新：新 id 追加、同名一致不动（幂等）、同名定义有差异逐项 confirm（默认否，确认后用转换定义覆盖该条目）；从不删除任何条目；两来源均不可用 → 提示 + 退出码 1（已有注册表不动）、单来源不可用 → 警告后继续；非 TTY 时「改」一律按否处理并列出跳过项。验证：假 HOME 五场景——首次 init 建文件内容与格式正确、二次 init 幂等无询问、差异条目选否保持/选是覆盖、来源中消失的条目不被删除、全局文件运行前后逐字节一致
- [x] 7.3 回归与断言适配：更新既有验证脚本（原 seed/动态合并相关：文件缺失交互断言改为空列表提示零创建、全局导入单测迁移为 init 三分支单测、e2e 先 init 再交互、语言断言去除 seed 字样）；重跑 2.2/2.3/3.x/4.1/4.2/5.1（适配版）/6.1/6.2 全部通过；硬编码检查（消息目录外无 CJK UI 字符串）通过

## 8. 注册表条目统一格式（修订新增）

- [x] 8.1 统一条目模型：注册表条目改为只存一份 canonical 启动定义（`command`/`args?`/`env?` + id/name/description）；实现 canonical→claude `{command,args,env}` 与 canonical→opencode `{type:'local',command:[command,...args],environment,enabled:true}` 生成函数，`save` 改为保存时即时生成；`loadRegistry` 将旧版 `claude`/`opencode` 双字段条目归一（以 claude 字段为准，文件不重写）；`init` 将来源定义归一为 canonical 后比较/追加/覆盖，两来源同 id 冲突以 Claude Code 来源为准（OpenCode 仅补缺失 id）。验证：旧双格式 fixture 文件加载后列表与落盘输出与第 7 组断言一致且文件未被重写；init 新写文件条目为单份 canonical；同一注册表写出的项目文件结构与 4.1(c) 既有断言逐字段一致
- [x] 8.2 回归与补充场景：验证脚本 fixture 改 canonical 后重跑 2.2/2.3/3.x/4.1/4.2/5.x/6.1/6.2/7.x 全部通过；init 单测补充「两来源同 id 冲突取 claude」与「旧双格式条目兼容归一」两个场景；保存输出中 claude 条目不得泄漏 `enabled` 字段、opencode 条目不得泄漏裸 `command` 字符串（格式纯净断言）

## 9. 文档与跨平台安装（修订后补）

- [x] 9.1 双语 README：`README.md`（英文）与 `README_ZH.md`（中文）互链、内容对齐（安装/快速上手/命令表/注册表格式/限制/卸载）；两文件均含「借助 AI agent 安装与使用」章节，内置三段可复制提示词（安装工具含 Node 前置检查、初始化注册表含 init 退 1 回退、按项目管理服务器）；`package.json` 的 `files` 显式收录 `README_ZH.md`（`README.md` npm 自动收录）
- [x] 9.2 `AGENTS.md`：agent 可读的初始化与操作文档——新机器 bootstrap（每步可验证）、首次 init、非交互操作指引（程序化改写注册表/项目文件、禁在管道中跑裸 pmcp）、数据文件与落盘生成规则、5 条 invariants、代码约定、验证与回滚
- [x] 9.3 跨平台安装保障：`.gitattributes` 固化 `*.js` LF 行尾（shebang 在 Linux/macOS 可执行）；`package.json` 增加 `setup`/`teardown`/`verify` scripts 与 `description`/`keywords`。验证：`npm pack --dry-run` 产物 4 文件（README×2、package.json、src/index.js，不含 AGENTS.md）；假 HOME 实测 `pmcp --version`=1.0.0、init 无来源退 1、registry 缺失提示+退 0+零创建、`lang zh` 后 help 中文

## 10. 模块拆分重构（修订新增）

- [x] 10.1 按 D2 修订拆分：从 `src/index.js`（588 行）抽出 `src/i18n.js`（MESSAGES/t/语言解析与设置）、`src/model.js`（TARGETS/clone/canonical↔claude/opencode 转换/registryEntryToFile，无 I/O）、`src/registry.js`（loadRegistry/normalizeUserEntry/readGlobalFile/collectGlobalEntries/initRegistry）、`src/persistence.js`（readJsonObject/readState/save/writeJsonObject）、`src/ui.js`（promptServers/promptTargets/promptConfirm/cancelExit/printSummary）；`index.js` 保留 shebang、commander 装配、`run()` 编排与全部公共函数的兼容 re-export；依赖方向按 D2 单向。验证：`node --check` 六个文件全过；`pmcp --version` 输出 1.0.0、`pmcp --help` 退出码 0；`src/index.js` 首行 shebang 与 LF 行尾保持
- [x] 10.2 回归：验证脚本不改 require 路径（经 index.js 兼容导出），重跑 2.2/2.3/3.x/4.1/4.2/5.x/6.1/6.2/7.x/8.x 全部 10 个场景脚本通过；确认 5 条 Invariants 不因搬动改变（取消零写入、先读后写、全局只读、init 之外不写注册表、远程跳过）
- [x] 10.3 同步非 openspec 文档中的单文件表述：`AGENTS.md`（"全部实现在单文件 src/index.js"一句与 Code conventions 中"全部用户可见文案在 src/index.js 的 MESSAGES"改为 src/i18n.js 等模块归属）、README 双语中 `src/index.js` 的描述；`package.json` 的 `main`/`bin`/`files` 无需变更（仍指向 src/）
