'use strict';

const fs = require('fs');
const path = require('path');

const MESSAGES = {
  en: {
    'cli.description': 'Project MCP Manager — dynamically manage project-level MCP server configs (Claude Code / OpenCode)',
    'cli.versionOpt': 'output pmcp version',
    'cli.helpOpt': 'display help for pmcp',
    'cli.langDesc': 'show or set the interface language (en, zh)',
    'cli.langArg': 'language code: en or zh',
    'cli.initDesc': 'initialize or update the registry from client global configs (add only, confirm changes, never delete)',
    'cli.registerDesc': 'register the current project MCP servers into the registry (add only, confirm changes, never delete)',
    'lang.unsupported': 'Unsupported language "{code}". Supported: {supported}',
    'lang.set': 'Interface language set to {code}.',
    'settings.corrupt': '{path} is not valid JSON; falling back to the default language (en)',
    'error.prefix': 'Error: ',
    'note.prefix': 'Note: ',
    'registry.noId': 'Ignoring registry entry without id',
    'registry.unconvertible': 'Ignoring registry entry "{id}": no canonical launch definition (command/args/env) could be derived',
    'registry.readFail': 'Cannot read registry file {path}: {message}',
    'registry.invalidJson': 'Registry file {path} is not valid JSON',
    'registry.notArray': 'Registry file {path} must contain an array of entries',
    'registry.missing': 'No registry found at {path}. Run "pmcp init" to initialize it from client global configs, or create the file manually.',
    'global.readFail': 'Cannot read {path} ({message}), source skipped',
    'global.notObject': '{path} top level is not a JSON object, source skipped',
    'global.invalidJson': '{path} is not valid JSON, source skipped',
    'global.skipUnconvertible': 'Skipped "{id}" that cannot convert to local format (remote url servers are not supported)',
    'global.importedDesc': 'from client global config (imported)',
    'init.noSources': 'No readable client global config found (~/.claude.json or the OpenCode user config). Nothing to import.',
    'init.confirm': 'Server "{id}" differs from the registry entry. Overwrite with the global definition?',
    'init.summary': 'Init done: added {added}, updated {updated}, changes kept {skippedChanges}, unconvertible skipped {skippedUnconvertible}.',
    'register.conflictMessage': 'Server "{id}" is declared differently in .mcp.json and opencode.json. Which definition should be registered?',
    'register.choiceClaude': 'Claude Code (.mcp.json)',
    'register.choiceOpencode': 'OpenCode (opencode.json)',
    'register.choiceSkip': 'Skip this server',
    'register.overrideConfirm': 'Server "{id}" differs from the registry entry. Overwrite with the project definition?',
    'register.summary': 'Register done: added {added}, updated {updated}, changes kept {skippedChanges}, conflicts skipped {conflictsSkipped}, unconvertible skipped {skippedUnconvertible}.',
    'register.nothingToRegister': 'No registerable MCP servers found in this project.',
    'register.skipUnconvertible': 'Skipped "{id}": no canonical launch definition (command/args/env) could be derived (remote url servers are not supported).',
    'register.importedDesc': 'from current project (imported)',
    'project.readFail': 'Cannot read {name}: {message}',
    'project.invalidJson': '{name} is not valid JSON (path: {path})',
    'project.notObject': '{name} top-level content must be a JSON object (path: {path})',
    'ui.serversMessage': 'Select MCP servers to enable (space to toggle, enter to confirm)',
    'ui.targetsMessage': 'No MCP config file in this project. Which client format(s) to create?',
    'ui.confirmMessage': 'Confirm writing {files}?',
    'ui.cancelled': 'Cancelled: no config files were modified.',
    'summary.noneSelected': 'No servers selected: no config files were created or modified.',
    'summary.noTargets': 'No target format selected: nothing was created.',
    'summary.created': 'Created {file}:',
    'summary.updated': 'Updated {file}:',
    'summary.enabled': '  Enabled: {list}',
    'summary.none': '  Enabled: (none)',
    'summary.disabled': '  Disabled: {list}',
  },
  zh: {
    'cli.description': 'Project MCP Manager — 动态管理项目级 MCP 服务器配置（Claude Code / OpenCode）',
    'cli.versionOpt': '输出 pmcp 版本号',
    'cli.helpOpt': '显示帮助信息',
    'cli.langDesc': '查看或设置界面语言（en、zh）',
    'cli.langArg': '语言代码：en 或 zh',
    'cli.initDesc': '从客户端全局配置初始化或更新注册表（只新增、改动需确认、不删除）',
    'cli.registerDesc': '把当前项目的 MCP 服务器注册进注册表（只新增、改动需确认、不删除）',
    'lang.unsupported': '不支持的语言 "{code}"。支持：{supported}',
    'lang.set': '界面语言已设置为 {code}。',
    'settings.corrupt': '{path} 不是合法 JSON，已回退到默认语言（英文）',
    'error.prefix': '错误: ',
    'note.prefix': '提示: ',
    'registry.noId': '忽略注册表中缺少 id 的条目',
    'registry.unconvertible': '忽略注册表条目 "{id}"：无法得到统一（canonical）启动定义（command/args/env）',
    'registry.readFail': '无法读取注册表文件 {path}: {message}',
    'registry.invalidJson': '注册表文件 {path} 不是合法 JSON',
    'registry.notArray': '注册表文件 {path} 的内容必须是条目数组',
    'registry.missing': '未找到注册表文件 {path}。运行 "pmcp init" 从客户端全局配置初始化，或手工创建该文件。',
    'global.readFail': '无法读取 {path}（{message}），已跳过该来源',
    'global.notObject': '{path} 顶层不是 JSON 对象，已跳过该来源',
    'global.invalidJson': '{path} 不是合法 JSON，已跳过该来源',
    'global.skipUnconvertible': '跳过无法转换为本地格式的 "{id}"（远程 url 型暂不支持）',
    'global.importedDesc': '来自客户端全局配置（导入）',
    'init.noSources': '未找到可读的客户端全局配置（~/.claude.json 或 OpenCode 用户级配置），没有可导入的条目。',
    'init.confirm': '服务器 "{id}" 与注册表条目定义不同。是否用全局配置的定义覆盖？',
    'init.summary': 'init 完成：新增 {added}，覆盖更新 {updated}，差异保持 {skippedChanges}，跳过不可转换 {skippedUnconvertible}。',
    'register.conflictMessage': '服务器 "{id}" 在 .mcp.json 与 opencode.json 中声明不一致。注册哪一份定义？',
    'register.choiceClaude': 'Claude Code（.mcp.json）',
    'register.choiceOpencode': 'OpenCode（opencode.json）',
    'register.choiceSkip': '跳过该服务器',
    'register.overrideConfirm': '服务器 "{id}" 与注册表条目定义不同。是否用当前项目中的定义覆盖？',
    'register.summary': 'register 完成：新增 {added}，覆盖更新 {updated}，差异保持 {skippedChanges}，选边跳过 {conflictsSkipped}，跳过不可转换 {skippedUnconvertible}。',
    'register.nothingToRegister': '当前项目中未找到可注册的 MCP 服务器。',
    'register.skipUnconvertible': '跳过 "{id}"：无法得到统一（canonical）启动定义（远程 url 型服务器不支持）。',
    'register.importedDesc': '来自当前项目（导入）',
    'project.readFail': '无法读取 {name}: {message}',
    'project.invalidJson': '{name} 不是合法 JSON（路径: {path}）',
    'project.notObject': '{name} 的顶层内容必须是 JSON 对象（路径: {path}）',
    'ui.serversMessage': '选择要启用的 MCP 服务器（空格切换，回车确认）',
    'ui.targetsMessage': '项目中没有 MCP 配置文件，要创建哪种（些）客户端格式？',
    'ui.confirmMessage': '确认写入 {files}？',
    'ui.cancelled': '已取消：未对任何配置文件做修改。',
    'summary.noneSelected': '未选择任何服务器：没有创建或修改配置文件。',
    'summary.noTargets': '未选择任何目标格式：没有创建配置文件。',
    'summary.created': '已创建 {file}:',
    'summary.updated': '已更新 {file}:',
    'summary.enabled': '  启用: {list}',
    'summary.none': '  启用: （无）',
    'summary.disabled': '  禁用: {list}',
  },
};

