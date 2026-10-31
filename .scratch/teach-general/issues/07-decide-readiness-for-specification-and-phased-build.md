---
title: Decide readiness for specification and phased build
label: wayfinder:grilling
mode: HITL
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: grilling
Status: resolved
Assignee: codex
Blocked by: 02, 03, 04, 05, 06, 08

## Question

Are the selected experience, domain/write contracts, assessment rules, supported clients, recovery
promises and dependency boundaries precise and supported enough to compile a specification and phased
build plan? Audit unresolved assumptions, identify required research or prototypes, define the handoff
artifacts and release evidence, and preserve a usable result at each phase. Close only after the learner
accepts the remaining uncertainty and no implementation-critical decision is left to invent.

Before completing the map, compile the agreed decisions into the specification and phased build plan,
link both artifacts from this ticket, and obtain the learner's review. If that synthesis surfaces a new
decision, create its ticket and keep this ticket open until it is resolved. A readiness declaration alone
does not satisfy the destination; this documentation handoff is planning, not production implementation.

## Dependencies

- [Define learning state and write ownership](02-define-learning-state-and-write-ownership.md)
- [Define trustworthy assessment and review behaviour](03-define-trustworthy-assessment-and-review-behaviour.md)
- [Choose supported clients and the access boundary](04-choose-supported-clients-and-the-access-boundary.md)
- [Define continuity and recovery promises](05-define-continuity-and-recovery-promises.md)
- [Choose the teaching integration and dependency boundary](06-choose-the-teaching-integration-and-dependency-boundary.md)

- [Verify the OAuth provider and client compatibility route](08-verify-oauth-provider-and-client-compatibility-route.md)

## Required synthesis coverage

Carry forward the six resolved learner decisions and completed OAuth research. Before readiness,
include concrete designs for schema/tool operations, projection/rule replay and FSRS mapping; OAuth
provider/identity setup and trusted control confirmation; authoritative revocation and restore fencing;
backup storage/encryption/retention; and the selected shared grader's model/provider, cost/privacy
limits, isolated invocation and retry job protocol. Separate design choices from tests only executable
later. Do not present these still-open technical details as decisions already made by the learner.

M0 codewalk verification is conditional on enabling its instruments; it is not a dependency blocking
the general M1/M2 release. All selected launch clients still require actual supported-path proof.

## Reviewed result

- [First-release specification](../../../docs/superpowers/specs/2026-10-26-teach-general-specification.md).
- [Phased build plan](../../../docs/superpowers/plans/2026-10-26-teach-general-build.md).
- [Readiness review and finding dispositions](../artifacts/readiness-review.md).

Technical contracts are concrete and independently reviewed; material cross-contract findings have
been reconciled. The learner-selected MyFitnessGuide Google OIDC pattern and 30-day recovery-access
interpretation are included. The following final answer records learner approval and the cap; completed
planning remains distinct from implementation or runtime proof.

## Answer

### Learner approval — 2026-10-26

The learner replied “proceed” after being presented the specification, phased build plan and the final
US$5/month grading-budget question, with explicit notice that approval completes planning without
starting deployment or paid calls. Approve the linked artifacts and set the initial cap to 5,000,000
micro-USD per learner-local calendar month, under the model contract's stated inference-only boundary.

The independent technical review and scoped re-review closed the recorded material findings. The
specification and plan now pin schema/tools/rules, shared isolated grading and key verification,
MyFitnessGuide-style Google OIDC with Teach-owned resources, trusted human controls, authoritative
revocation, encryption/expiry and deletion-preserving restore cutover. The accepted 30-day window is
through-Teach recovery/access, with encrypted physical cleanup lag disclosed.

### Handoff

The map has achieved its planning destination: an approved first-release specification and phased
build plan, with no unresolved learner product choice. Actual package pins/API entitlements, setup
identifiers/secrets, provider retention checks, runtime security/quality/coverage tests and supported-
client proofs are explicit execution gates, not evidence that the implementation already works.
If execution disproves a contract or needs a spending/privacy change, return the concrete trade-off to
the learner. Do not reopen settled decisions merely to ask broad product questions again.

Next execution unit: Phase A, the local tracker foundation, using synthetic data and test-first domain
behaviours. This planning approval does not itself begin implementation, commit, push, configure an
external service, deploy or invoke paid grading.
