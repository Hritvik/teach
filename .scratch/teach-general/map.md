---
title: Find the way to Teach as a lifelong general tutor
label: wayfinder:map
status: complete
tracker: local-markdown
---

## Destination

Reach a decision-complete specification and phased build plan for Teach: a conversation-first personal
tutor with one General tracker that lets agents continue learning from the same durable record.

The map is complete when implementation no longer needs to invent the first-release experience,
learning-state ownership, evidence and grading contracts, client/access model, continuity guarantees,
integration boundary, or validation and release sequence, and the resulting specification and phased
build plan have been linked and reviewed by the learner. The learner confirmed this destination on
2026-10-26 and asked to decide the first-release experience through Wayfinder.

## Notes

- Planning only. This map resolves decisions; it does not authorise production implementation, commits,
  pushes, hosting, deployment, credential changes or external issue creation.
- This is the independent `teach/` repository. Use the local Markdown tracker documented below; do not
  place this map in another portfolio product or silently bind Teach to the portfolio Host.
- Current sources: [README](../../README.md), [glossary](../../GLOSSARY.md),
  [single-tracker decision](../../docs/adr/0002-single-general-tracker.md), and
  [current design](../../docs/superpowers/specs/2026-10-23-teach-design.md).
- Settled input: the learner removed the Meesho track. There is one General tracker and no sphere
  partition, employer knowledge store, inter-tracker sync, stub promotion or always-on local daemon.
  Employer-specific content is outside scope; it is not migrated into the General tracker.
- Carry forward the learning intent: conversation first; inquiries grow the graph; four levels;
  evidence-derived mastery; independent grading against anchored keys; urgent goals and growth; spaced
  review; books, chapters and feed with separate read and mastered marks. The first release boundary is recorded below.
- The learner chose the MyFitnessGuide setup as the implementation baseline: Worker/D1 and its direct
  Google OIDC OAuth pattern, with Teach-owned resources. See [source review](research/myfitnessguide-setup.md).
- The current design retains the learner-selected Worker/D1 direction. Verify technical claims when they become relevant;
  it does not settle authentication, client compatibility, migrations or a production deployment contract.
- Mastery thresholds, confidence interaction and disputes are now confirmed in the assessment decision.
  FSRS outcome mapping, 70/30 balance, candidate expiry, priority weights and automatic chapter proposals
  remain proposals or implementation work. Do not turn those into learner decisions.
- Historical evidence: [revision 7 and reviews](../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md),
  [handover](../../handover/README.md), and [spike findings](../../handover/copies/SPIKE-findings-2026-10-26.md).
  They do not prove current dependencies, installs, running services or remote client compatibility.
- No application source or executable test suite exists in this repository. The historical codewalk
  releases and spike source are not included. The old M0 employer-walk refresh and sync spike closure
  are not prerequisites for this route.
- Use `grilling` and `domain-modeling` for decision discussions. Create research tickets when a selected
  direction needs external facts; use `research` then. Use `prototype` for concrete experience questions.
  A human-in-the-loop ticket cannot be resolved by an agent speaking for the learner.
- Refer to maps and tickets by title. Store decisions in ticket answers and link their gist here;
  update affected current design sections when a decision changes them.

## Tracker operations

- Each child is one numbered Markdown file under `issues/`, with its parent link, Wayfinder type,
  status, assignee and blocking references recorded near the top.
- `Status: open` plus no assignee means unclaimed. The frontier is open, unclaimed tickets whose
  `Blocked by` tickets all have `Status: resolved`; choose the lowest number first.
- Claim before work: set `Status: claimed` and `Assignee: codex`. Human decisions still require the learner.
- Resolve by appending `## Answer`, setting `Status: resolved`, and adding a named link and one-line gist
  to Decisions so far. Add discussion under `## Comments` where needed.
- Blocking uses ticket numbers within this local effort; use title links in human-facing prose.
- Charting claimed or resolved no tickets. The first six product decisions have since been resolved
  with the learner and recorded below. Work through one decision per session,
  except independent research tickets.

## Reference baseline

Read the [reference audit](reference-audit.md) before interviewing. Existing learner decisions remain
accepted unless the General-only scope specifically supersedes them. The initial questions about
mandatory goals and primary learning mode are withdrawn as already answered by the reference.
No topic suggestion has been accepted on the learner's behalf. The release boundary below was explicitly confirmed.

## Readiness artifacts

The [first-release specification](../../docs/superpowers/specs/2026-10-26-teach-general-specification.md)
and [phased build plan](../../docs/superpowers/plans/2026-10-26-teach-general-build.md) are technically
reviewed and learner-approved, including the initial US$5/month inference cap. See
[review findings](artifacts/readiness-review.md). All eight tickets are resolved; this planning map is
complete. Implementation and external-action release gates remain in the approved plan.

## Decisions so far

- [Choose the first useful learning experience](issues/01-choose-the-first-useful-learning-experience.md#answer): release the conversational tutor with the remotely accessible General tracker; books, feed and richer instruments follow.

- [Define learning state and write ownership](issues/02-define-learning-state-and-write-ownership.md#answer): adopt the reviewed state/write contract; concept merges require learner confirmation.

- [Define trustworthy assessment and review behaviour](issues/03-define-trustworthy-assessment-and-review-behaviour.md#answer): confirm independent mastery thresholds, skippable confidence during deliberate checks, and independent regrading with provisional progress.

- [Choose supported clients and the access boundary](issues/04-choose-supported-clients-and-the-access-boundary.md#answer): launch Claude Code, Codex CLI/local desktop and Claude web/mobile with OAuth and independently revocable client access.

- [Verify the OAuth provider and client compatibility route](issues/08-verify-oauth-provider-and-client-compatibility-route.md#answer): document a Cloudflare-native OAuth candidate, added credential state and revocation limits; retain actual-client tests as release gates.

- [Define continuity and recovery promises](issues/05-define-continuity-and-recovery-promises.md#answer): continue with unsaved progress during outages; encrypted daily backups expire within 30 days; approved restore preserves deletions/revocations; new requests are denied after revocation acknowledgement.

- [Choose the teaching integration and dependency boundary](issues/06-choose-the-teaching-integration-and-dependency-boundary.md#answer): use a shared independent grader behind the tracker; optional code and effort integrations do not block general learning.

- [Decide readiness for specification and phased build](issues/07-decide-readiness-for-specification-and-phased-build.md#answer): approve the reviewed specification/build plan and US$5/month inference cap; hand off to Phase A local tracker implementation.

## Not yet specified

None blocking the agreed planning destination. Implementation must prove the documented API,
security, cost, recovery, quality and selected-client behaviour. Later reader/instrument phases retain
their planned scope and may use focused follow-on design work. A newly discovered product trade-off
requires an explicit follow-up decision; it is not permission to silently weaken an accepted contract.

## Out of scope

- Meesho/employer knowledge, employer repositories, a local employer tracker and dual-tracker machinery.
- Re-running historical external repository tasks, changing global agent configuration, or operating the
  old spike service.
- Production code, deployment, publication and data migration execution during this planning effort.
- Multi-learner collaboration, commercial packaging and billing for the initial personal tutor.
- Assuming portfolio Host/Chat/IAM integration, shared authority, or another product's database.
- Exhaustively designing every future teaching instrument or realm before the first useful release.