const SUPPORTED_LANGS = ['en', 'zh'];
let currentLang = 'en';

function t(key, params) {
  const table = MESSAGES[currentLang] || MESSAGES.en;
  let text = table[key] !== undefined ? table[key] : MESSAGES.en[key];
  if (text === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.split('{' + k + '}').join(String(v));
  }
  return text;
}

function getLanguage() {
  return currentLang;
}

function settingsFilePath(home) {
  return path.join(home, '.pmcp', 'settings.json');
}

function resolveLanguage(home, notices) {
  const file = settingsFilePath(home);
  currentLang = 'en';
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return 'en';
  }
  try {
    const parsed = JSON.parse(raw);
    const lang = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.language : undefined;
    currentLang = lang === 'zh' ? 'zh' : 'en';
    return currentLang;
  } catch {
    if (notices) notices.push(t('settings.corrupt', { path: file }));
    return 'en';
  }
}

function setLanguage(home, code) {
  const file = settingsFilePath(home);
  let doc = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) doc = parsed;
  } catch {
    doc = {};
  }
  doc.language = code;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = JSON.stringify(doc, null, 2) + '\n';
  JSON.parse(content);
  fs.writeFileSync(file, content, 'utf8');
  currentLang = code;
}

module.exports = {
  MESSAGES,
  SUPPORTED_LANGS,
  t,
  getLanguage,
  resolveLanguage,
  setLanguage,
};
