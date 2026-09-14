# Vendored Claude skills

These skills are copied ("vendored") from upstream repositories rather than
installed as plugins, so they are available in remote/web Claude Code sessions
and to anyone who clones this repo. They do **not** auto-update — re-pull and
re-review when you want newer versions.

## Provenance

| Skills | Upstream | License | Pinned at |
|---|---|---|---|
| `ui-ux-pro-max`, `ui-styling`, `design`, `design-system`, `brand`, `banner-design`, `slides` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | `a38d04c` |
| `frontend-design`, `webapp-testing` | [anthropics/skills](https://github.com/anthropics/skills) | Apache-2.0 | see each `LICENSE.txt` |
| `impeccable` (plus 4 subagents in `.claude/agents/`) | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 | `2149fcc` — plugin v4.3.1, engine 0.1.5 |
| `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills` | [obra/superpowers](https://github.com/obra/superpowers) | MIT | — |

The `ui-ux-pro-max` pin `a38d04c` is older than upstream `HEAD`, but the
skill payload itself has not moved: every commit between `a38d04c` and
`7f69fed` (2026-09-10) touched only the README, CLI and gallery, never
`.claude/skills/` or `src/`. Re-check that before assuming an update is due.

## Runtime requirements

### ui-ux-pro-max

Python 3, standard library only. No install step.

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard" --stack shadcn
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "civic trust" -d color
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "reporting portal" --design-system
```

Useful stacks here: `shadcn`, `nextjs`, `react` (autocare, rallyready),
`html-tailwind` (bike-guide-app, corruption-reporting-system-final).
Coverage for `flutter` (cyclemind_ai) is sparse — queries often return no match.

### webapp-testing

Needs the **Python** Playwright binding, which is not preinstalled. The version
must match the Chromium build shipped in the environment (`1194`), so pin it:

```bash
pip install "playwright==1.56.0"
```

Do **not** run `playwright install` — the browsers are already at
`$PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers`). Installing an unpinned
Playwright pulls 1.62.0, which looks for Chromium build `1234` and fails.

Node's Playwright (1.56.1) is already available via `npx playwright` if you
prefer the JS API.

### impeccable

A design-review engine for frontend work: one skill with 23 sub-commands
(`shape`, `critique`, `audit`, `polish`, `bolder`, `harden`, `animate`, ...) and
a mechanical anti-pattern detector.

The launcher is a POSIX shell script; it needs no Node or Python. On first run it
downloads a ~16 MB self-contained engine binary for the platform, verifies it
against its published `.sha256` sidecar, and caches it in `~/.impeccable/bin/<version>/`:

```bash
.claude/skills/impeccable/scripts/impeccable engine-probe   # -> impeccable-engine 0.1.5
.claude/skills/impeccable/scripts/impeccable context        # run from the project dir
.claude/skills/impeccable/scripts/impeccable detect --json portfolio
```

That download works from remote sessions through the agent proxy — verified here.
The cache lives in `$HOME`, so a fresh remote container re-downloads it once. To
skip the download entirely, point `IMPECCABLE_BIN` at a preinstalled binary, or
`IMPECCABLE_HOME` at a writable cache. `detect` exits **2** when it finds
anti-patterns and **0** when clean, so don't treat a non-zero exit as a crash.

**Hooks are deliberately not installed.** Upstream ships a `PostToolUse` hook on
`Edit|Write` plus a `Stop` hook that run the detector automatically. In a monorepo
of eight projects — most of them not frontend work — that fires the design engine
on Prisma schemas and CI scripts too. Without the hooks the skill degrades
cleanly: it prints `MANUAL_DETECTOR_REQUIRED` and tells you to run `detect`
yourself once the UI is done. To opt in anyway, copy the `hooks` block from
[upstream `plugin/hooks/hooks.json`](https://github.com/pbakaus/impeccable/blob/main/plugin/hooks/hooks.json)
into `.claude/settings.json`, replacing `${CLAUDE_PLUGIN_ROOT}/skills/impeccable`
with `$CLAUDE_PROJECT_DIR/.claude/skills/impeccable`.

The 4 vendored subagents in `.claude/agents/` are the skill's finish handoffs.
They are optional — `reference/degraded/` carries in-thread fallbacks if they
are unavailable.

### superpowers

Vendored as plain skills. Upstream ships a session-start hook that
auto-announces the skill set; that hook is **not** installed here, so invoke the
skills explicitly. For local (non-remote) use, the plugin install is cleaner:

```
/plugin install superpowers@claude-plugins-official
```
