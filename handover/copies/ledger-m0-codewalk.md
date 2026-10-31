> **Historical — scope changed 2026-10-26.** [ADR 0002](../../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# SDD ledger — plan: /Users/hritvik.dinkar/IdeaProjects/meesho-open-m-skills/teach/docs/superpowers/plans/2026-10-23-m0-codewalk-for-teach.md

Worktree: /Users/hritvik.dinkar/IdeaProjects/meesho-open-m-skills-codewalk-m0 (branch feat/codewalk-for-teach from origin/marketplace/hritvik-skills c0f07fb4)
Spec: teach/docs/superpowers/specs/2026-10-23-teach-design.md r7 (reachable, in main checkout, untracked)
Task 0: complete (worktree created, pre-commit installed, baseline 51 passed, codewalk 0.3.1)

## Pre-flight scan
| Pair / task | Produces → consumes | Found |
|---|---|---|
| T1 ↔ T2 (sidecar.py) | T1 `_carry` skips keys already in `out`; T2 validates `purpose`/`tests` into `out` | consistent: validated keys win, carry never duplicates them |
| T2 ↔ T3 (passes.md, SKILL.md) | T2 edits Pass 3/5/7 + Pass 8 line; T3 edits Pass 0, allowed-tools, Reference index | disjoint sections; consistent |
| T3 ↔ T4 (anchors.py CLI → agent) | `relocate` input/outputs incl. `old_text,text,context,context_start`; default context 5 both | consistent |
| T4 ↔ T5 (relocator results → claims input) | `text`, `context`, `context_start`, `ref`, `ref_sha` | consistent |
| T5 ↔ T3 (fixture built with `anchors.py capture --context 5`) | capture returns dict incl. context | consistent |
| T1 self | 6 tests ↔ "baseline + 6" | consistent |
| T2 self | refusal tests fail before impl; round-trip pass via T1 carry | consistent |
| T3 self | test fixtures checked by hand: moved 8–10; duplicate→6; context 3..9; from_ref→6 | consistent |
| T4/T5 behavioural checks | need a Claude Code session with the unreleased plugin loaded | see Ruling 1 |
| T6 | push to marketplace/hritvik-skills + install | outward-facing: STOP and ask learner |
| T7 | needs installed 0.8.0 (after T6) | runs only after T6 |

Ruling: T4/T5 behavioural checks run headless as `claude -p --plugin-dir <worktree>/codewalk "<dispatch instruction>"` from inside the implementer's task, printing the agent's output verbatim — the plan's "scratch session" is otherwise not reachable by a subagent — cost if wrong: the check falls back to the learner running one interactive session; no code changes.
Ruling: version bump per task lands in both `codewalk/.claude-plugin/plugin.json` and the `codewalk` entry of `.claude-plugin/marketplace.json` in the task's own commit, as the hook requires — cost if wrong: commit refused by hook, implementer re-commits.
Task 1: minor (deferred): *_KNOWN constants sit between functions instead of with module constants (sidecar.py ~114-117)
Task 1: minor (deferred): pin carry inside dict comprehension is dense (sidecar.py ~183-184)
Task 1: minor (deferred): no test that a known optional key set to None is dropped, not carried
Task 1: complete (commits c0f07fb4..7317bd47, review clean; ⚠️ items verified by controller: trailer present, SCHEMA_VERSION untouched, suite 57 passed)
Task 2: fix round 1/5 dispatched (Important: SKILL.md Pass 3/5 lines not updated; version → 0.5.1 per hook)
Task 2: fix round 1/5 (1 addressed, 0 open — SKILL.md Pass 3/5 lines; commits 0de2b1e1..49b4dc83)
Task 2: minor (deferred): `tests: null`/`purpose: null` treated as absent rather than refused
Task 2: minor (deferred): no tests for tests-entry `..`/`/.../` paths, non-dict entry, missing file, name validation, carried keys in entries
Task 2: minor (deferred): TEST_KNOWN defined after _validate_tests; SKILL.md Pass 8 uneven wrap
Task 2: complete (commits 7317bd47..49b4dc83, review clean after 1 fix round; suite 64 passed)
Ruling: Task 2's fix landed as 0.5.1 (hook requires a bump per commit); Task 3 still targets 0.6.0 — cost if wrong: none, versions only need to move forward.
Task 3: fix round 1/5 dispatched (Important: per-anchor errors instead of whole-batch failure; Pass 0 prose on dirty edits; version → 0.6.1)
Task 3: minor (deferred): empty `text` matches any blank line (reject empty text)
Task 3: minor (deferred): _resolve and git show run per anchor (~200 subprocesses for 67 anchors) — cache per (sha,file)
Task 3: minor (deferred): `line` past EOF with short text can return unchanged/empty window silently; `end < line` not validated
Task 3: minor (deferred): implementer concern — nearest-duplicate tie-break could mis-pin an identical neighbouring block
Task 3: fix round 1/5 (2 addressed, 0 open — per-anchor batch errors; Pass 0 dirty-edit prose; commits c8fe206b..1e398538)
Task 3: minor (deferred): relocate's per-anchor except list omits OSError/CalledProcessError, so a git failure would still fail the whole batch
Task 3: complete (commits 49b4dc83..1e398538, review clean after 1 fix round; suite 79 passed; Step 6 reproduced 37/11/19/0 of 67)
Ruling: Task 3's fix landed as 0.6.1; Task 4 targets 0.7.0 — cost if wrong: none.
Task 4: minor (deferred): ref/ref_sha null when every anchor errors or list empty — undocumented in SKILL.md
Task 4: minor (deferred): heredoc stdin may trigger a permission prompt in default mode; consider a temp-file or --anchors arg
Task 4: minor (deferred): "run nothing but python3 anchors.py" sits beside `cd <repo> &&` (wording)
Task 4: complete (commits 1e398538..507148e9, review clean; behavioural check headless via --plugin-dir per Ruling 1, codewalk_version 0.7.0)
Task 5: minor (deferred): fixture comment in Ledger.java (~26) hands the verifier c3's answer — argument-vs-write not truly tested
Task 5: minor (deferred): no claim with `end` (multi-line range untested); fixture has no pytest consumer
Task 5: minor (deferred): "never the working tree" rests on the prompt; Read/Grep remain available (required tools constraint)
Task 5: complete (commits 507148e9..daaf6b80, review clean; anchored-claims 4/4 as expected; walk mode unchanged)
Final review (opus): ready with fixes — Important 1 degenerate anchors reported moved; Important 2 Pass 0 from_ref fallback when pin absent; must-fix SKILL.md version gate + null ref doc; Review Focus #4 partially covered
Final: minor (deferred): tests[] anchors never re-located by Pass 0 (consumers must relocate test anchors themselves)
Final: minor (deferred): ref beginning with "-" reaches git rev-parse as an argument (safe today; add --end-of-options)
Final: minor (deferred): Ledger.java fixture comment hands c3's answer — fix before relying on the fixture as evidence
Final: Ruling: older codewalk (≤0.3.1) rewriting a sidecar still drops purpose/tests; not fixable in released versions; the Pass 0 backfill rule recovers them on the next stale run — cost if wrong: a stale run on an old cache loses the fields until the next new-version run
Final: Ruling: whether ${CLAUDE_PLUGIN_ROOT} resolves for anchor-relocator from the marketplace cache (not --plugin-dir) is checked in Task 6 after install — cost if wrong: relocator fails loudly until fixed
Final fix wave dispatched (0.8.1)
Final: re-review clean (4/4 addressed, no new breakage); suite 86 passed; commits c0f07fb4..3f626b2c
Task 6: pushed c0f07fb4..3f626b2c to origin/marketplace/hritvik-skills (fast-forward, approved by learner); install pending
