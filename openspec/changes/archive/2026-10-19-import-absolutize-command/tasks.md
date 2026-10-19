# Tasks

## 1. sources.js：导入时绝对化本地命令

- [x] 1.1 新增 `isBareCommand(cmd)` 判定裸命令名（不含 `/`/`\`、不以 `.`/`~` 开头、非空）。验证：`node --check` + 临时脚本断言 `uvx`/`npx` 为 true，`src\...`/`./x`/`../x`/`~/x` 为 false
- [x] 1.2 新增 `absolutizeCommand(cmd, baseDir)`：绝对路径/裸命令名原样返回，`~` 展开为 `os.homedir()`，其余 `path.resolve(baseDir, cmd)`。验证：临时脚本断言各类输入输出
- [x] 1.3 `collectProjectEntries` 在构建 entries 后对 `entry.command` 应用 `absolutizeCommand(entry.command, projectDir)`。验证：argocd-mcp `opencode.json` 临时副本，stdio 条目命令绝对化、远程条目不变
- [x] 1.4 `collectGlobalEntries` 在构建 entries 后对 `entry.command` 应用 `absolutizeCommand(entry.command, home)`。验证：临时 HOME 全局 v2 `opencode.json`，相对命令按主目录绝对化、裸命令名保留
- [x] 1.5 导出 `absolutizeCommand`。验证：`require('./src/sources').absolutizeCommand` 可用

## 2. registry.js：冲突选边也绝对化

- [x] 2.1 `registerToRegistry` 冲突选边分支，对被选中的 claude/opencode 候选定义应用 `absolutizeCommand(canon.command, projectDir)`。验证：临时项目 `.mcp.json` + `opencode.json` 同 id 不同定义，selectSide 选 claude，注册表 `command` 为绝对路径

## 3. 文档

- [x] 3.1 AGENTS.md：统一条目说明补导入绝对化规则。验证：通读 AGENTS.md 无遗漏
- [x] 3.2 README.md / README_ZH.md：canonical 定义说明补导入绝对化。验证：两文件阅读一致

## 4. 回归验证

- [x] 4.1 全部静态检查：`for f in index i18n model registry persistence ui sources; do node --check "src/$f.js"; done`。验证：全部通过
- [x] 4.2 require 冒烟：`node -e "const m=require('./src/index.js');console.log(Object.keys(m).length)"`。验证：打印 28 无异常
- [x] 4.3 `pmcp --version`。验证：退出码 0，输出 1.0.0
- [x] 4.4 临时 HOME 冒烟：registry missing 提示 + 退出码 0 + 零创建。验证：与 Invariant 1/2/3 一致
- [x] 4.5 端到端：真实 argocd-mcp `opencode.json` 导入，断言 3 个 stdio 条目命令为绝对路径且与注册表一致；全局配置相对命令按主目录绝对化。验证：全部断言通过
