'use strict';

const fs = require('fs');
const path = require('path');

const { t } = require('./i18n');
const { toCanonicalFromClaude, toCanonicalFromOpencode, sameLaunchDef, TARGETS } = require('./model');
const { readJsonObject } = require('./persistence');

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

function collectProjectEntries(projectDir, notices) {
  let unconvertible = 0;
  const byId = new Map();
  for (const [key, target] of Object.entries(TARGETS)) {
    const parsed = readJsonObject(path.join(projectDir, target.fileName), target.fileName);
    if (parsed === null) continue;
    const section = parsed[target.section];
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      for (const [id, def] of Object.entries(section)) {
        if (!byId.has(id)) byId.set(id, {});
        byId.get(id)[key] = def && typeof def === 'object' ? def : null;
      }
    }
  }
  const entries = [];
  const conflicts = [];
  for (const [id, defs] of byId) {
    if (!defs.claude && !defs.opencode) continue;
    if (!defs.claude) {
      const canon = defs.opencode ? toCanonicalFromOpencode(defs.opencode) : null;
      if (!canon) {
        unconvertible++;
        notices.push(t('register.skipUnconvertible', { id }));
        continue;
      }
      entries.push({ id, name: id, description: t('register.importedDesc'), ...canon });
      continue;
    }
    const claudeCanon = toCanonicalFromClaude(defs.claude);
    if (!defs.opencode) {
      if (!claudeCanon) {
        unconvertible++;
        notices.push(t('register.skipUnconvertible', { id }));
        continue;
      }
      entries.push({ id, name: id, description: t('register.importedDesc'), ...claudeCanon });
      continue;
    }
    const opencodeCanon = toCanonicalFromOpencode(defs.opencode);
    if (claudeCanon && opencodeCanon && sameLaunchDef(claudeCanon, opencodeCanon)) {
      entries.push({ id, name: id, description: t('register.importedDesc'), ...claudeCanon });
    } else if (claudeCanon && opencodeCanon) {
      conflicts.push({ id, claude: defs.claude, opencode: defs.opencode });
    } else if (claudeCanon) {
      entries.push({ id, name: id, description: t('register.importedDesc'), ...claudeCanon });
    } else if (opencodeCanon) {
      entries.push({ id, name: id, description: t('register.importedDesc'), ...opencodeCanon });
    } else {
      unconvertible++;
      notices.push(t('register.skipUnconvertible', { id }));
    }
  }
  return { entries, conflicts, unconvertible };
}

module.exports = {
  readGlobalFile,
  collectGlobalEntries,
  collectProjectEntries,
};
