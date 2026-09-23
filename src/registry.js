'use strict';

const fs = require('fs');
const path = require('path');
const prompts = require('prompts');

const { t, resolveLanguage } = require('./i18n');
const { toCanonicalFromClaude, toCanonicalFromOpencode, canonicalToClaude, registryEntryToFile } = require('./model');
const { writeJsonObject } = require('./persistence');

function registryFilePath(home) {
  return path.join(home, '.pmcp', 'registry.json');
}

function normalizeUserEntry(item, notices) {
  if (!item || typeof item !== 'object' || typeof item.id !== 'string' || item.id === '') {
    notices.push(t('registry.noId'));
    return null;
  }
  let canonical = null;
  if (typeof item.command === 'string') {
    canonical = toCanonicalFromClaude(item);
  } else if (item.claude && typeof item.claude === 'object') {
    // Legacy dual-format entry: the claude field is authoritative when it disagrees with opencode.
    canonical = toCanonicalFromClaude(item.claude);
  } else if (item.opencode && typeof item.opencode === 'object') {
    canonical = toCanonicalFromOpencode(item.opencode);
  }
  if (!canonical) {
    notices.push(t('registry.unconvertible', { id: item.id }));
    return null;
  }
  return { id: item.id, name: item.name || item.id, description: item.description || '', ...canonical, _raw: item };
}

function loadRegistry(home, notices) {
  const filePath = registryFilePath(home);
  let raw = null;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(t('registry.readFail', { path: filePath, message: err.message }));
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(t('registry.invalidJson', { path: filePath }));
  }
  if (!Array.isArray(parsed)) {
    throw new Error(t('registry.notArray', { path: filePath }));
  }
  const entries = [];
  for (const item of parsed) {
    const entry = normalizeUserEntry(item, notices);
    if (entry) entries.push(entry);
  }
  return entries;
}

function readGlobalFile(filePath, notices) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    notices.push(t('global.readFail', { path: filePath, message: err.message }));
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    notices.push(t('global.notObject', { path: filePath }));
    return null;
  } catch {
    notices.push(t('global.invalidJson', { path: filePath }));
    return null;
  }
}

function collectGlobalEntries(home, notices) {
  let available = 0;
  let unconvertible = 0;
  const byId = new Map();
  const claudeCfg = readGlobalFile(path.join(home, '.claude.json'), notices);
  if (claudeCfg !== null) available++;
  const claudeSection = claudeCfg && claudeCfg.mcpServers;
  if (claudeSection && typeof claudeSection === 'object' && !Array.isArray(claudeSection)) {
    for (const [id, def] of Object.entries(claudeSection)) {
      if (!byId.has(id)) byId.set(id, {});
      byId.get(id).claude = def && typeof def === 'object' ? def : null;
    }
  }
  const ocCfg = readGlobalFile(path.join(home, '.config', 'opencode', 'opencode.json'), notices);
  if (ocCfg !== null) available++;
  const ocSection = ocCfg && ocCfg.mcp;
  if (ocSection && typeof ocSection === 'object' && !Array.isArray(ocSection)) {
    for (const [id, def] of Object.entries(ocSection)) {
      if (!byId.has(id)) byId.set(id, {});
      byId.get(id).opencode = def && typeof def === 'object' ? def : null;
    }
  }
  const entries = [];
  for (const [id, defs] of byId) {
    // On same-id conflicts the Claude Code source wins; OpenCode only fills missing ids.
    let canonical = defs.claude ? toCanonicalFromClaude(defs.claude) : null;
    if (!canonical && defs.opencode) canonical = toCanonicalFromOpencode(defs.opencode);
    if (!canonical) {
      unconvertible++;
      notices.push(t('global.skipUnconvertible', { id }));
      continue;
    }
    entries.push({ id, name: id, description: t('global.importedDesc'), ...canonical });
  }
  return { entries, available, unconvertible };
}

async function initRegistry(home) {
  resolveLanguage(home);
  const notices = [];
  const collected = collectGlobalEntries(home, notices);
  if (collected.available === 0) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('init.noSources'));
    process.exitCode = 1;
    return;
  }
  let existing;
  try {
    existing = loadRegistry(home, notices);
  } catch (err) {
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return;
  }
  const doc = existing === null ? [] : existing;
  let added = 0;
  let updated = 0;
  let skippedChanges = 0;
  for (const entry of collected.entries) {
    const idx = doc.findIndex((e) => e.id === entry.id);
    if (idx === -1) {
      doc.push(entry);
      added++;
      continue;
    }
    const same = JSON.stringify(canonicalToClaude(doc[idx])) === JSON.stringify(canonicalToClaude(entry));
    if (same) continue;
    const res = await prompts(
      { type: 'confirm', name: 'yes', message: t('init.confirm', { id: entry.id }), initial: false },
      { onCancel: () => {} }
    );
    if (res.yes === true) {
      doc[idx] = entry;
      updated++;
    } else {
      skippedChanges++;
    }
  }
  if (added > 0 || updated > 0 || existing === null) {
    fs.mkdirSync(path.dirname(registryFilePath(home)), { recursive: true });
    writeJsonObject(registryFilePath(home), doc.map(registryEntryToFile));
  }
  for (const n of notices) console.warn(t('note.prefix') + n);
  console.log(
    t('init.summary', {
      added,
      updated,
      skippedChanges,
      skippedUnconvertible: collected.unconvertible,
    })
  );
}

module.exports = {
  registryFilePath,
  normalizeUserEntry,
  loadRegistry,
  readGlobalFile,
  collectGlobalEntries,
  initRegistry,
};
