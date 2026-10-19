'use strict';

const fs = require('fs');
const path = require('path');

const { t } = require('./i18n');
const { TARGETS, canonicalToClaude, canonicalToOpencode, opencodeServers, opencodeLayout, setOpencodeServers } = require('./model');

// Some editors write a UTF-8 BOM; JSON.parse rejects it, so strip a leading one.
function stripBom(text) {
  return typeof text === 'string' && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function writeJsonObject(filePath, doc) {
  const content = JSON.stringify(doc, null, 2) + '\n';
  JSON.parse(content);
  fs.writeFileSync(filePath, content, 'utf8');
}

function readJsonObject(filePath, fileName) {
  let raw;
  try {
    raw = stripBom(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(t('project.readFail', { name: fileName, message: err.message }));
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(t('project.invalidJson', { name: fileName, path: filePath }));
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('project.notObject', { name: fileName, path: filePath }));
  }
  return parsed;
}

function readState(projectDir, registry) {
  const managed = [];
  const data = {};
  const enabled = new Set();
  for (const key of Object.keys(TARGETS)) {
    const target = TARGETS[key];
    const parsed = readJsonObject(path.join(projectDir, target.fileName), target.fileName);
    if (parsed === null) continue;
    managed.push(key);
    data[key] = parsed;
    const section = key === 'opencode' ? opencodeServers(parsed) : parsed[target.section];
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      for (const entry of registry) {
        if (Object.prototype.hasOwnProperty.call(section, entry.id)) enabled.add(entry.id);
      }
    }
  }
  return { managed, data, enabled };
}

function removeFromProject(projectDir, ids, state) {
  const idSet = new Set(ids);
  const reports = [];
  for (const key of state.managed) {
    const target = TARGETS[key];
    const doc = state.data[key];
    const isOpencode = key === 'opencode';
    const sectionRaw = isOpencode ? opencodeServers(doc) : doc[target.section];
    if (!sectionRaw || typeof sectionRaw !== 'object' || Array.isArray(sectionRaw)) continue;
    const nextSection = { ...sectionRaw };
    const removed = [];
    for (const id of idSet) {
      if (Object.prototype.hasOwnProperty.call(nextSection, id)) {
        delete nextSection[id];
        removed.push(id);
      }
    }
    if (removed.length === 0) continue;
    if (isOpencode) {
      setOpencodeServers(doc, nextSection);
    } else {
      doc[target.section] = nextSection;
    }
    writeJsonObject(path.join(projectDir, target.fileName), doc);
    reports.push({ targetKey: key, fileName: target.fileName, removed });
  }
  return reports;
}

function save(projectDir, selectedIds, targetKeys, state, registry) {
  const selected = new Set(selectedIds);
  const reports = [];
  for (const key of targetKeys) {
    const target = TARGETS[key];
    const prevDoc = state.data[key];
    const existed = prevDoc !== null && prevDoc !== undefined;
    if (!existed && selected.size === 0) continue;
    const doc = existed ? prevDoc : {};
    const isOpencode = key === 'opencode';
    const ocLayout = isOpencode ? opencodeLayout(doc) : null;
    const prevRaw = isOpencode ? opencodeServers(doc) : doc[target.section];
    const prevSection = prevRaw && typeof prevRaw === 'object' && !Array.isArray(prevRaw) ? prevRaw : {};
    const nextSection = { ...prevSection };
    const removed = [];
    for (const entry of registry) {
      if (selected.has(entry.id)) {
        const generated = isOpencode ? canonicalToOpencode(entry, ocLayout) : canonicalToClaude(entry);
        const existingDef = nextSection[entry.id] && typeof nextSection[entry.id] === 'object' ? nextSection[entry.id] : {};
        nextSection[entry.id] = { ...existingDef, ...generated };
      } else if (Object.prototype.hasOwnProperty.call(nextSection, entry.id)) {
        delete nextSection[entry.id];
        removed.push(entry.id);
      }
    }
    if (isOpencode) {
      if (!existed) doc.$schema = 'https://opencode.ai/config.json';
      setOpencodeServers(doc, nextSection);
    } else {
      doc[target.section] = nextSection;
    }
    writeJsonObject(path.join(projectDir, target.fileName), doc);
    reports.push({
      targetKey: key,
      fileName: target.fileName,
      created: !existed,
      enabled: registry.filter((e) => selected.has(e.id)).map((e) => e.id),
      disabled: removed,
    });
  }
  return reports;
}

module.exports = {
  writeJsonObject,
  readJsonObject,
  stripBom,
  readState,
  save,
  removeFromProject,
};
