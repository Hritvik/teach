---
title: Choose the teaching integration and dependency boundary
label: wayfinder:grilling
mode: HITL
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: grilling
Status: resolved
Assignee: codex
Blocked by: 01, 03

## Question

Which optional instruments or plugins are essential to the first learning experience, and what must
still work without codewalk, an IDE, throughline, a specific model or any installed plugin? Define the
served protocol versus client-specific responsibilities, minimum capability checks, failure/fallback
behaviour and acceptable public or synthetic examples. Decide whether missing external source repos
actually block the chosen slice rather than importing historical M0 tasks as requirements.

## Inherited constraints

The served protocol is the single source of teaching rules; client skills supply instruments and
specialist agents. Codewalk owns anchor relocation and anchored-claims verification. Throughline is
silent when unbound, and coach owns changes to real product code. Preserve these boundaries. Check the
historical released capabilities and choose general fixtures; missing external sources are technical
verification work, not permission to replace the settled learning model.

## Dependencies

- [Choose the first useful learning experience](01-choose-the-first-useful-learning-experience.md)
- [Define trustworthy assessment and review behaviour](03-define-trustworthy-assessment-and-review-behaviour.md)

## Contract artifact

[Integration and dependency contract](../artifacts/integration-and-dependency-contract.md) records the inherited boundaries and confirmed shared free-text grading route.

## Answer

### Learner decision — 2026-10-26

The learner answered “Yes” to a shared independent grading service behind the tracker for free-text
answers across all selected launch clients. It receives the versioned item, verified key/rubric, answer
and essential question context; no unrelated learner history or tracker write credentials. The tracker
validates the constrained result and records it through the accepted attempt/write contracts.

This replaces the assumption that every client must launch its own grading agent. Exact-key items
retain deterministic evaluation. If the shared grader is unavailable, free-text answers remain pending,
not incorrect; conversation and verified exact-key checks can continue. That degraded behaviour does
not permit shipping a launch client without a functioning normal free-text grading path.

### Integration boundary

The served protocol and tracker remain core dependencies. Codewalk owns its code-anchor algorithms,
but codewalk, IDE/debugger/mutation tools, Throughline and richer instruments do not gate general
conversational learning. Check optional capabilities before enabling their operations; hold affected
items when verification cannot run. Preserve Coach's real-product-code ownership and no preference mirror.

Independent review found no material conflict in the proposed authority/isolation boundary. Model
provider, actual credentials, privacy/cost limits, invocation schema, retry jobs, isolation enforcement
and deployment remain explicit implementation decisions and evidence gates, not verified capabilities.
Approval of the design does not authorise paid model calls, account/configuration changes or deployment.
The shared grading boundary does not introduce another authoritative learner store or require another
independent deployment; exact placement belongs in the technical plan.

### Consequences

Update M2 to require the shared grading path and each client's end-to-end assessment proof. Treat M0's
codewalk check as a prerequisite only for codewalk-dependent instruments, not as a gate before M1/M2.
Final readiness must incorporate model/provider and cost design plus the already-tracked authentication,
revocation, recovery, schema and scheduling details before calling the build plan decision-complete.
