> **Historical — scope changed 2026-10-26.** [ADR 0002](../../adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# teach — findings the design rests on

**Status:** reviewed — premise gate passed 2026-10-23 (ground-truth: no findings; premise: 1 IMPORTANT, accepted as F13)
**Date:** 2026-10-23 · **For:** `2026-10-23-teach-design.md` (revision 4)
Facts about existing trees and tools that the design cites. No design here. Each item gives the command
that produced it and what that command counts. Paths: URS = `/Users/hritvik.dinkar/IdeaProjects/user-returns-service`,
CW = `~/.claude/plugins/marketplaces/hritvik-skills/codewalk`.

| # | Finding | Command (run from URS unless stated) | What it counts |
|---|---|---|---|
| F1 | URS has **10** codewalk walks with typed sidecars (`.claude/code-reading/*.json`, excluding `_index.json`). The design's "eleven" is wrong. | `ls .claude/code-reading/*.json \| grep -v _index \| wc -l` → `10` | sidecar files, not walks with prose only |
| F2 | Across all 10 sidecars, steps carry exactly the keys `end, error_handling, file, line, n, side_effects, symbol, tier, what`. No step has `purpose` or `tests`. | python: union of `steps[*]` keys over the 10 files | keys present on any step in any sidecar; a key absent from the union is absent everywhere |
| F3 | The ICUD HLD cites six walks: `return-reallocation-service, odr-approval-and-retry-queue-consumer-helper, odr-approval-handler, wfr-audit-service-impl, audit-platform-rest-client, order-delivered-listener-helper`; all six exist as sidecars. | `grep -o 'codewalks \`[^\`]*\`' docs/requirements/icud-qc-leak-fixes-hld.md`; cross-checked against F1's listing | names in the HLD's Evidence row |
| F4 | The URS copy of the ICUD HLD is marked superseded by a Google Doc (2026-10-16). | `head -1 docs/requirements/icud-qc-leak-fixes-hld.md` | first line of the file |
| F5 | `docs/golden-prs.md` exists in URS. Commits for #1801 (`5eee8e96d`, returnless-refund admin-flow revert + delay-loop flag propagation) and #2022 (`525e74625`, enable defensive double-decode of audit verdicts) are on `develop`. | `ls docs/golden-prs.md`; `git log --oneline -1000 \| grep -E '#1801\)\|#2022\)'` | file presence; squash-merge subjects in the last 1000 commits |
| F6 | codewalk's evidence tiers are exactly five: `read`, `read (cross-repo)`, `inferred`, `external`, `user-supplied`. | `grep -n '^TIERS' CW/bin/sidecar.py` → line 49 | the tuple the sidecar validator accepts |
| F7 | codewalk emits `tl probe --axis …` readings, so the `tl probe` pattern the design reuses exists. | `grep -n 'tl probe' CW/skills/codewalk/SKILL.md` → line 77 | an instruction in the skill, not a verified run |
| F8 | `mattpocock-skills:grilling` gives a recommended answer with every question. | `grep -n 'recommended answer' …/mattpocock-skills/1.2.3/skills/productivity/grilling/SKILL.md` → lines 8, 15, 21 | instruction text |
| F9 | The gym tracker is a remote HTTP MCP at `https://gym-tracker-mcp.hritvikdinkar.workers.dev/mcp`, backed by a Cloudflare D1 database exported weekly with `wrangler d1 export`. Its cached tool list has 84 tools including `whoami`, `needs_you`, `staleness`, `amend`, `history`, `query`. | `grep -o '"url": "[^"]*workers.dev[^"]*"' ~/.claude.json`; `grep -n 'd1 export' ~/.local/bin/gym-tracker-backup.sh` → line 12; python over `~/.cache/gym-tracker/tools.json` | config entry; backup script line; cached tool names (a cache, possibly stale) |
| F10 | The gym tracker's source is **not** at `~/IdeaProjects/gym-tracker-skills`, the project path recorded in `~/.claude.json`; the backup script still references `$HOME/IdeaProjects/gym-tracker-skills/app/worker`. | `ls ~/IdeaProjects/gym-tracker-skills` → no such directory | directory presence |
| F11 | The IntelliJ MCP's `xdebug_start_debugger_session` accepts either a run-configuration name or `filePath` + `line` pointing at a runnable location such as a test. | tool schema loaded via ToolSearch in this session | the published schema, not an exercised call |
| F12 | The artifact-review grounding pack for the marketplace repo is at `~/IdeaProjects/meesho-open-m-skills/docs/design-review/grounding.md`. | `ls` over the four candidate paths | file presence |
| F13 | The six ICUD walks are all pinned at `1614631a5d3f`, **21 commits behind** `develop` HEAD; **19 of the 30** files their steps cite changed since (+138/−85), including `OdrApprovalHandler`, `ReturnReallocationService`, `OdrApprovalAndRetryQueueConsumerHelper`, `OrderDeliveredListenerHelper` and the approval consumers. They are stale, not current. | `_index.json` pins; `git rev-list --count 1614631a5d3f..HEAD` → 21; `git diff --stat 1614631a5d3f HEAD -- <union of step files>` | commits since the pin; files cited by any step of the six walks |

## Assumptions & Unverified Claims

| # | Assumption | Status |
|---|---|---|
| U1 | F9's tool list reflects the live gym tracker | It is a local cache (`~/.cache/gym-tracker/tools.json`); the live server may have more or fewer tools |
| U2 | F11's schema behaves as described on a Maven multi-module JUnit 4/5 project | Schema read only; never exercised |
| U3 | `git log --oneline -1000` covers #1801 and #2022 | Both found; a miss would not have proved absence |
