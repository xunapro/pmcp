'use strict';

const fs = require('fs');
const path = require('path');

const { t } = require('./i18n');
const { TARGETS, canonicalToClaude, canonicalToOpencode } = require('./model');

function writeJsonObject(filePath, doc) {
  const content = JSON.stringify(doc, null, 2) + '\n';
  JSON.parse(content);
  fs.writeFileSync(filePath, content, 'utf8');
}

function readJsonObject(filePath, fileName) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
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
    const section = parsed[target.section];
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      for (const entry of registry) {
        if (Object.prototype.hasOwnProperty.call(section, entry.id)) enabled.add(entry.id);
      }
    }
  }
  return { managed, data, enabled };
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
    const prevSectionRaw = doc[target.section];
    const prevSection =
      prevSectionRaw && typeof prevSectionRaw === 'object' && !Array.isArray(prevSectionRaw)
        ? prevSectionRaw
        : {};
    const nextSection = { ...prevSection };
    const removed = [];
    for (const entry of registry) {
      if (selected.has(entry.id)) {
        nextSection[entry.id] = key === 'claude' ? canonicalToClaude(entry) : canonicalToOpencode(entry);
      } else if (Object.prototype.hasOwnProperty.call(nextSection, entry.id)) {
        delete nextSection[entry.id];
        removed.push(entry.id);
      }
    }
    doc[target.section] = nextSection;
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
  readState,
  save,
};
