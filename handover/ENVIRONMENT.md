> **Historical — scope changed 2026-10-26.** [ADR 0002](../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# Environment — paths, branches, services, quirks

## Repositories and branches

| What | Path | Branch / ref | Notes |
|---|---|---|---|
| Skills marketplace (dev checkout) | `~/IdeaProjects/meesho-open-m-skills` | `feat/grafana-dashboards-tables-links` (unrelated, with uncommitted grafana work) | `teach/` lives here **untracked**. Don't commit teach onto this branch. |
| Overlay marketplace branch | `origin/marketplace/hritvik-skills` | tip `3f626b2c` | What the installed `hritvik-skills` marketplace tracks. Commits land directly (no PR flow); push only with the learner's OK, fast-forward only. |
| M0 worktree | `~/IdeaProjects/meesho-open-m-skills-codewalk-m0` | `feat/codewalk-for-teach` (= `3f626b2c`) | SDD workspace in git-ignored `.superpowers/sdd/2026-10-23-m0-codewalk-for-teach/`. Delete after M0 Task 7. |
| Installed marketplace copy | `~/.claude/plugins/marketplaces/hritvik-skills` | — | Managed by Claude Code; don't develop in it. |
| Plugin cache | `~/.claude/plugins/cache/hritvik-skills/codewalk/` | holds `0.3.1` only | 0.8.1 not installed yet. |
| user-returns-service (URS) | `~/IdeaProjects/user-returns-service` | `develop` | First POC goal. Codewalks in `.claude/code-reading/` (git-excluded). ICUD HLD copy marked superseded by a Google Doc. |
| Sync spike | `~/IdeaProjects/teach-spike` | `main` (tags `spike-v1`, `spike-v1b`, `spike-v2`, `spike-v2b`) | Throwaway; synthetic data only. Old state moved to `.state-pre-q7/`. |

## Marketplace repo rules that bite

- Pre-commit hook `plugin-version-bump.sh`: any commit touching `<plugin>/` must bump `version` in **both**
  `<plugin>/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
- Lockstep invariant: a new agent or `bin/` tool is named in that plugin's `SKILL.md` in the same commit.
- Agents reach their own files via `${CLAUDE_PLUGIN_ROOT}/…` written in the agent body; never glob the plugin cache.
- Never `--no-verify` (TruffleHog). The artifact-review grounding pack is `docs/design-review/grounding.md`
  (mostly TODO — lenses run generic checks).

## Running service — the spike

- LaunchAgent `com.hritvik.teach-spike` → `~/Library/LaunchAgents/com.hritvik.teach-spike.plist` (source in
  `teach-spike/launchd/`), runs `teach-spike/run.sh` (migrate both D1s, then `wrangler dev` on `127.0.0.1:8787`).
- Status: `launchctl print gui/$(id -u)/com.hritvik.teach-spike` · health: `curl 127.0.0.1:8787/health` ·
  one soak line: `teach-spike/soak-check.sh`.
- Stop and remove: `launchctl bootout gui/$(id -u)/com.hritvik.teach-spike && rm ~/Library/LaunchAgents/com.hritvik.teach-spike.plist`.
- Inspect a D1 database: `npx wrangler d1 execute DB --local --persist-to ./.state -c <meesho|general>/wrangler.toml --command "…"`
  (reading the SQLite files directly is unreliable; the macOS `sqlite3` CLI can't open a copied WAL DB `-readonly`).
- MCP token: `teach-spike/meesho/.dev.vars` (git-ignored). Client entries for Claude Code and Codex were removed after testing.

## Tool quirks seen this session

- **UCL MCP** failed to connect all session (`ENOTFOUND ucl.prd.meesho.int`) — likely VPN. The **gym-tracker MCP**
  also failed DNS (`gym-tracker-mcp.hritvikdinkar.workers.dev`).
- The gym-tracker's source repo is not at `~/IdeaProjects/gym-tracker-skills` (the path in `~/.claude.json`); its
  shape was inferred from its tool list cache (`~/.cache/gym-tracker/tools.json`) and backup script.
- **Codex** is not logged in on this machine (`codex login status` → Not logged in). `codex mcp add` writes the
  global `~/.codex/config.toml`.
- `claude --plugin-dir <path>` loads an unreleased plugin for one (headless) session and wins over the installed
  copy — how M0's agent behaviour was checked.
- npm 11 withholds install scripts (e.g. `workerd`'s postinstall); the platform binary works without it — don't
  approve scripts unless needed.
- Homebrew auto-upgrade (`com.hritvik.brew-autoupgrade`) can change `node` underneath running services.
- Workers runtime: only handlers may be exported from an entry module; module-level caches must hold data, never
  a `Response`; `.dev.vars` sits beside each `wrangler.toml`; `wrangler dev` does not apply D1 migrations.

## Skills used, and for what

`superpowers:brainstorming` (design) · `mattpocock-skills:domain-modeling` (glossary/ADR) · `artifact-review`
(spec rounds, plan reviews, premise gate) · `superpowers:writing-plans` · `superpowers:subagent-driven-development`
(M0) · `superpowers:executing-plans` (spike) · `catchup:catchup` (recap). Their SDD scripts (`sdd-workspace`,
`task-brief`, `review-package`) live under
`~/.claude/plugins/cache/claude-plugins-official/superpowers/7.0.0/skills/subagent-driven-development/scripts/`.
