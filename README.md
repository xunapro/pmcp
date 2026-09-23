# PMCP — Project MCP Manager

[中文文档：README_ZH.md](README_ZH.md)

Dynamically manage **project-level** MCP server configs. Instead of every project inheriting all globally configured MCP servers, `pmcp` lets each project enable only what it actually needs — via a terminal checkbox UI.

`pmcp` writes selections into the client config files found in the project directory:

| Client | Project file | Section |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `mcpServers` |
| OpenCode | `opencode.json` | `mcp` |

## Requirements

- Node.js >= 18 — no build step; the two npm dependencies (`commander`, `prompts`) are fetched automatically on install

## Install

Works on **Windows / Linux / macOS** in **any terminal** (cmd, PowerShell, Git Bash, sh, zsh…). No manual PATH / environment setup is needed: `npm` registers the `pmcp` command in its global bin directory (already on PATH when Node.js was installed) and generates the correct per-OS launcher (`pmcp.cmd`/`pmcp.ps1` on Windows, symlink on Unix).

```bash
# From the project directory (or an unpacked pmcp-1.0.0.tgz from `npm pack`):
npm install -g .
# equivalent helper script:
npm run setup

# Development mode (command points at the source dir, edits take effect instantly):
npm install && npm link
```

Verify:

```bash
pmcp --version   # or: npm run verify
```

No-install alternative: `npx --yes <path-or-package> [command]`.

## Quick start

```bash
pmcp init        # one-time: build ~/.pmcp/registry.json from your global client configs
pmcp             # run inside a project: checkbox UI, space to toggle, enter to confirm
pmcp lang zh     # switch UI language to Chinese (default en)
```

If the project has neither `.mcp.json` nor `opencode.json`, `pmcp` asks which file(s) to create. Servers not managed by the registry are always preserved untouched.

## Use with an AI agent

This repo ships `AGENTS.md` — an agent-facing doc (auto-detected by coding agents such as OpenCode and Claude Code) covering installation, data formats and safety invariants. Copy the following prompts to an agent, in order.

**Prompt 1 — install the tool:**

> Install pmcp on this machine:
> 1. Check `node --version` — must be >= 18; if missing or older, install/upgrade Node.js first using the platform package manager (Windows: `winget install OpenJS.NodeJS.LTS`, macOS: `brew install node`, Linux: your distro's manager or nvm).
> 2. In this repository run `npm install` (fetches deps: commander, prompts), then `npm install -g .` (equivalently `npm run setup`) to register the `pmcp` command on PATH for the current user — no manual environment setup is needed on any OS/terminal.
> 3. Verify: `pmcp --version` must print `1.0.0` and `pmcp --help` must exit 0.
> 4. Report the installed command location and any errors.

**Prompt 2 — initialize the registry (first run):**

> Read `AGENTS.md` in this repository, then run `pmcp init` to build `~/.pmcp/registry.json` from the existing client global configs (`~/.claude.json`, OpenCode user config). Report the result, including any remote (`url`) entries that were skipped. If `pmcp init` exits 1 because no client global config exists, hand-write `~/.pmcp/registry.json` using the canonical entry format from AGENTS.md. Do not run the bare `pmcp` command in non-TTY contexts (it is an interactive checkbox UI).

**Prompt 3 — manage a project's servers (day-to-day):**

> In `<project path>`, enable the MCP servers `<ids from ~/.pmcp/registry.json>` for both Claude Code and OpenCode, writing each client's definition per the generation rules in AGENTS.md. Preserve all keys and servers pmcp does not manage.

Of course you can also just run `pmcp` yourself inside the project directory for the interactive experience.

## Commands

| Command | Description |
| --- | --- |
| `pmcp` | Interactive server selection for the current directory |
| `pmcp init` | Initialize/update `~/.pmcp/registry.json` from `~/.claude.json` and `~/.config/opencode/opencode.json`. Global files are always read-only; registry entries are only added, changes require per-item confirmation, nothing is ever deleted. Idempotent. |
| `pmcp lang [en\|zh]` | Print or set the UI language (persisted to `~/.pmcp/settings.json`) |
| `pmcp --help` / `--version` | Usage / version, no interaction |

Exit codes: `0` success or user cancel (cancel never writes files); `1` fatal (e.g. corrupted registry/config JSON — nothing is modified).

## Registry format

`~/.pmcp/registry.json` is the single source for the checkbox list. Each entry stores **one canonical launch definition**; client-specific formats are generated at save time:

```json
[
  {
    "id": "git",
    "name": "Git",
    "description": "Git repository tools",
    "command": "uvx",
    "args": ["mcp-server-git"],
    "env": { "KEY": "value" }
  }
]
```

On save: Claude Code gets `{ "command": "uvx", "args": ["mcp-server-git"], "env": {...} }`; OpenCode gets `{ "type": "local", "command": ["uvx", "mcp-server-git"], "environment": {...}, "enabled": true }`. Legacy entries with per-client `claude`/`opencode` fields are still loaded (normalized from the `claude` field) without rewriting the file. You may also edit this file by hand — `pmcp` never writes it outside `pmcp init`.

## Limitations

- Remote (SSE / HTTP `url`) servers are not supported; such entries are skipped with a notice.
- `opencode.json` must be pure JSON (JSONC comments would be lost on rewrite).
- Writes are whole-file `writeFileSync` (non-atomic), acceptable for v1.

## Uninstall

```bash
npm run teardown   # npm uninstall -g pmcp
rm -rf ~/.pmcp     # optional: remove registry + settings
```

---

[中文文档：README_ZH.md](README_ZH.md)
