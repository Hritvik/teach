---
title: Define trustworthy assessment and review behaviour
label: wayfinder:grilling
mode: HITL
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: grilling
Status: resolved
Assignee: codex
Blocked by: 01

## Question

What counts as exposure, evidence, a strong answer, demonstrated mastery and a due review in the
first release? Decide how placement, verified keys, independent grading, hints/confidence, uncertain
answers, disputed grades, misconceptions and stale sources affect the record. Identify which inherited
thresholds and scheduling choices are accepted rules, adjustable defaults or hypotheses needing tests.

## Inherited constraints

Four levels, evidence distinct from exposure, anchored verified keys, independent grading and
Stale/Fading as flags are inherited requirements. Exact strong-correct thresholds, hint/confidence
handling, FSRS mapping and several priority defaults were specified as v1 agent proposals. Resolve
implementation ambiguities and version/configuration choices; do not reopen the existence of assessment,
reviews, goal-free learning or independent grading.

## Dependencies

- [Choose the first useful learning experience](01-choose-the-first-useful-learning-experience.md)

## Contract artifact

[Assessment and review contract](../artifacts/assessment-and-review-contract.md) records the inherited constraints, reviewed refinements and learner-confirmed v1 policies.

## Answer

### Learner decisions — 2026-10-26

The learner answered “yes” to all three recommendations:

1. Solid follows one independent correct answer; Secure requires independent correct answers on two
   different days, subject to the existing no-later-miss rule. Content hints or revealed answers do not
   prove independent understanding; neutral clarification/accessibility help is not a content hint.
2. Ask sure/think/guess during deliberate checks, not ordinary conversation. Confidence may be skipped;
   preserve unknown rather than fabricating confidence or treating omission as a wrong answer.
3. Challenged grades receive independent regrading. Affected progress stays provisional until resolved;
   retain the original answer and grading history.

The linked contract carries these choices forward with inherited anchored keys, independent grading,
exposure/evidence separation and versioned tracker-owned derivations. Correct content and credited
strength remain separate; unknown confidence alone cannot demote mastery, and disputed material cannot
certify readiness while unresolved. Amendments and deterministic projection replay preserve history.

### Technical review and remaining work

Independent review found two issues, corrected in the contract: exposure may establish Exposed (though
not demonstrated mastery above it), and concurrent review submissions must consume a stable scheduled
occurrence once, fenced by its lease/projection generation. A stale reservation cannot advance an
already-consumed or superseded review, and expiry alone does not imply failure.

Exact FSRS outcome mapping, unresolved-confidence scheduling, reservation durations and executable
schemas remain implementation design work under these invariants. They are not newly accepted user
preferences or evidence of tested scheduling behaviour; readiness requires their specification and
validation. Other v1 proposals such as 70/30 balance or chapter cadence remain proposals.
