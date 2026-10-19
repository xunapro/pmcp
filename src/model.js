'use strict';

const TARGETS = {
  claude: { fileName: '.mcp.json', section: 'mcpServers', label: 'Claude Code (.mcp.json)' },
  opencode: { fileName: 'opencode.json', section: 'mcp', label: 'OpenCode (opencode.json)' },
};

const CLAUDE_LOCAL_TYPES = ['stdio', 'local'];
const CLAUDE_REMOTE_TYPES = ['http', 'streamable-http', 'sse', 'ws'];
const OPENCODE_LOCAL_TYPES = ['local', 'stdio'];
const OPENCODE_REMOTE_TYPES = ['remote'];

// OpenCode config layouts.
//   v1 (legacy): servers are keyed directly under `mcp`, each entry uses `enabled`.
//   v2 (latest): servers are keyed under `mcp.servers`, each entry uses `disabled`.
// pmcp reads both and preserves the layout it found when writing a file back.
const OPENCODE_V2_SECTION = 'servers';
// Reserved keys at the `mcp` level that are never server definitions.
const OPENCODE_RESERVED_MCP_KEYS = ['timeout', OPENCODE_V2_SECTION];

// Detect which OpenCode mcp layout a parsed config document uses. A document with no
// `mcp` section (or a fresh document) is treated as the latest v2 layout.
function opencodeLayout(doc) {
  const mcp = doc && doc.mcp;
  if (mcp && typeof mcp === 'object' && !Array.isArray(mcp)) {
    if (mcp[OPENCODE_V2_SECTION] && typeof mcp[OPENCODE_V2_SECTION] === 'object' && !Array.isArray(mcp[OPENCODE_V2_SECTION])) return 'v2';
    return 'v1';
  }
  return 'v2';
}

// Extract the object holding OpenCode server definitions from a parsed doc, or null.
// For the legacy v1 layout the reserved `mcp` keys (timeout, servers) are excluded.
function opencodeServers(doc) {
  const mcp = doc && doc.mcp;
  if (!mcp || typeof mcp !== 'object' || Array.isArray(mcp)) return null;
  if (mcp[OPENCODE_V2_SECTION] && typeof mcp[OPENCODE_V2_SECTION] === 'object' && !Array.isArray(mcp[OPENCODE_V2_SECTION])) return mcp[OPENCODE_V2_SECTION];
  const out = {};
  for (const [id, def] of Object.entries(mcp)) {
    if (OPENCODE_RESERVED_MCP_KEYS.includes(id)) continue;
    out[id] = def;
  }
  return out;
}

// Write a server container back into an OpenCode doc, preserving the detected layout
// and any reserved `mcp` keys. Mutates and returns doc.
function setOpencodeServers(doc, servers) {
  const layout = opencodeLayout(doc);
  const mcp = doc.mcp && typeof doc.mcp === 'object' && !Array.isArray(doc.mcp) ? doc.mcp : {};
  if (layout === 'v2') {
    doc.mcp = { ...mcp, [OPENCODE_V2_SECTION]: servers };
  } else {
    const reserved = {};
    for (const k of OPENCODE_RESERVED_MCP_KEYS) {
      if (Object.prototype.hasOwnProperty.call(mcp, k)) reserved[k] = mcp[k];
    }
    doc.mcp = { ...reserved, ...servers };
  }
  return doc;
}

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

// `layout` selects the OpenCode flag field: 'v1' uses `enabled: true`, 'v2' uses
// `disabled: false` (the v2 default is enabled, and an explicit value overrides any
// pre-existing `disabled: true`). When omitted, defaults to the legacy v1 shape.
function canonicalToOpencode(entry, layout) {
  const v2 = layout === 'v2';
  const flag = v2 ? { disabled: false } : { enabled: true };
  if (isRemoteEntry(entry)) {
    const def = { type: 'remote', url: entry.url, ...flag };
    if (entry.headers && typeof entry.headers === 'object') def.headers = clone(entry.headers);
    return def;
  }
  const def = { type: 'local', command: [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])], ...flag };
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
  opencodeLayout,
  opencodeServers,
  setOpencodeServers,
};
