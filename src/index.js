#!/usr/bin/env node
'use strict';

const os = require('os');
const { Command } = require('commander');

const { MESSAGES, SUPPORTED_LANGS, t, getLanguage, resolveLanguage, setLanguage } = require('./i18n');
const { TARGETS, toCanonicalFromClaude, toCanonicalFromOpencode, canonicalToClaude, canonicalToOpencode, sameLaunchDef } = require('./model');
const { normalizeUserEntry, loadRegistry, initRegistry, registerToRegistry, registryFilePath } = require('./registry');
const { collectGlobalEntries, collectProjectEntries } = require('./sources');
const { readState, save } = require('./persistence');
const { promptServers, promptTargets, promptConfirm, promptSourceChoice, printSummary } = require('./ui');

async function run(projectDir, home) {
  const userHome = home || os.homedir();
  const notices = [];
  resolveLanguage(userHome, notices);
  let registry;
  try {
    registry = loadRegistry(userHome, notices);
  } catch (err) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return;
  }
  if (registry === null) {
    for (const n of notices) console.warn(t('note.prefix') + n);
    console.log(t('registry.missing', { path: registryFilePath(userHome) }));
    return;
  }
  for (const n of notices) console.warn(t('note.prefix') + n);

  let state;
  try {
    state = readState(projectDir, registry);
  } catch (err) {
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
    return;
  }

  const servers = await promptServers(registry, state.enabled);

  let targetKeys = state.managed;
  if (targetKeys.length === 0) {
    if (servers.length === 0) {
      console.log(t('summary.noneSelected'));
      return;
    }
    targetKeys = await promptTargets();
    if (targetKeys.length === 0) {
      console.log(t('summary.noTargets'));
      return;
    }
  }

  const ok = await promptConfirm(targetKeys);
  if (!ok) {
    console.log(t('ui.cancelled'));
    return;
  }

  const reports = save(projectDir, servers, targetKeys, state, registry);
  printSummary(reports);
}

function main() {
  const pkg = require('../package.json');
  const home = os.homedir();
  resolveLanguage(home);
  const program = new Command();
  program
    .name('pmcp')
    .description(t('cli.description'))
    .version(pkg.version, '-V, --version', t('cli.versionOpt'))
    .helpOption('-h, --help', t('cli.helpOpt'))
    .action(async () => {
      await run(process.cwd());
    });
  program
    .command('init')
    .description(t('cli.initDesc'))
    .action(async () => {
      await initRegistry(home);
    });
  program
    .command('register')
    .description(t('cli.registerDesc'))
    .action(async () => {
      await registerToRegistry(process.cwd(), home, promptSourceChoice);
    });
  program
    .command('lang')
    .description(t('cli.langDesc'))
    .argument('[code]', t('cli.langArg'))
    .action((code) => {
      if (code === undefined) {
        console.log(getLanguage());
        return;
      }
      if (!SUPPORTED_LANGS.includes(code)) {
        console.error(t('error.prefix') + t('lang.unsupported', { code, supported: SUPPORTED_LANGS.join(', ') }));
        process.exitCode = 1;
        return;
      }
      setLanguage(home, code);
      console.log(t('lang.set', { code }));
    });
  program.parseAsync(process.argv).catch((err) => {
    console.error(t('error.prefix') + err.message);
    process.exitCode = 1;
  });
}

if (require.main === module) {
  main();
}

// Compatibility re-exports: external require('src/index.js') keeps working after the D2 split.
module.exports = {
  MESSAGES,
  TARGETS,
  loadRegistry,
  normalizeUserEntry,
  collectGlobalEntries,
  collectProjectEntries,
  initRegistry,
  registerToRegistry,
  toCanonicalFromClaude,
  toCanonicalFromOpencode,
  canonicalToClaude,
  canonicalToOpencode,
  sameLaunchDef,
  readState,
  save,
  run,
  t,
  resolveLanguage,
  setLanguage,
};
