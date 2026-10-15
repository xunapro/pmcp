'use strict';

const fs = require('fs');
const path = require('path');
const prompts = require('prompts');

const { t, resolveLanguage } = require('./i18n');
const { toCanonicalFromClaude, toCanonicalFromOpencode, registryEntryToFile, sameLaunchDef } = require('./model');
const { writeJsonObject, readState, removeFromProject } = require('./persistence');
const { readGlobalFile, collectGlobalEntries, collectProjectEntries } = require('./sources');

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
  } else if (typeof item.url === 'string' && item.url.length > 0) {
    // Remote entry: { url, type } uses the Claude Code type vocabulary in the registry file.
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

async function mergeIntoRegistry(doc, entries, promptOverride) {
  let added = 0;
  let updated = 0;
  let skippedChanges = 0;
  for (const entry of entries) {
    const idx = doc.findIndex((e) => e.id === entry.id);
    if (idx === -1) {
      doc.push(entry);
      added++;
      continue;
    }
    if (sameLaunchDef(doc[idx], entry)) continue;
    const yes = await promptOverride(entry.id);
    if (yes === true) {
      doc[idx] = entry;
      updated++;
    } else {
      skippedChanges++;
    }
  }
  return { added, updated, skippedChanges };
}

async function registerToRegistry(projectDir, home, selectSide) {
  resolveLanguage(home);
  const notices = [];
  let collected;
  try {
    collected = collectProjectEntries(projectDir, notices);
  } catch (err) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return;
  }
  if (collected.entries.length === 0 && collected.conflicts.length === 0) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('register.nothingToRegister'));
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
  if (existing === null) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('registry.missing', { path: registryFilePath(home) }));
    return;
  }
  const doc = existing;
  const candidates = [...collected.entries];
  let conflictsSkipped = 0;
  for (const c of collected.conflicts) {
    const choice = typeof selectSide === 'function' ? await selectSide(c.id) : null;
    if (choice === 'claude') {
      candidates.push({ id: c.id, name: c.id, description: t('register.importedDesc'), ...toCanonicalFromClaude(c.claude) });
    } else if (choice === 'opencode') {
      candidates.push({ id: c.id, name: c.id, description: t('register.importedDesc'), ...toCanonicalFromOpencode(c.opencode) });
    } else {
      conflictsSkipped++;
    }
  }
  const promptOverride = async (id) => {
    const res = await prompts(
      { type: 'confirm', name: 'yes', message: t('register.overrideConfirm', { id }), initial: false },
      { onCancel: () => {} }
    );
    return res.yes === true;
  };
  const { added, updated, skippedChanges } = await mergeIntoRegistry(doc, candidates, promptOverride);
  if (added > 0 || updated > 0) {
    fs.mkdirSync(path.dirname(registryFilePath(home)), { recursive: true });
    writeJsonObject(registryFilePath(home), doc.map(registryEntryToFile));
  }
  for (const n of notices) console.warn(t('note.prefix') + n);
  console.log(
    t('register.summary', {
      added,
      updated,
      skippedChanges,
      conflictsSkipped,
      skippedUnconvertible: collected.unconvertible,
    })
  );
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
  const promptOverride = async (id) => {
    const res = await prompts(
      { type: 'confirm', name: 'yes', message: t('init.confirm', { id }), initial: false },
      { onCancel: () => {} }
    );
    return res.yes === true;
  };
  const { added, updated, skippedChanges } = await mergeIntoRegistry(doc, collected.entries, promptOverride);
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

async function unregisterFromRegistry(projectDir, home, promptSelect, promptConfirmRemove) {
  resolveLanguage(home);
  const notices = [];
  let registry;
  try {
    registry = loadRegistry(home, notices);
  } catch (err) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return;
  }
  if (registry === null) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('registry.missing', { path: registryFilePath(home) }));
    return;
  }
  if (registry.length === 0) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('unregister.noneToRemove'));
    return;
  }
  const selected = typeof promptSelect === 'function' ? await promptSelect(registry) : [];
  if (!Array.isArray(selected) || selected.length === 0) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('ui.cancelled'));
    return;
  }
  const selectedSet = new Set(selected);
  let state;
  try {
    state = readState(projectDir, registry);
  } catch (err) {
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return;
  }
  const enabledSelected = selected.filter((id) => state.enabled.has(id));
  let removedFromProject = [];
  if (enabledSelected.length > 0) {
    const yes = typeof promptConfirmRemove === 'function' ? await promptConfirmRemove(enabledSelected) : false;
    if (yes === true) {
      const reports = removeFromProject(projectDir, enabledSelected, state);
      removedFromProject = reports.reduce((acc, r) => acc.concat(r.removed), []);
    }
  }
  const doc = registry.filter((e) => !selectedSet.has(e.id));
  fs.mkdirSync(path.dirname(registryFilePath(home)), { recursive: true });
  writeJsonObject(registryFilePath(home), doc.map(registryEntryToFile));
  for (const n of notices) console.warn(t('note.prefix') + n);
  console.log(t('unregister.summary', { removed: selected.length }));
  if (removedFromProject.length > 0) {
    console.log(t('unregister.projectRemoved', { list: removedFromProject.join(', ') }));
  }
}

function renameRegistryEntry(home, id, newName) {
  resolveLanguage(home);
  const notices = [];
  let registry;
  try {
    registry = loadRegistry(home, notices);
  } catch (err) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return false;
  }
  if (registry === null) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('registry.missing', { path: registryFilePath(home) }));
    return false;
  }
  const name = typeof newName === 'string' ? newName.trim() : '';
  if (name === '') {
    console.error(t('error.prefix') + t('rename.emptyName'));
    process.exitCode = 1;
    return false;
  }
  const entry = registry.find((e) => e.id === id);
  if (!entry) {
    console.error(t('error.prefix') + t('rename.notFound', { id }));
    process.exitCode = 1;
    return false;
  }
  entry.name = name;
  if (entry._raw && typeof entry._raw === 'object') entry._raw.name = name;
  fs.mkdirSync(path.dirname(registryFilePath(home)), { recursive: true });
  writeJsonObject(registryFilePath(home), registry.map(registryEntryToFile));
  for (const n of notices) console.warn(t('note.prefix') + n);
  console.log(t('rename.success', { id, name }));
  return true;
}

async function renameRegistryInteractive(home, promptSelect, promptName) {
  resolveLanguage(home);
  const notices = [];
  let registry;
  try {
    registry = loadRegistry(home, notices);
  } catch (err) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return;
  }
  if (registry === null) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('registry.missing', { path: registryFilePath(home) }));
    return;
  }
  if (registry.length === 0) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('rename.noneToRename'));
    return;
  }
  const id = typeof promptSelect === 'function' ? await promptSelect(registry) : null;
  if (!id) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('ui.cancelled'));
    return;
  }
  const name = typeof promptName === 'function' ? await promptName() : null;
  if (!name || name.trim() === '') {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('ui.cancelled'));
    return;
  }
  renameRegistryEntry(home, id, name);
}

module.exports = {
  registryFilePath,
  normalizeUserEntry,
  loadRegistry,
  mergeIntoRegistry,
  registerToRegistry,
  initRegistry,
  unregisterFromRegistry,
  renameRegistryEntry,
  renameRegistryInteractive,
};
