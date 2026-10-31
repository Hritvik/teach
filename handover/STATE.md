> **Historical — scope changed 2026-10-26.** [ADR 0002](../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# State — as of 2026-10-26

Everything below was verified against git, the plugin cache and `launchctl` at handover. Re-check before
acting: `git log`, `/bin/ls ~/.claude/plugins/cache/hritvik-skills/codewalk/`, `launchctl print gui/$(id -u)/com.hritvik.teach-spike`.

## 1. Design (all untracked — see README "first thing to protect")

| Artifact | Path (under `~/IdeaProjects/meesho-open-m-skills/teach/`) | Status |
|---|---|---|
| Glossary | `GLOSSARY.md` | Agreed with the learner, term by term. Use its vocabulary exactly; its `_Avoid_` lists matter. |
| ADR 0001 | `docs/adr/0001-two-trackers-split-by-sphere.md` | Accepted, plus a 2026-10-23 amendment (routing rule; id-only stubs; General tracker scans every client). |
| Spec | `docs/superpowers/specs/2026-10-23-teach-design.md` | **Revision 7**, status `reviewed`. Approved by the learner for planning M0 and the spike. §5.1 sync layer **provisional**. Review logs (round 1, R2, R3) are at the end of the file. |
| Findings | `docs/superpowers/specs/2026-10-23-teach-findings.md` | Premise-gated facts F1–F13 the design rests on (e.g. F13: six ICUD walks pinned 21 commits back, 19 of 30 cited files changed). |
| M0 plan | `docs/superpowers/plans/2026-10-23-m0-codewalk-for-teach.md` | Revision 2, reviewed (6 lenses). Tasks 0–5 done, 6 half done (pushed, not installed), 7 not started. |
| Spike plan | `docs/superpowers/plans/2026-10-23-sync-spike.md` | Revision 2, reviewed (3 lenses). See §3. |

Spec revision history: r1 course tool → r2 lifelong graph + shared tracker → r3 two trackers split by sphere →
r4 rewritten in the glossary's vocabulary; books/feed → r5–r7 adversarial-review fixes.

## 2. M0 — codewalk releases (`codewalk` plugin, owned by the learner)

Worktree: `~/IdeaProjects/meesho-open-m-skills-codewalk-m0` on `feat/codewalk-for-teach`
(from `origin/marketplace/hritvik-skills` at `c0f07fb4`). Executed with `superpowers:subagent-driven-development`;
per-task ledger copied to `copies/ledger-m0-codewalk.md` (original in the worktree's git-ignored
`.superpowers/sdd/2026-10-23-m0-codewalk-for-teach/`, alongside every task brief, report and review package).

| Commit | Version | What |
|---|---|---|
| `7317bd47` | 0.4.0 | Sidecar validator carries unknown keys at every level (`_carry`) |
| `0de2b1e1`, `49b4dc83` | 0.5.0, 0.5.1 | Optional per-step `purpose` and `tests`; `_rel_path`; Pass 3/5 and SKILL.md |
| `c8fe206b`, `1e398538` | 0.6.0, 0.6.1 | `bin/anchors.py` range re-location against a named ref; per-anchor errors; Pass 0 stale path re-pins moved steps and backfills `purpose`/`tests` |
| `507148e9` | 0.7.0 | `codewalk:anchor-relocator` agent (`tools: Bash`, uses `${CLAUDE_PLUGIN_ROOT}`) |
| `daaf6b80` | 0.8.0 | `claim-verifier` anchored-claims mode (judges supplied bytes only, every claim, no sampling) |
| `3f626b2c` | 0.8.1 | Final-review fixes: refuse degenerate anchors; Pass 0 `from_ref` fallback; caller version gate in SKILL.md |

- **Pushed** (fast-forward, learner-approved) to `origin/marketplace/hritvik-skills` → `3f626b2c`.
- **Tests:** `python3 -m pytest codewalk/tests -q` → 86 passed.
- **Reviews:** every task reviewed (spec + quality); final whole-branch review on Opus → "ready with fixes", fixed, scoped re-review clean.
- **Measurement reproduced:** `anchors.py` on the six ICUD walks (pin `1614631a5d3f` → URS `3ea7f7376`): 37 unchanged, 11 moved, 19 changed, 0 missing of 67.
- **Not done:** install (learner runs `/plugin marketplace update hritvik-skills`, `/plugin install codewalk@hritvik-skills`, `/reload-plugins`); post-install check that the relocator resolves its script from the cache; **Task 7** (refresh the six ICUD walks).
- The worktree and its SDD workspace can be deleted after Task 7 (the record is in git and in `copies/`).

## 3. Sync spike (`~/IdeaProjects/teach-spike`, own git repo, throwaway)

Executed inline with `superpowers:executing-plans`. Findings: `~/IdeaProjects/teach-spike/SPIKE.md`
(snapshot in `copies/SPIKE-findings-2026-10-26.md`); ledger in `copies/ledger-sync-spike.md`.

| Q | Question | Answer |
|---|---|---|
| Q1 | Local D1 persists? | **Yes**, across graceful stop and `kill -9`; migrations must be applied by `run.sh` (wrangler doesn't) |
| Q2 | Two services joined only by a versioned contract; degradation? | **Yes**; slow/500/garbage/absent `general` all degrade within 2 s; gap: 409 refusal reason is dropped |
| Q3 | Batch-only versioned, idempotent writes? | **Yes** — one D1 batch using `changes()` (mechanism (a)); 20 concurrent writers → 1 winner |
| Q4 | Authenticated localhost MCP? | **Yes** — `@modelcontextprotocol/server` 2.3.1 stateless `createMcpHandler`; token/Host/Origin checks hold; Host passes through |
| Q5 | Claude Code + Codex? | Claude Code **yes** end to end; Codex handshake + auth verified, **tool calls not** (Codex not logged in); cross-client race not run |
| Q6 | Forward-only versions? | **Yes** — guard shipped one release before the first outrunning migration (`spike-v1b`/`spike-v2b`) |
| Q7 | Always-on under launchd? | Crash of the job → 1.9 s restart; **`workerd` child crash not recovered by `wrangler dev`**; watcher hot-reloads before migrations; downgrade → 503, no crash loop; kill mid-200-writes lossless; integrity ok; **3-day soak clean** (no restarts, sleep/wake ok, Homebrew upgraded node underneath). **Pending: logout/login.** |
| Q8 | Remote parity on Cloudflare | **Not run** — needs the learner's yes (synthetic data only) |

Pinned versions: wrangler 4.152.0, workerd 1.20261019.1, `@modelcontextprotocol/server` 2.3.1, zod 4.6.7,
typescript 7.0.2, `@cloudflare/workers-types` 5.20261023.1, node v26.12.1 (now 26.12.1_1).

Running right now: LaunchAgent `com.hritvik.teach-spike` (plist in `~/Library/LaunchAgents/`), serving
`http://127.0.0.1:8787` from the spike repo at tag-line `spike-v2b` + commits on `main`. Token in
`teach-spike/meesho/.dev.vars` (git-ignored; never print it).

## 4. Not started

Sync-contract LLD · M1 tracker core · M2 tutor skill and agents · M3 instruments · M4 books/local reader ·
M5 hosting (gated on Meesho's data-policy answer and the leak test set) · M6 moving boundary. See spec §16.
