# Tasks

## 1. model.js：OpenCode 布局识别与容器读写助手

- [x] 1.1 新增 `opencodeLayout(doc)` 识别 v1/v2（`mcp.servers` 为对象即 v2，否则 `mcp` 存在为 v1，缺失为 v2）。验证：`node --check src/model.js` + 临时脚本断言 `{}`→v2、`{mcp:{s1:{}}}`→v1、`{mcp:{servers:{}}}`→v2
- [x] 1.2 新增 `opencodeServers(doc)` 提取服务器容器，v1 剔除保留键（`timeout`/`servers`），无容器返回 null。验证：临时脚本断言 v1/v2 提取结果一致且 `mcp.timeout` 不被当服务器
- [x] 1.3 新增 `setOpencodeServers(doc, servers)` 按布局写回，保留 `mcp` 保留键。验证：临时脚本断言 v1/v2 写回后 `mcp.timeout` 保留、服务器容器位置正确
- [x] 1.4 改造 `canonicalToOpencode(entry, layout)`：v1 用 `enabled: true`，v2 用 `disabled: false`，省略 layout 默认 v1。验证：临时脚本断言两种 layout 的输出对象

## 2. sources.js：导入兼容两种布局

- [x] 2.1 `collectGlobalEntries` 的 OpenCode 来源改用 `opencodeServers(ocCfg)` 提取容器。验证：临时 HOME 构造 v2 全局 `opencode.json` 跑 init 冒烟，断言 `git` 被收录
- [x] 2.2 `collectProjectEntries` 对 `opencode` 键改用 `opencodeServers(parsed)` 提取容器。验证：临时项目 v1/v2 `opencode.json` 各跑一次，断言服务器均被收录且 `mcp.timeout` 不误收录

## 3. persistence.js：导出兼容两种布局

- [x] 3.1 `readState` 对 `opencode` 键改用 `opencodeServers(parsed)` 识别启用。验证：临时项目 v2 `opencode.json` 断言 `enabled` 回显正确
- [x] 3.2 `removeFromProject` 对 `opencode` 键改用 `opencodeServers` 取容器 + `setOpencodeServers` 写回。验证：临时项目 v2 文件删除某服务器后断言 `mcp.servers` 不含它且 `$schema`/保留键不变
- [x] 3.3 `save` 对 `opencode` 键改为"提取容器 → 浅合并 → `setOpencodeServers` 写回"，新建文件写 `$schema` 且默认 v2。验证：临时项目分别跑 v1/v2/新建三种，断言 `enabled`/`disabled` 字段正确、`$schema`/`timeout`/`environment`/`oauth`/`headers` 保留

## 4. 文档与对外契约

- [x] 4.1 AGENTS.md：落盘生成规则补新旧布局（旧版 `enabled: true` / 新版 `disabled: false`、新文件默认 `mcp.servers` + `$schema`）；非 TTY 说明补 `mcp.servers`。验证：通读 AGENTS.md 无单布局残留
- [x] 4.2 README.md / README_ZH.md：OpenCode 段说明与生成规则补两种布局。验证：两文件阅读一致
- [x] 4.3 `src/index.js` re-export 兼容面新增 `opencodeLayout`/`opencodeServers`/`setOpencodeServers`。验证：`node -e "require('./src/index.js')"` 冒烟 + `pmcp --version` 正常

## 5. 回归验证

- [x] 5.1 全部静态检查：`for f in index i18n model registry persistence ui sources; do node --check "src/$f.js"; done`。验证：全部通过
- [x] 5.2 require 冒烟：`node -e "const m=require('./src/index.js');console.log(Object.keys(m).length)"`。验证：打印正常无异常
- [x] 5.3 `pmcp --version && pmcp --help`。验证：退出码 0，输出正确
- [x] 5.4 临时 HOME 冒烟：registry missing 提示 + 退出码 0 + 零创建。验证：断言行为与 Invariant 1/2/3 一致
- [x] 5.5 端到端冒烟：临时项目 v2 `opencode.json`（含 `timeout`/`servers`）跑 register + init，断言服务器收录、`mcp.timeout` 保留；临时 HOME 跑 init 读 v2 全局配置。验证：全部断言通过
