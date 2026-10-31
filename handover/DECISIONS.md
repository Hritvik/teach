> **Historical — scope changed 2026-10-26.** [ADR 0002](../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# Decisions — who decided, and why

Decisions marked **learner** were put to Hritvik and answered; don't re-open them without new evidence.
Decisions marked **agent's call** were made by the previous agent and flagged; the learner can overturn them.

## Product shape

| Decision | By | Why |
|---|---|---|
| Build a separate, deep plugin rather than extend `mattpocock-skills:teach` | learner | "mattpocock usually creates shallow skills… i'm thinking of creating something much deeper with cross platform support and more features". That skill is one-topic-per-folder, no placement, no scheduled review, no verified keys, no cross-agent state. Borrow its lesson/component format. |
| Long-term build; ICUD (user-returns-service audit-gap fixes) is an occasional proof-of-concept target, never the timeline driver | learner | "we're building long term… we won't cater our timeline to icud" |
| Conversation is the primary mode; books/chapters/feed are the structured "satisfaction of finishing" layer | learner | "the freedom that comes with conversing with an agent is what i enjoy… still would like some structured pieces" |
| A knowledge graph that grows from the learner's inquiries across Meesho, system design, CS — pushing the boundary, tracking gaps, separating urgent from growth | learner | Their r2 request, quoted in the spec intro |
| Two trackers split by sphere: Meesho local only, General remote (gym-tracker shape); one or two MCPs | learner | ADR 0001. Employer data must not sit on personal infrastructure |
| Write the tracker once as a Cloudflare Worker on D1; run it locally under `workerd` and remotely on Cloudflare (no storage interface) | learner (agreed with recommendation) | One codebase, identical semantics; gym-tracker scaffold reusable |
| Teaching rules have one source: the tracker's versioned `protocol` resource; the skill loads it | learner | Grading drift between agents would become permanent evidence |
| Concept ids opaque and immutable; merges via `merged_into` redirects | learner | Graph will create duplicates; ids cross the sphere boundary |
| `coach:handoff` owns real production code; teach owns learning; handoff output feeds teach evidence | learner | One dial per artifact; real work is the strongest evidence |
| Plugin `teach`, skill `tutor` (`/tutor`) | agent's call | `/teach` collides with mattpocock's skill |
| Execution: M0 subagent-driven, spike inline | learner (agreed with recommendation) | M0 publishes a depended-on plugin; spike needed the learner physically |
| Stop reviewing the spec after round 3; mark §5.1 provisional; settle the sync layer by spike + LLD | learner | All round-2/3 mechanism findings sat in §5.1, first deployed at M5 |

## Domain model (glossary) — all agreed with the learner one question at a time

- A concrete concept and the abstract one it embodies are **separate concepts** linked by `instantiates` (option a).
- **Sphere** (Meesho | General) is the top partition; rule: Meesho if understanding it needs knowledge of Meesho's systems, code, conventions or data.
- **Aim** owned by a goal or the learner; gap/frontier derived; candidate = concept with no aim; parked = deferred aim.
- When a goal closes, the **learner decides** per aim: keep, lower, or drop.
- **Urgent goal**: the learner marks it; a date sharpens it; reconfirmed after ~3 weeks untouched (option c).
- **Inquiry** (learner asks) vs **Item** (tutor asks); a wrongly phrased inquiry can record a misconception.
- **Levels** Recall / Mechanism / Purpose / Transfer; **mastery** Unknown → Exposed → Shaky → Solid → Secure; **Stale** and **Fading** are flags, never demotions.
- A **session** that touches anything Meesho becomes Meesho and never switches back.
- Links: requires, instantiates, deepens (implies requires), relates. **Anchor**: no anchor, no answer key — for General knowledge too.
- **Book** (planned or compiled) and **Chapter** (read vs mastered marks); a goal may have a book; **Feed** of **Cards**.

## Agent's calls inside the spec (flagged in spec §19; overturnable)

Candidates archived after 60 days; balance 70/30 while any urgent goal exists, else all growth; Secure = two
strong corrects on different days; confidence asked on every answer; strictness default
collaborative-after-attempt; ~25–30 min sessions; priority weights (spec §7.4); FSRS for reviews; higher aim wins
between owners; compiled chapters proposed after every session; "today's set done" marker; Meesho DB backed up
only locally; General tracker rejects unsigned writes from the learner's machine.

## Rulings during execution (from the ledgers)

- M0 behavioural checks ran headless (`claude -p --plugin-dir`) because a subagent cannot open a scratch session.
- Every commit bumps the codewalk version (the repo's pre-commit hook requires it) → 0.5.1 and 0.6.1 exist as fix releases.
- Older codewalk (≤0.3.1) rewriting a sidecar still drops `purpose`/`tests`; unfixable in released versions; the Pass 0 backfill rule recovers them.
- codewalk owns re-location of *sidecar anchors*; `claim-guard` owns *free-form prose citations*.
- Spike: TDD does not govern a throwaway spike; each step's Expected is checked and recorded.

## Corrections made during the session (so they aren't repeated)

- "Existing tools teach not at all" was wrong — `mattpocock-skills:teach` exists (user-invoked only, so it never
  appeared in the skill list). The spec intro was rewritten against it.
- URS has **ten** codewalk walks, not eleven.
- Spike: processes first read as "orphaned `workerd`" were being respawned by the `wrangler` node parent (the
  `pkill` pattern missed it).
- Throughline has no `understanding` axis and `comprehension` is derived (cannot be probed); teach feeds it via a
  new `exam` note kind (spec §15).
