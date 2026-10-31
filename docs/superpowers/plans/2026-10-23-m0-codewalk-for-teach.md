> **Historical — scope changed 2026-10-26.** [ADR 0002](../../adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# M0 — codewalk releases for teach, and the ICUD walk refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** reviewed — revision 2, after a six-lens plan review (log at the end); awaiting the learner's read.

**Goal:** Give codewalk what teach needs — sidecars that keep fields they do not know, optional per-step `purpose` and `tests`, range-level anchor re-location used by codewalk's own stale path and exposed to other plugins as an agent, and an anchored-claims mode for `claim-verifier` — then refresh the six stale ICUD walks in user-returns-service onto current code with the new fields.

**Architecture:** All code changes are in the `codewalk` plugin (Python 3 stdlib CLIs under `bin/`, markdown agents under `agents/`, the skill's `SKILL.md` and references). Sidecars stay at `schema_version` 1; the new fields are optional, and the validator carries unknown keys at every level instead of dropping them. Re-location is a new stdlib module, `bin/anchors.py`: codewalk's own Pass 0 uses it, and a new read-only agent wraps it so other plugins reuse it by dispatching an agent, never by running codewalk's `bin/`. The verifier judges text the relocator captured at a named ref, never the learner's working tree.

**Tech Stack:** Python 3 (stdlib only, as codewalk's `bin/`), pytest, git CLI, Claude Code agents (markdown + frontmatter).

**Spec:** `teach/docs/superpowers/specs/2026-10-23-teach-design.md` (revision 7) — §9.2, §12, §15, §16 M0, assumptions A2, A14; findings `teach/docs/superpowers/specs/2026-10-23-teach-findings.md` F1–F3, F13.

## Global Constraints

- Work in a git worktree on a feature branch created from `origin/marketplace/hritvik-skills` (the overlay branch the installed `hritvik-skills` marketplace tracks). Do not use the main checkout, which is on an unrelated branch with uncommitted work.
- **Every commit that touches `codewalk/` other than its manifest must bump `version` in both `codewalk/.claude-plugin/plugin.json` and the `codewalk` entry of `.claude-plugin/marketplace.json`** — the `plugin-version-bump.sh` pre-commit hook refuses otherwise. Versions: Task 1 → `0.4.0`, Task 2 → `0.5.0`, Task 3 → `0.6.0`, Task 4 → `0.7.0`, Task 5 → `0.8.0`.
- **Lockstep (grounding pack invariant):** a new `codewalk/agents/<name>.md` and a new `bin/` tool are named in `codewalk/skills/codewalk/SKILL.md` (its agent mentions and Reference index) **in the same commit**.
- An agent reaches its own plugin's files by writing `${CLAUDE_PLUGIN_ROOT}/...` in the agent body (the pattern in `sql-query-analyzer` and every `artifact-review` agent). Never by globbing `~/.claude/plugins/cache` (rejected in `claim-guard`'s SKILL.md: coexisting versions, other marketplaces, version skew).
- Commit messages follow the branch's style: `codewalk <version>: <what changed>`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `--no-verify`.
- `bin/` stays Python 3 stdlib only. Tests: `python3 -m pytest codewalk/tests -q`.
- Evidence tiers stay exactly `read`, `read (cross-repo)`, `inferred`, `external`, `user-supplied` (`bin/sidecar.py:49`). `schema_version` stays `1`; the reader keeps refusing newer versions (`bin/sidecar.py:168-170`).
- Every `file` in a sidecar, a `tests` entry or an anchor is repo-root-relative, never absolute, never containing `..` or the display elision `/.../`.
- **Ownership of re-location (my call, flagged):** codewalk owns re-location of *sidecar anchors* (always repo-root-relative, always with a pin). `claim-guard` owns resolution of *free-form citations in prose* (bare symbols, suffixes). They do not overlap; neither imports the other.
- Never contact `prd.meesho.int`, `int.meesho.int`, `prd.mrouter.int`, `int.mrouter.int`.
- In user-returns-service, never stash, reset or discard any tracked file (`CLAUDE.md` currently has the learner's uncommitted edit). Only `.claude/code-reading/` is touched.

## Review Focus

1. **A sidecar written by codewalk ≤ 0.3.1** (no `purpose`, no `tests`) must still validate and round-trip unchanged. Task 2, `test_v1_sidecar_without_new_fields_still_valid`.
2. **An anchor whose file was renamed or deleted at the ref** comes back `missing`, not an exception. Task 3, `test_relocate_missing_file`.
3. **An anchor whose `end` runs past the file's end at the ref** comes back `changed`, not `IndexError`. Task 3, `test_relocate_range_past_eof`.
4. **A file at the ref that is not valid UTF-8** is read with replacement characters. Task 3, `test_relocate_non_utf8_file`.
5. **A ref that does not exist** exits 1 with a JSON error naming the ref. Task 3, `test_cli_unknown_ref_errors_cleanly`.

## Assumptions & Unverified Claims

| # | Assumption | Status | Where it is checked |
|---|---|---|---|
| P1 | `${CLAUDE_PLUGIN_ROOT}` written in an agent's body is substituted with the plugin's install path when the agent loads | Established pattern in this repo (`sql-query-analyzer`, `artifact-review` agents); verified in the reviewer's own dispatch | Task 4 Step 3 |
| P2 | Every commit under `codewalk/` needs a version bump in both manifests | Read in `pre-commit-scripts/plugin-version-bump.sh` | The hook itself |
| P3 | Commits land directly on `marketplace/hritvik-skills` | Inferred from its `git log` | Task 6 asks before pushing |
| P4 | The reviewer's drift counts (37 unchanged / 11 moved / 19 changed of 67) reproduce with `anchors.py` | Measured by a reviewer with a simpler script | Task 3 Step 6 |
| P5 | Claude Code can load a plugin from a directory for one session (`claude --plugin-dir <path>`) so an unreleased agent can be exercised | Believed supported; unverified on 2.1.309 | Task 4 Step 3; fallback: add the worktree as a local marketplace under a distinct name |
| P6 | Agent behaviour can be checked only by dispatching it on a fixture; there is no agent test harness | Inferred (no agent tests in the repo) | Tasks 4, 5 |

---

### Task 0: Worktree

**Files:** none (git only)

- [ ] **Step 1: Create the worktree**

```bash
cd ~/IdeaProjects/meesho-open-m-skills
git fetch origin marketplace/hritvik-skills
git worktree add ../meesho-open-m-skills-codewalk-m0 -b feat/codewalk-for-teach origin/marketplace/hritvik-skills
cd ../meesho-open-m-skills-codewalk-m0 && pre-commit install
```

- [ ] **Step 2: Baseline** — `python3 -m pytest codewalk/tests -q` passes (note the count); `grep -n '"version"' codewalk/.claude-plugin/plugin.json` → `"0.3.1"`.

---

### Task 1: The validator carries fields it does not know (codewalk 0.4.0)

**Files:**
- Modify: `codewalk/bin/sidecar.py` — new `_carry(raw: dict, out: dict, known: tuple[str, ...]) -> dict`; used in `_validate_step` (86-132), `_validate_unknowable` (135-149), the `pin` branch of `validate` (188-191) and `validate`'s top level (152-201)
- Test: `codewalk/tests/test_sidecar.py`
- Modify: manifests (`0.4.0`)

**Interfaces:**
- Produces: `validate(doc)` returns, at every level it normalises (document, step, pin, unknowable), the keys it validates plus every other key of the input unchanged. `_carry` copies keys of `raw` that are neither in `out` nor in `known` (the step's `known` includes `TIER_ALIASES`, so `confidence` never reappears beside `tier`).

- [ ] **Step 1: Write the failing tests** (use the file's existing `repo` fixture; add a helper `_doc(**step_extra)` returning `{"slug": "s", "steps": [{"n": 1, "what": "w", "side_effects": "none", "error_handling": "none", "file": "a.java", "line": 1, "tier": "read", **step_extra}]}` if none exists)

```python
def test_unknown_step_keys_survive_round_trip(repo):
    sidecar.write(repo, _doc(future_field={"a": 1}, note="kept"))
    step = sidecar.read(repo, "s")["steps"][0]
    assert step["future_field"] == {"a": 1} and step["note"] == "kept"

def test_unknown_top_level_keys_survive_round_trip(repo):
    doc = _doc(); doc["producer"] = {"tool": "teach", "v": 3}
    sidecar.write(repo, doc)
    assert sidecar.read(repo, "s")["producer"] == {"tool": "teach", "v": 3}

def test_unknown_pin_keys_survive_round_trip(repo):
    doc = _doc(); doc["pin"] = {"repo": "r", "ref": "abc", "branch": "develop"}
    sidecar.write(repo, doc)
    assert sidecar.read(repo, "s")["pin"]["branch"] == "develop"

def test_unknown_unknowable_keys_survive_round_trip(repo):
    doc = _doc(); doc["unknowables"] = [{"question": "q", "tier": "external", "asked_on": "2026-10-23"}]
    sidecar.write(repo, doc)
    assert sidecar.read(repo, "s")["unknowables"][0]["asked_on"] == "2026-10-23"

def test_known_fields_still_validated_when_unknown_present():
    with pytest.raises(sidecar.SidecarError, match="`line` must be a positive integer"):
        sidecar.validate(_doc(line=0, future_field=1))

def test_confidence_alias_not_carried_beside_tier():
    step = {k: v for k, v in _doc()["steps"][0].items() if k != "tier"}
    out = sidecar.validate({"slug": "s", "steps": [{**step, "confidence": "read"}]})
    assert "confidence" not in out["steps"][0] and out["steps"][0]["tier"] == "read"
```

- [ ] **Step 2: Run** `python3 -m pytest codewalk/tests/test_sidecar.py -q -k "unknown or alias"` — the four round-trip tests FAIL with `KeyError`.
- [ ] **Step 3: Implement `_carry`** and call it at the four sites. Add one sentence to the module docstring: unknown keys are carried, not judged, so a newer writer's fields survive an older writer's rewrite.
- [ ] **Step 4: Run** `python3 -m pytest codewalk/tests -q` — PASS, baseline + 6.
- [ ] **Step 5: Bump to 0.4.0 and commit** — `codewalk 0.4.0: sidecar validator carries unknown keys at every level`.

---

### Task 2: Optional `purpose` and `tests` per step (codewalk 0.5.0)

**Files:**
- Modify: `codewalk/bin/sidecar.py` — new `_rel_path(value, where) -> str` (the three checks now at 105-110); `_validate_step`; `USAGE`
- Modify: `codewalk/skills/codewalk/references/passes.md` — Pass 3, Pass 5, Pass 7
- Modify: `codewalk/skills/codewalk/SKILL.md` — the Pass 3 / Pass 5 lines and the Pass 8 sentence listing the sidecar's fields
- Test: `codewalk/tests/test_sidecar.py`; manifests (`0.5.0`)

**Interfaces:**
- Produces: a step may carry `purpose: str` (non-empty) and `tests: list[{"file": str, "line": int, "name"?: str}]` (possibly empty, meaning "looked, found none"). Absent `tests` means "this walk predates the field"; `[]` means "no test found". `_rel_path` is the single home of the path rules and validates the step's `file` too.

- [ ] **Step 1: Write the failing tests**

```python
def test_purpose_and_tests_round_trip(repo):
    sidecar.write(repo, _doc(purpose="guards write-once for USABLE verdicts",
                             tests=[{"file": "src/test/ATest.java", "line": 42, "name": "writesOnce"}]))
    step = sidecar.read(repo, "s")["steps"][0]
    assert step["purpose"].startswith("guards")
    assert step["tests"] == [{"file": "src/test/ATest.java", "line": 42, "name": "writesOnce"}]

def test_empty_tests_list_is_kept(repo):
    sidecar.write(repo, _doc(tests=[]))
    assert sidecar.read(repo, "s")["steps"][0]["tests"] == []

def test_empty_purpose_refused():
    with pytest.raises(sidecar.SidecarError, match="`purpose` must be a non-empty string"):
        sidecar.validate(_doc(purpose="  "))

def test_tests_must_be_a_list():
    with pytest.raises(sidecar.SidecarError, match="`tests` must be a list"):
        sidecar.validate(_doc(tests={"file": "a", "line": 1}))

def test_tests_entry_absolute_path_refused():
    with pytest.raises(sidecar.SidecarError, match="repo-root-relative"):
        sidecar.validate(_doc(tests=[{"file": "/abs/T.java", "line": 3}]))

def test_tests_entry_line_must_be_positive():
    with pytest.raises(sidecar.SidecarError, match="`line` must be a positive integer"):
        sidecar.validate(_doc(tests=[{"file": "T.java", "line": 0}]))

def test_v1_sidecar_without_new_fields_still_valid(repo):
    sidecar.write(repo, _doc())
    step = sidecar.read(repo, "s")["steps"][0]
    assert "purpose" not in step and "tests" not in step
```

- [ ] **Step 2: Run** `-k "purpose or tests_ or v1_sidecar or empty_tests"` — the four refusal tests FAIL.
- [ ] **Step 3: Implement** `_rel_path`; validate `purpose` with `_text`; validate `tests` (list; each object with `_rel_path` file, positive int `line` with the step's message, optional non-empty `name`; `where` prefix `steps[i].tests[j]`). Add both to `USAGE`'s example.
- [ ] **Step 4: Update the skill's instructions** — Pass 3: an optional sixth field `purpose` (the invariant, ADR or bug the step guards), recorded only when found, never guessed, same tier rules as `what`. Pass 5: record each step's exercising test(s) in `tests`; `[]` when none found, and say so in the output. Pass 7 step 2 and `SKILL.md` Pass 8: the sidecar carries them; renderings unchanged.
- [ ] **Step 5: Run the suite, bump to 0.5.0, commit** — `codewalk 0.5.0: optional per-step purpose and tests; Pass 3/5 record them`.

---

### Task 3: Range-level re-location, used by codewalk's own stale path (codewalk 0.6.0)

**Files:**
- Create: `codewalk/bin/anchors.py`; Test: `codewalk/tests/test_anchors.py`
- Modify: `codewalk/skills/codewalk/references/passes.md` — Pass 0 `stale` branch
- Modify: `codewalk/skills/codewalk/SKILL.md` — `allowed-tools` adds `Bash(python3 *anchors.py *)`; Reference index adds `bin/anchors.py`; Pass 0 line mentions re-location
- Modify: manifests (`0.6.0`)

**Interfaces:**
- Consumes: `cache.repo_root`, `cache._git`.
- Produces:
  - `default_ref(root) -> str` — target of `refs/remotes/origin/HEAD` (e.g. `origin/develop`), else `"HEAD"`.
  - `capture(root, file, line, end, ref, context=0) -> dict` — `{"text": <the range>, "context": <range ± context lines>, "context_start": int}` at `ref`.
  - `relocate(root, anchor, ref, context=5) -> dict` — `anchor` is `{"file", "line", "end"?}` plus **exactly one** of `"text"` (the old range's text) or `"from_ref"` (a commit, e.g. a sidecar's `pin.ref`, from which the old text is captured). Returns `{"status": "unchanged"|"moved"|"changed"|"missing", "file", "line", "end", "ref", "ref_sha", "old_text", "text", "context", "context_start"}`: `line`/`end` are the position at `ref` (the old position for `changed`/`missing`); `text`/`context` are the bytes at `ref` there (empty for `missing`).
  - `version() -> str` — codewalk's own `plugin.json` version.
  - CLI: `anchors.py relocate <anchors.json|-> [--ref REF] [--context N]` → JSON list in input order; `anchors.py capture <file> <line> [<end>] [--ref REF] [--context N]`; `anchors.py version`. `main(argv, stdin=None)` (the `stdin` string is for tests). Errors: `{"error": ...}` on stderr, exit 1.

- [ ] **Step 1: Write the failing tests** (a `repo` fixture committing `A.java` with lines `l1`…`l20` as `LINES`; helper `commit(repo, path, text)`; `OLD = {"file": "A.java", "line": 5, "end": 7, "text": "l5\nl6\nl7"}`)

```python
def test_relocate_unchanged(repo):
    r = anchors.relocate(repo, OLD, "HEAD")
    assert r["status"] == "unchanged" and r["text"] == "l5\nl6\nl7"

def test_relocate_moved_when_lines_inserted_above(repo):
    commit(repo, "A.java", "n1\nn2\nn3\n" + LINES)
    r = anchors.relocate(repo, OLD, "HEAD")
    assert (r["status"], r["line"], r["end"]) == ("moved", 8, 10)

def test_relocate_changed_when_text_edited(repo):
    commit(repo, "A.java", LINES.replace("l6", "l6 // edited"))
    assert anchors.relocate(repo, OLD, "HEAD")["status"] == "changed"

def test_relocate_from_ref_captures_old_text(repo):
    pin = git_out(repo, "rev-parse", "HEAD")
    commit(repo, "A.java", "n1\n" + LINES)
    r = anchors.relocate(repo, {"file": "A.java", "line": 5, "end": 7, "from_ref": pin}, "HEAD")
    assert (r["status"], r["line"], r["old_text"]) == ("moved", 6, "l5\nl6\nl7")

def test_relocate_requires_exactly_one_of_text_or_from_ref(repo):
    with pytest.raises(ValueError, match="exactly one of `text` or `from_ref`"):
        anchors.relocate(repo, {"file": "A.java", "line": 5}, "HEAD")

def test_relocate_returns_context_window(repo):
    r = anchors.relocate(repo, OLD, "HEAD", context=2)
    assert r["context"].splitlines() == ["l3", "l4", "l5", "l6", "l7", "l8", "l9"] and r["context_start"] == 3

def test_relocate_trailing_whitespace_is_not_a_change(repo):
    commit(repo, "A.java", LINES.replace("l6", "l6   "))
    assert anchors.relocate(repo, OLD, "HEAD")["status"] == "unchanged"

def test_relocate_duplicate_block_picks_nearest(repo):
    commit(repo, "A.java", "x\n" + LINES + "l5\nl6\nl7\n")
    r = anchors.relocate(repo, OLD, "HEAD")
    assert (r["status"], r["line"]) == ("moved", 6)

def test_relocate_missing_file(repo):
    git(repo, "rm", "-q", "A.java"); git(repo, "commit", "-qm", "rm")
    assert anchors.relocate(repo, {"file": "A.java", "line": 1, "text": "l1"}, "HEAD")["status"] == "missing"

def test_relocate_range_past_eof(repo):
    a = {"file": "A.java", "line": 19, "end": 25, "text": "l19\nl20\nx\ny\nz\nq\nw"}
    assert anchors.relocate(repo, a, "HEAD")["status"] == "changed"

def test_relocate_non_utf8_file(repo):
    (repo / "B.bin").write_bytes(b"\xff\xfe line\n"); git(repo, "add", "."); git(repo, "commit", "-qm", "b")
    assert anchors.relocate(repo, {"file": "B.bin", "line": 1, "text": "nope"}, "HEAD")["status"] == "changed"

def test_uncommitted_edit_does_not_count(repo):
    (repo / "A.java").write_text(LINES.replace("l6", "dirty"))
    assert anchors.relocate(repo, OLD, "HEAD")["status"] == "unchanged"

def test_default_ref_falls_back_to_head(repo):
    assert anchors.default_ref(repo) == "HEAD"

def test_cli_unknown_ref_errors_cleanly(repo, capsys):
    rc = anchors.main(["anchors.py", "relocate", "-", "--ref", "no-such-ref"],
                      stdin='[{"file":"A.java","line":1,"text":"l1"}]')
    assert rc == 1 and "no-such-ref" in capsys.readouterr().err
```

- [ ] **Step 2: Run** `python3 -m pytest codewalk/tests/test_anchors.py -q` — FAIL, `ModuleNotFoundError`.
- [ ] **Step 3: Implement `bin/anchors.py`.** Read files at a ref with `git show <ref>:<file>` (bytes, `errors="replace"`); a missing path is `missing`; a ref that fails `git rev-parse --verify <ref>^{commit}` is an error. Compare lines with trailing whitespace stripped:

```
old = old text lines (rstripped); cur = file lines at ref (rstripped)
n = len(old); start = anchor.line - 1
if cur[start:start+n] == old:   unchanged, same position
hits = [i for i in range(len(cur)-n+1) if cur[i:i+n] == old]
if hits: i = min(hits, key=lambda h: (abs(h-start), h))  -> moved to i+1 .. i+n
else:                            changed, old position kept
```

  Docstring: why it exists (line-range hashes treat moved code as changed — 11 of 67 ICUD anchors over 21 commits), and that it compares against a named ref, never the working tree, so a learner's uncommitted edit retires nothing. Also that free-form prose citations are `claim-guard`'s domain, not this module's.
- [ ] **Step 4: Wire codewalk's own stale path.** In `passes.md` Pass 0 `stale` branch, before re-running Passes 3–7: for each step whose file is in `changed`, run `anchors.py relocate` with `from_ref` = the sidecar's `pin.ref` and `--ref HEAD`; `unchanged` → keep the step; `moved` → update `line`/`end` only; `changed`/`missing` → re-run Passes 3–7 for that step. **Backfill rule:** any step lacking `tests` (or `purpose` where the walk's reading would yield one) also gets Pass 3 `purpose` and Pass 5 `tests` re-run, whether or not its file changed. Update `SKILL.md`'s Pass 0 line, `allowed-tools`, and Reference index accordingly.
- [ ] **Step 5: Run the suite** — PASS.
- [ ] **Step 6: Reproduce the measured drift on the real walks** — from `~/IdeaProjects/user-returns-service`, run `anchors.py relocate --ref HEAD` over the 67 steps of the six slugs in findings F3, each with `from_ref: 1614631a5d3f`. Expected at URS `HEAD 3ea7f7376`: 37 `unchanged`, 11 `moved`, 19 `changed`, 0 `missing`. If HEAD has moved, record the counts (sum 67) in the commit message.
- [ ] **Step 7: Bump to 0.6.0 and commit** — `codewalk 0.6.0: anchors.py range re-location; Pass 0 stale path re-pins moved steps and backfills purpose/tests`.

---

### Task 4: The `anchor-relocator` agent (codewalk 0.7.0)

**Files:**
- Create: `codewalk/agents/anchor-relocator.md`
- Modify: `codewalk/.claude-plugin/plugin.json` — add `"./agents/anchor-relocator.md"` to `agents`; `0.7.0`
- Modify: `codewalk/skills/codewalk/SKILL.md` — name `anchor-relocator`, what it is for, and that anchored-claims callers dispatch it first
- Modify: `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: `anchors.py relocate`, `anchors.py version` (Task 3).
- Produces: agent `codewalk:anchor-relocator`. Input (its prompt): `repo` (path), optional `ref` (default `anchors.py`'s `default_ref`), optional `context` (default 5), optional `required_version` (if given and `anchors.py version` is lower, return `{"error": "codewalk <v> is older than required <required_version>"}`; if absent, no check), and `anchors` (list as in Task 3). Output, verbatim and nothing else: `{"codewalk_version", "ref", "ref_sha", "results": [<relocate results>]}` or `{"error": ...}`. It runs only `python3 ${CLAUDE_PLUGIN_ROOT}/bin/anchors.py …` from `repo`, never edits files, never reinterprets a status.

- [ ] **Step 1: Write the agent** — frontmatter `name: anchor-relocator`, a description with its trigger ("re-locate code anchors against a branch before an answer key or lesson relies on them"), `tools: Bash`. The body writes the script path as `${CLAUDE_PLUGIN_ROOT}/bin/anchors.py`.
- [ ] **Step 2: Lockstep** — update `SKILL.md` and `plugin.json` in the same commit.
- [ ] **Step 3: Load this version and check behaviour** — start a scratch session with the worktree's plugin loaded (`claude --plugin-dir <worktree>/codewalk`; if unsupported, add the worktree as a local marketplace under a distinct name and install from it, then `/reload-plugins`). Confirm the agent list shows `codewalk:anchor-relocator`. In a scratch git repo with `A.java` (20 lines) committed, then 3 lines inserted above line 5 and committed, dispatch it with `anchors: [{"file":"A.java","line":5,"end":7,"from_ref":"HEAD~1"}, {"file":"Gone.java","line":1,"text":"x"}]` and `required_version: "0.7.0"`.
  Expected: `codewalk_version: "0.7.0"`; `results[0]` `moved`, `line: 8`, `old_text` and `text` both `l5\nl6\nl7`; `results[1]` `missing`. Dispatch again with `required_version: "9.0.0"` → the error. Exit the scratch session.
- [ ] **Step 4: Commit** — `codewalk 0.7.0: anchor-relocator agent — the cross-plugin interface to range re-location`.

---

### Task 5: `claim-verifier` anchored-claims mode (codewalk 0.8.0)

**Files:**
- Modify: `codewalk/agents/claim-verifier.md`
- Modify: `codewalk/skills/codewalk/SKILL.md` — one line naming the new mode and its caller contract
- Create: `codewalk/tests/fixtures/anchored-claims/{Ledger.java, claims.json}`
- Modify: manifests (`0.8.0`)

**Interfaces:**
- Consumes: `anchor-relocator` results (Task 4).
- Produces: when the input is `{"mode": "anchored-claims", "ref": "<ref>", "ref_sha": "<sha>", "claims": [{"id", "claim", "file", "line", "end"?, "text", "context", "context_start"}]}` — `text`/`context` exactly as `anchor-relocator` returned them — the agent judges **only the supplied bytes** (no file reads needed; its tools stay `Read, Grep, Glob`), checks **every** claim, and returns:

```
mode: anchored-claims
ref: <ref> @ <ref_sha>
verdict: PASS | DOWNGRADE
checked: <N of N>
results:
  - id: <id>
    verdict: supported | wrong-line | unsupported
    correct_line: <file:line within the supplied context, or "none found">   # only when not supported
    why: <what the supplied lines say>                                       # only when not supported
```

  Walk mode (no `mode`) is unchanged, sampling included.

- [ ] **Step 1: Build the fixture** — `Ledger.java` (~25 lines): `save()` writes a field; `log()` only passes it to a logger. `claims.json` holds four claims with `text`/`context` captured from the fixture at `HEAD` by `anchors.py capture --context 5`: c1 supported (the write); c2 wrong-line (cites two lines below the write, whose line is inside the context); c3 argument-vs-write (cites `log()` for "stores the value"); c4 supported.
- [ ] **Step 2: Edit the agent** — a "Two modes" section; today's text becomes "Walk mode"; "Anchored-claims mode" states: judge the supplied text and context only, never the working tree; every claim, no sampling; same three failure shapes; `PASS` only if all `supported`. Update the frontmatter `description` to name both modes. Update `SKILL.md`.
- [ ] **Step 3: Load this version and check behaviour** — as in Task 4 Step 3, load the worktree's codewalk (now 0.8.0) in a scratch session. Dispatch anchored-claims mode with the fixture. Expected: `checked: 4 of 4`; c1, c4 `supported`; c2 `wrong-line` with the correct line; c3 `unsupported`; `verdict: DOWNGRADE`. Then dispatch walk mode (no `mode`) on an existing walk and confirm its output still has `sampled:`.
- [ ] **Step 4: Commit** — `codewalk 0.8.0: claim-verifier anchored-claims mode — every key point, judged at the relocator's ref`.

---

### Task 6: Release and install codewalk 0.8.0

- [ ] **Step 1: Integrate** — superpowers:finishing-a-development-branch. **Ask the learner before pushing** to `marketplace/hritvik-skills` (outward-facing).
- [ ] **Step 2: Install** — the learner runs `/plugin marketplace update hritvik-skills`, `/plugin install codewalk@hritvik-skills`, `/reload-plugins`. Verify `ls ~/.claude/plugins/cache/hritvik-skills/codewalk/` lists `0.8.0` and the agent list includes `codewalk:anchor-relocator`.

---

### Task 7: Refresh the six ICUD walks onto current code

**Files (user-returns-service, git-excluded `.claude/code-reading/`):** `<slug>.md`, `<slug>.json` and `_index.json` entries for `return-reallocation-service`, `odr-approval-and-retry-queue-consumer-helper`, `odr-approval-handler`, `wfr-audit-service-impl`, `audit-platform-rest-client`, `order-delivered-listener-helper`

**Interfaces:**
- Consumes: installed codewalk 0.8.0.
- Produces: six sidecars pinned at URS `develop` HEAD, every step carrying `tests` (possibly `[]`) and `purpose` where found — M2's lesson and item material.

- [ ] **Step 1: Snapshot** — copy the six `.md`, six `.json` and `_index.json` to `.claude/code-reading/.snapshot-1614631a5d3f/` (inside the excluded directory). These are the only copies of the walks the drift measurement (F13) was taken against.
- [ ] **Step 2: Pre-flight** — on `develop`, up to date with origin. A modified tracked file the walks do not cite (today: `CLAUDE.md`) is acceptable and is **never** stashed, reset or discarded. `cache.py status <slug>` reports `stale` for all six.
- [ ] **Step 3: Re-walk each slug** — `/codewalk <slug>`, six times. Each takes the stale path: moved steps are re-pinned, changed steps re-analysed, and the backfill rule (Task 3 Step 4) runs Pass 3 `purpose` and Pass 5 `tests` on every step lacking them. `claim-verifier` runs in walk mode; every downgrade is re-cited or applied before the walk is recorded.
- [ ] **Step 4: Verify**

```bash
python3 - <<'EOF'
import json,subprocess
head=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
idx=json.load(open(".claude/code-reading/_index.json"))
for s in ["return-reallocation-service","odr-approval-and-retry-queue-consumer-helper","odr-approval-handler","wfr-audit-service-impl","audit-platform-rest-client","order-delivered-listener-helper"]:
    d=json.load(open(f".claude/code-reading/{s}.json"))
    st=d["steps"]
    print(s, idx[s]["sha"]==head, len(st), "steps", sum("tests" in x for x in st), "have tests field",
          sum(bool(x.get("tests")) for x in st), "with tests", sum("purpose" in x for x in st), "with purpose")
EOF
```

  Expected: every line `True`, and "have tests field" equals the step count for every walk. Record the six lines and each walk's claim-verifier counts in the execution notes. If a re-walk ends worse than its snapshot (a session died mid-write, or heavy downgrades), restore that slug from the snapshot and re-run it. Nothing in URS is committed.

---

## Adversarial Review

Reviewed 2026-10-23 · lenses: repo-invariant, ground-truth, decomposition, completeness, prior-art, structural · grounding: `docs/design-review/grounding.md`.

| # | Lens | Sev | Finding | Disposition |
|---|------|-----|---------|-------------|
| 1 | prior-art (BLOCKER), ground-truth, repo-invariant | BLOCKER | New agent and `bin/` tool not added to `SKILL.md` in the same commit (lockstep invariant). | **Accepted** — Tasks 3, 4, 5 update `SKILL.md`; Global Constraints state the rule. |
| 2 | prior-art | IMPORTANT | `${CLAUDE_PLUGIN_ROOT}` in the agent body is the repo's pattern; the cache-glob fallback was rejected by `claim-guard`. | **Accepted** — verified `sql-query-analyzer/agents/sql-query-analyzer.md`, `artifact-review/agents/*.md:8`. Probe and glob dropped. |
| 3 | ground-truth, completeness | IMPORTANT | The stale path re-walks only steps in changed files; 15 of 67 steps would never get `purpose`/`tests`. | **Accepted** — backfill rule in Pass 0 (Task 3 Step 4); Task 7 checks every step has the field. |
| 4 | structural, prior-art | IMPORTANT | Re-location only exported to teach; codewalk's own stale path still per-file — not "one algorithm". | **Accepted** — Pass 0 uses `anchors.py` (Task 3 Step 4). |
| 5 | structural | IMPORTANT | `relocate` needs old text no sidecar stores; consumers would have to run `bin/` or read the working tree. | **Accepted** — `from_ref` input; `old_text`/`text`/`context` returned. |
| 6 | structural, completeness | IMPORTANT | Verifier reads the working tree while relocation answers at a ref. | **Accepted** — anchored-claims mode judges only the relocator's supplied bytes at its ref. |
| 7 | decomposition | IMPORTANT | Behavioural checks would hit the cached 0.3.1 agents; defects found only after publishing. | **Accepted** — each check loads that task's version first (Tasks 4, 5 Step 3; P5). |
| 8 | structural, completeness | MINOR | `pin` and `unknowables` still dropped unknown keys. | **Accepted** — `_carry` at all four sites, with tests. |
| 9 | decomposition, completeness | MINOR | `required_version` referenced but not in the agent's input contract. | **Accepted** — optional input with stated behaviour. |
| 10 | completeness | MINOR | Task 7 overwrites the only copies of six walks; pre-flight would trip on the learner's uncommitted `CLAUDE.md`. | **Accepted** — snapshot step; unrelated modified files are never stashed. |
| 11 | prior-art | MINOR | `claim-guard` already owns deterministic citation resolution. | **My call, flagged for the learner** — codewalk owns sidecar-anchor re-location (repo-relative, pinned); `claim-guard` owns free-form prose citations; recorded in Global Constraints. |
