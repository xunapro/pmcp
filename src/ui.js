'use strict';

const prompts = require('prompts');

const { t } = require('./i18n');
const { TARGETS } = require('./model');

function cancelExit() {
  console.log(t('ui.cancelled'));
  process.exit(0);
}

async function promptServers(registry, enabled) {
  const res = await prompts(
    {
      type: 'multiselect',
      name: 'servers',
      message: t('ui.serversMessage'),
      choices: registry.map((e) => ({
        title: `${e.name} — ${e.description}`,
        value: e.id,
        selected: enabled.has(e.id),
      })),
    },
    { onCancel: cancelExit }
  );
  return res.servers;
}

async function promptTargets() {
  const res = await prompts(
    {
      type: 'multiselect',
      name: 'targets',
      message: t('ui.targetsMessage'),
      choices: Object.keys(TARGETS).map((k) => ({ title: TARGETS[k].label, value: k, selected: true })),
    },
    { onCancel: cancelExit }
  );
  return res.targets || [];
}

async function promptConfirm(targetKeys) {
  const files = targetKeys.map((k) => TARGETS[k].fileName).join(', ');
  const res = await prompts(
    {
      type: 'confirm',
      name: 'ok',
      message: t('ui.confirmMessage', { files }),
      initial: true,
    },
    { onCancel: cancelExit }
  );
  return res.ok === true;
}

async function promptSourceChoice(id) {
  if (!process.stdin.isTTY) return null;
  const res = await prompts(
    {
      type: 'select',
      name: 'choice',
      message: t('register.conflictMessage', { id }),
      choices: [
        { title: t('register.choiceClaude'), value: 'claude' },
        { title: t('register.choiceOpencode'), value: 'opencode' },
        { title: t('register.choiceSkip'), value: 'skip' },
      ],
    },
    { onCancel: () => {} }
  );
  return res.choice || null;
}

function printSummary(reports) {
  if (reports.length === 0) {
    console.log(t('summary.noneSelected'));
    return;
  }
  for (const r of reports) {
    console.log(t(r.created ? 'summary.created' : 'summary.updated', { file: r.fileName }));
    console.log(r.enabled.length > 0 ? t('summary.enabled', { list: r.enabled.join(', ') }) : t('summary.none'));
    if (r.disabled.length > 0) console.log(t('summary.disabled', { list: r.disabled.join(', ') }));
  }
}

module.exports = {
  cancelExit,
  promptServers,
  promptTargets,
  promptConfirm,
  promptSourceChoice,
  printSummary,
};
