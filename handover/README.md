> **Historical — scope changed 2026-10-26.** [ADR 0002](../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# teach — handover (start here)

**Handed over:** 2026-10-26, from a Claude Code session in `~/IdeaProjects/user-returns-service`
(session `0f7190d5-60fa-47ea-84a3-c848fbc3921f`, 2026-10-23 → 2026-10-26).
**Learner / owner:** Hritvik Dinkar (hritvik.dinkar@meesho.com). Pronouns not stated — use they/them.

## What this project is

`teach` is a long-term, deep, cross-platform **tutor** for one learner. It models what the learner knows as a
knowledge graph that grows from their own questions (Meesho systems, system design, distributed systems, CS),
teaches against it actively (predict → run → investigate → modify; quizzes with verified answer keys; spaced
review), and keeps progress in **two MCP trackers** so any agent can continue the learning:

- a **Meesho tracker** — local only, on the learner's machine (Meesho knowledge never leaves it), and
- a **General tracker** — hosted like the learner's gym tracker, reachable from claude.ai / phone.

Conversation is the primary mode; books, chapters, a feed and simulators are the structured "finish
something" layer. The Claude Code entry point is the `tutor` skill in a `teach` plugin (the name `/teach`
is taken by `mattpocock-skills:teach`).

## Read in this order

1. **This README** — state in one screen, and the next actions.
2. [`STATE.md`](STATE.md) — every track's status, with commits and evidence.
3. [`OPEN-ITEMS.md`](OPEN-ITEMS.md) — blockers, questions waiting on the learner, deferred findings.
4. [`DECISIONS.md`](DECISIONS.md) — what was decided, by whom, and why (don't re-litigate these).
5. [`LEARNER.md`](LEARNER.md) — how this learner likes to work. Read before your first message to them.
6. [`ENVIRONMENT.md`](ENVIRONMENT.md) — paths, repos, branches, running services, tool quirks.
7. The design itself: [`../GLOSSARY.md`](../GLOSSARY.md) (vocabulary — use it exactly),
   [`../docs/superpowers/specs/2026-10-23-teach-design.md`](../docs/superpowers/specs/2026-10-23-teach-design.md)
   (revision 7), [`../docs/adr/0001-two-trackers-split-by-sphere.md`](../docs/adr/0001-two-trackers-split-by-sphere.md),
   [`../docs/superpowers/specs/2026-10-23-teach-findings.md`](../docs/superpowers/specs/2026-10-23-teach-findings.md).
8. `copies/` — the two execution ledgers and the spike's findings, copied here because their originals live
   in git-ignored or throwaway locations.

[`RESUME-PROMPT.md`](RESUME-PROMPT.md) is a paste-ready first prompt for the next agent.

## State in one screen

| Track | State |
|---|---|
| **Design** | Spec revision 7, adversarially reviewed in 3 rounds (~40 findings dispositioned). The **sync layer (spec §5.1) is provisional** until the spike's findings become a reviewed sync-contract LLD. Glossary and ADR 0001 agreed with the learner term by term. |
| **M0 — codewalk releases** | **Code done and published.** codewalk 0.4.0 → **0.8.1**, 8 commits, fast-forward pushed to `origin/marketplace/hritvik-skills` at `3f626b2c`; 86 tests pass; final whole-branch review clean. **Not yet installed** (cache still holds 0.3.1). Task 6's install and **Task 7 (refresh six ICUD walks in URS) remain.** |
| **Sync spike** | Q1–Q6 answered; Q7 done except a logout/login check; Q8 (remote deploy) not run, awaiting a yes/no. Headline: the architecture works; **`wrangler dev` is not fit as the always-on process** — use `workerd serve` or a supervisor. The spike's LaunchAgent **is still running**. |
| **Next build** | Not started: sync-contract LLD → M1 tracker core → M2 tutor. |

## ⚠️ First thing to protect

**Everything under `meesho-open-m-skills/teach/` is untracked and uncommitted**, sitting in a checkout that is
on an unrelated branch (`feat/grafana-dashboards-tables-links`) with someone else's uncommitted work. One
`git clean` loses the whole design. Ask the learner, then move it onto its own branch (suggested:
`feat/teach-design`, off `origin/marketplace/hritvik-skills`) and commit. Do not commit it onto the grafana branch.

## Next actions, in order

1. **Ask the learner** for the three things they owe (see OPEN-ITEMS §1): install codewalk 0.8.1; log out and in
   (or skip); Q8 yes/no.
2. **Protect `teach/`** (above), with the learner's OK.
3. After install: verify `codewalk:anchor-relocator` resolves `${CLAUDE_PLUGIN_ROOT}/bin/anchors.py` from the
   marketplace cache (not `--plugin-dir`), then run **M0 Task 7** from
   `../docs/superpowers/plans/2026-10-23-m0-codewalk-for-teach.md` — snapshot first; never stash or touch the
   learner's uncommitted `CLAUDE.md` in URS.
4. **Close the spike:** logout check (or mark not run), Q8 per the answer, remove the LaunchAgent and plist,
   write the Q9 summary, copy `SPIKE.md` to `teach/docs/superpowers/specs/2026-10-23-sync-spike-findings.md`.
5. **Write the sync-contract LLD** from the spike findings; run `artifact-review` on it.
6. Then plan **M1** (tracker core) with `superpowers:writing-plans`.
