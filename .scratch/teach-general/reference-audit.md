# Teach reference audit — 2026-10-26

## Purpose and reading coverage

The learner asked whether the reference had been reviewed after the first Wayfinder interview.
The initial pass read the handover and glossary and selected design sections, but skimmed longer material.
That was insufficient grounding for the interview. This audit corrects the map rather than treating
previously answered product questions as new decisions.

The audit covered the complete Markdown reference: original design sections 1–19, assumptions and all
three review rounds; glossary and ADR; findings; both implementation plans; handover state, decisions,
learner preferences, environment, open items and resume prompt; both execution ledgers and spike findings.
The current single-tracker design and Wayfinder tickets were compared against that baseline.
Two independent read-only agents covered the full original learning design and delivery/review evidence;
the primary agent reviewed the current specification, handover and resulting reconciliation.

The ZIP also contains an opaque nested `.7z`. Inspection found its header encrypted; its contents have
not been read or imported. This coverage claim concerns the supplied Markdown, not that encrypted archive.
External repositories, installed plugin versions and live services have not been verified here.

## Carry forward without another interview

- **Conversation is primary; books/feed provide structure alongside.** This is a learner decision,
  not a new choice between conversational and reader-led products. See
  [decisions, product shape](../../handover/DECISIONS.md#product-shape) and
  [original sessions](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#81-conversation-first).
- **Goals are optional.** Any inquiry can add concepts and evidence, aims can belong to the learner,
  and an entirely tangential session is valid. See original
  [graph growth](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#63-how-the-graph-grows),
  [aims](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#71-aims) and
  [sessions](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#81-conversation-first).
  The earlier interview question asking whether a goal is mandatory is withdrawn.
- **The domain model is already agreed.** Four levels, exposure/evidence distinction, derived mastery,
  concrete/abstract concepts linked by instantiates, learner/goal-owned aims, learner-controlled goal
  closure, gaps/frontier and Stale/Fading flags survive the scope change. See
  [domain decisions](../../handover/DECISIONS.md#domain-model-glossary--all-agreed-with-the-learner-one-question-at-a-time).
- **Assessment has established constraints.** Keys are anchored and verified, grading is independent,
  and unavailable or stale key verification holds an item rather than allowing an unchecked grade.
  See [assessment](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#9-assessment).
- **Worker/D1 and the single served protocol were accepted.** They should not be downgraded to merely
  speculative architecture. See [decisions](../../handover/DECISIONS.md#product-shape).
- **This is a long-term build.** Do not shrink the agreed design around a proof-of-concept deadline.
  The original review explicitly rejected cutting M1's schema just to accelerate the old target.
  See [review history](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#adversarial-review).

## Inherited route and scope delta

The [existing milestones](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#16-build-milestones)
already order tracker → conversational tutor → instruments → books/reader → remote continuity →
adaptive frontier. Preserve this as the baseline, not an unexamined requirement to repeat every old task.
The exact first release boundary is not defined, and the learner asked to decide it through Wayfinder.

[ADR 0002](../../docs/adr/0002-single-general-tracker.md) removes only the employer track and its
supporting machinery. Employer-walk refreshes, two-service contracts, local daemon/launchd work,
outbox/cache/overlay, stub promotion and employer-policy hosting gates do not block this route.
Remote access timing deserves reconsideration: the reason for a locally resident employer service
has disappeared. Do not infer that remote hosting is either mandatory immediately or deferred to M5
without discussing the actual release contract.

The old validation target is employer-specific and no longer applies. “Reliable consumers” is a useful
agent-suggested synthetic example, not a selected learner topic and not a prerequisite for every design decision.

## Defaults versus implementation questions

[Agent calls](../../handover/DECISIONS.md#agents-calls-inside-the-spec-flagged-in-spec-19-overturnable)
include candidate expiry, 70/30 balance, strong-correct timing, confidence prompts, help strictness,
priority weights, FSRS, higher aim between owners, chapter proposal cadence and the daily finish marker.
They are specified v1 proposals, not absent design. Resolve only their consequential ambiguities or
configuration needs when planning implementation.

The original [builder-owned details](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#19-decided-my-calls-and-left-to-the-builder)
include schema beyond listed fields, exact tool signatures, query views, prompts, verification and
compilation queues, FSRS mappings, fixtures and reader presentation. Agents should work these out from
the accepted model, bringing the learner meaningful trade-offs rather than asking them to design tables.

## Evidence we can reuse, with limits

- [Codewalk ledger](../../handover/copies/ledger-m0-codewalk.md): work reported through 0.8.1,
  86 passing tests and final review; installation pending. Source is not included here.
- [Spike findings](../../handover/copies/SPIKE-findings-2026-10-26.md): local D1 versioned/idempotent
  batches, concurrency and crash/retry experiments; remote parity remains unverified.
- Claude Code calls worked in the recorded spike; Codex handshake/auth worked but tool calls and the
  cross-client race were not verified. This does not settle current remote client compatibility.
- Applicable lessons remain: migrate before serving, cache data rather than Response objects, guard
  against newer schema, preserve refusal reasons and fail loudly on missing secrets.
- Historical dependency versions and machine state require fresh verification when used.

## Map correction

The claimed first ticket now asks how to adapt the existing milestones and release/access timing.
Subsequent tickets carry explicit inherited constraints and focus on contract gaps. No ticket has been
resolved, no unanswered preference has been invented, and the learner's old decisions remain in force
except where explicitly superseded by the General-only instruction.
