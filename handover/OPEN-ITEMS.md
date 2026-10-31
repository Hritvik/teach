> **Historical — scope changed 2026-10-26.** [ADR 0002](../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# Open items — as of 2026-10-26

## 1. Waiting on the learner (ask these first)

| # | Ask | Unblocks | Default if no answer |
|---|---|---|---|
| L1 | Run `/plugin marketplace update hritvik-skills`, `/plugin install codewalk@hritvik-skills`, `/reload-plugins` | M0 Task 7 | Task 7 waits |
| L2 | Log out of macOS and back in, then say so (or "skip") | Spike Q7 last check | Mark "not run" |
| L3 | Spike Q8: deploy the `general` Worker with **synthetic data only** to their Cloudflare account to compare remote D1 behaviour — yes / no | Spike Q8 | Not run |
| L4 | Optional: `! codex login`, to verify Codex tool calls against the spike | Spike Q5 gap | Leave "handshake verified, tool calls pending" |
| L5 | OK to move `teach/` onto its own branch and commit it (see README) | Protects the whole design | Ask again — do not leave it uncommitted |
| L6 | Earlier they wrote: *"quiz me to gauge my mastery level of various chapters of a book."* It was taken as a design feature (chapter quizzes) and only the naming part was answered. Confirm whether they wanted to be quizzed now. | — | Ask once |

## 2. Blocked on a third party (later)

- **M5 hosting gate** (spec §14.1 rule 8): Meesho's data-policy owner must answer whether structured learning
  records from work sessions, and a Meesho-marketplace plugin's backend, may live on personally run Cloudflare.
  Find the owner via UCL — UCL failed to connect for the whole of this session (DNS for `ucl.prd.meesho.int`),
  probably VPN.

## 3. Next work (unblocked)

1. Post-install check: dispatch `codewalk:anchor-relocator` normally (not `--plugin-dir`) and confirm
   `codewalk_version: "0.8.1"` and a successful relocation — this is where `${CLAUDE_PLUGIN_ROOT}` from the
   marketplace cache gets verified. Also watch for a permission prompt on its heredoc.
2. **M0 Task 7** — follow the plan exactly: snapshot the six walks to `.claude/code-reading/.snapshot-1614631a5d3f/`
   first; pre-flight must not stash/reset the learner's modified `CLAUDE.md`; re-walk each slug with `/codewalk`;
   verify every step has a `tests` field and `_index.json` sha == HEAD.
3. Close the spike: remove the LaunchAgent (`launchctl bootout gui/$(id -u)/com.hritvik.teach-spike`;
   `rm ~/Library/LaunchAgents/com.hritvik.teach-spike.plist`), write the Q9 summary and Task 9 write-up, copy
   `SPIKE.md` into `teach/docs/superpowers/specs/2026-10-23-sync-spike-findings.md`.
4. **Sync-contract LLD**, from spike findings. Must settle: runner (`workerd serve` vs supervisor around
   `wrangler`), no file watcher, stop→migrate→start upgrades, runtime pinning (Homebrew changed node mid-soak),
   cache data-only (never `Response`), surfacing 409 refusal reasons, `.dev.vars`/token placement and
   fail-loud on empty token, installer scope (Claude `-s local`; Codex is global). Mark which §5.1 bullets are
   confirmed / changed / open. Review it with `artifact-review`.
5. Plan M1 with `superpowers:writing-plans`; review the plan; execute.
6. Clean up: the M0 worktree (`git worktree remove ../meesho-open-m-skills-codewalk-m0`) and its SDD workspace
   after Task 7.

## 4. Deferred minor findings (from reviews; none blocking)

From the M0 ledger (`copies/ledger-m0-codewalk.md` has them all, verbatim):
- Pass 0 does not re-locate `tests[]` anchors — consumers must relocate test anchors themselves.
- `anchors.py`: a ref beginning with `-` reaches `git rev-parse` as an argument (safe today; add `--end-of-options`);
  per-anchor except list omits `OSError`/`CalledProcessError`; one subprocess per anchor (~200 for 67 anchors);
  nearest-duplicate tie-break can mis-pin an identical neighbour block.
- `anchor-relocator`: heredoc stdin may prompt in default permission mode; wording beside `cd <repo> &&`.
- `claim-verifier` fixture: a comment in `Ledger.java` hands the verifier claim c3's answer; no multi-line (`end`)
  claim; no pytest consumer. "Never the working tree" rests on the prompt (Read/Grep stay available).
- Sidecar validator: `null` treated as absent for `purpose`/`tests`; missing negative tests for `tests` entries;
  `*_KNOWN` constants placement.

From the spike: 409 refusal reason dropped by `callGeneral`; Codex tool calls and the cross-client race untested.

## 5. Not filed anywhere

No `tl` (throughline) items were created for this effort. The learner's practice is to file skill friction into
`skill-corpus` (prefix SC) — candidates: the deferred codewalk minors above, and "artifact-review grounding pack
for meesho-open-m-skills is mostly TODO" (every lens ran generic checks because of it). **Offer to file; do not
file unasked.**
