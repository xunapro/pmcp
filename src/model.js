'use strict';

const TARGETS = {
  claude: { fileName: '.mcp.json', section: 'mcpServers', label: 'Claude Code (.mcp.json)' },
  opencode: { fileName: 'opencode.json', section: 'mcp', label: 'OpenCode (opencode.json)' },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Canonical launch definition: { command, args?, env? } — the single stored form of a registry entry.
function toCanonicalFromClaude(def) {
  if (!def || typeof def !== 'object') return null;
  if (def.url || (def.type && def.type !== 'stdio') || typeof def.command !== 'string') return null;
  const canonical = { command: def.command };
  if (Array.isArray(def.args) && def.args.length > 0) canonical.args = clone(def.args);
  if (def.env && typeof def.env === 'object') canonical.env = clone(def.env);
  return canonical;
}

function toCanonicalFromOpencode(def) {
  if (!def || typeof def !== 'object') return null;
  if (def.url || (def.type && def.type !== 'local') || !Array.isArray(def.command) || def.command.length === 0) return null;
  const canonical = { command: def.command[0] };
  const rest = def.command.slice(1);
  if (rest.length > 0) canonical.args = clone(rest);
  if (def.environment && typeof def.environment === 'object') canonical.env = clone(def.environment);
  return canonical;
}

// Client-specific definitions are generated on the fly from the canonical entry at save time.
function canonicalToClaude(entry) {
  const def = { command: entry.command };
  if (Array.isArray(entry.args) && entry.args.length > 0) def.args = clone(entry.args);
  if (entry.env && typeof entry.env === 'object') def.env = clone(entry.env);
  return def;
}

function canonicalToOpencode(entry) {
  const def = { type: 'local', command: [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])], enabled: true };
  if (entry.env && typeof entry.env === 'object') def.environment = clone(entry.env);
  return def;
}

function sameLaunchDef(a, b) {
  return JSON.stringify(canonicalToClaude(a)) === JSON.stringify(canonicalToClaude(b));
}

function registryEntryToFile(entry) {
  if (entry && entry._raw && typeof entry._raw === 'object') return entry._raw;
  const out = { id: entry.id, name: entry.name, description: entry.description };
  if (entry.command !== undefined) out.command = entry.command;
  if (Array.isArray(entry.args) && entry.args.length > 0) out.args = entry.args;
  if (entry.env && typeof entry.env === 'object') out.env = entry.env;
  return out;
}

module.exports = {
  TARGETS,
  toCanonicalFromClaude,
  toCanonicalFromOpencode,
  canonicalToClaude,
  canonicalToOpencode,
  registryEntryToFile,
  sameLaunchDef,
};
