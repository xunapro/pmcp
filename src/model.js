'use strict';

const TARGETS = {
  claude: { fileName: '.mcp.json', section: 'mcpServers', label: 'Claude Code (.mcp.json)' },
  opencode: { fileName: 'opencode.json', section: 'mcp', label: 'OpenCode (opencode.json)' },
};

const CLAUDE_LOCAL_TYPES = ['stdio', 'local'];
const CLAUDE_REMOTE_TYPES = ['http', 'streamable-http', 'sse', 'ws'];
const OPENCODE_LOCAL_TYPES = ['local', 'stdio'];
const OPENCODE_REMOTE_TYPES = ['remote'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Canonical definitions (registry single source of truth) come in two shapes:
//   local   { command, args?, env? }
//   remote  { url, type, headers? }  (type is the Claude Code vocabulary: http | sse | ws; headers preserved for auth)
function classify(def, key) {
  if (!def || typeof def !== 'object') return 'invalid';
  const type = typeof def.type === 'string' ? def.type : null;
  const hasUrl = typeof def.url === 'string' && def.url.length > 0;
  if (key === 'claude') {
    if (hasUrl) {
      return type && CLAUDE_REMOTE_TYPES.includes(type) ? 'remote' : 'invalid';
    }
    if (type && !CLAUDE_LOCAL_TYPES.includes(type)) return 'invalid';
    return typeof def.command === 'string' ? 'local' : 'invalid';
  }
  if (hasUrl) {
    return type && OPENCODE_REMOTE_TYPES.includes(type) ? 'remote' : 'invalid';
  }
  if (type && !OPENCODE_LOCAL_TYPES.includes(type)) return 'invalid';
  return Array.isArray(def.command) && def.command.length > 0 ? 'local' : 'invalid';
}

function simpleRemoteType(url) {
  return String(url).toLowerCase().startsWith('wss://') ? 'ws' : 'http';
}

function canonicalOf(def, key) {
  const kind = classify(def, key);
  if (kind === 'invalid') return null;
  if (kind === 'local') {
    if (key === 'claude') {
      const canonical = { command: def.command };
      if (Array.isArray(def.args) && def.args.length > 0) canonical.args = clone(def.args);
      if (def.env && typeof def.env === 'object') canonical.env = clone(def.env);
      return canonical;
    }
    const canonical = { command: def.command[0] };
    const rest = def.command.slice(1);
    if (rest.length > 0) canonical.args = clone(rest);
    if (def.environment && typeof def.environment === 'object') canonical.env = clone(def.environment);
    return canonical;
  }
  const type = key === 'opencode' ? simpleRemoteType(def.url) : def.type === 'streamable-http' ? 'http' : def.type;
  const canonical = { url: def.url, type };
  if (def.headers && typeof def.headers === 'object') canonical.headers = clone(def.headers);
  return canonical;
}

function toCanonicalFromClaude(def) {
  return canonicalOf(def, 'claude');
}

function toCanonicalFromOpencode(def) {
  return canonicalOf(def, 'opencode');
}

// Client-specific definitions are generated on the fly from the canonical entry at save time.
function canonicalToClaude(entry) {
  if (isRemoteEntry(entry)) {
    const def = { type: entry.type, url: entry.url };
    if (entry.headers && typeof entry.headers === 'object') def.headers = clone(entry.headers);
    return def;
  }
  const def = { command: entry.command };
  if (Array.isArray(entry.args) && entry.args.length > 0) def.args = clone(entry.args);
  if (entry.env && typeof entry.env === 'object') def.env = clone(entry.env);
  return def;
}

function canonicalToOpencode(entry) {
  if (isRemoteEntry(entry)) {
    const def = { type: 'remote', url: entry.url, enabled: true };
    if (entry.headers && typeof entry.headers === 'object') def.headers = clone(entry.headers);
    return def;
  }
  const def = { type: 'local', command: [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])], enabled: true };
  if (entry.env && typeof entry.env === 'object') def.environment = clone(entry.env);
  return def;
}

function isLocalEntry(entry) {
  return !(entry && typeof entry.url === 'string' && entry.url.length > 0);
}

function isRemoteEntry(entry) {
  return !isLocalEntry(entry);
}

function sameLaunchDef(a, b) {
  return JSON.stringify(canonicalToClaude(a)) === JSON.stringify(canonicalToClaude(b));
}

function registryEntryToFile(entry) {
  if (entry && entry._raw && typeof entry._raw === 'object') return entry._raw;
  const out = { id: entry.id, name: entry.name, description: entry.description };
  if (isRemoteEntry(entry)) {
    out.url = entry.url;
    out.type = entry.type;
    if (entry.headers && typeof entry.headers === 'object') out.headers = entry.headers;
    return out;
  }
  if (entry.command !== undefined) out.command = entry.command;
  if (Array.isArray(entry.args) && entry.args.length > 0) out.args = entry.args;
  if (entry.env && typeof entry.env === 'object') out.env = entry.env;
  return out;
}

module.exports = {
  TARGETS,
  classify,
  simpleRemoteType,
  canonicalOf,
  toCanonicalFromClaude,
  toCanonicalFromOpencode,
  canonicalToClaude,
  canonicalToOpencode,
  isLocalEntry,
  isRemoteEntry,
  registryEntryToFile,
  sameLaunchDef,
};
