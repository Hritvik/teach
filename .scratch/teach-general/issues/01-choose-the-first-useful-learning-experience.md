---
title: Choose the first useful learning experience
label: wayfinder:grilling
mode: HITL
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: grilling
Status: resolved
Assignee: codex
Blocked by: none

## Question

Which inherited milestone should count as the first release after removing the Meesho track, and does
General-only access justify changing the timing of remote access? Use the existing sequence as the
baseline: M1 tracker → M2 conversational tutor → M3 instruments → M4 books/reader → M5 everywhere →
M6 adaptive frontier. M2 is already the first conversationally usable milestone; the exact release
boundary and necessary client reach have not been fixed.

Preserve conversation as the primary mode, spontaneous inquiries without mandatory goals, structured
books/feed as established later scope, and one General tracker. Identify the first release's acceptance
evidence using a general example; do not make the topic a timeline driver.

## Inherited baseline

- [Learner decisions](../../../handover/DECISIONS.md): conversation first, inquiry-driven growth,
  shared protocol, selected Worker/D1 stack and the agreed learning model.
- [Original phases](../../../docs/superpowers/specs/2026-10-23-teach-design-r7-historical.md#16-build-milestones)
  and [current phases](../../../docs/superpowers/specs/2026-10-23-teach-design.md#16-build-milestones).
- [Reference audit](../reference-audit.md) distinguishes inherited decisions, proposed defaults and scope changes.

## Comments

### Reference correction — 2026-10-26

The initial interview reopened matters already answered in the reference. Withdraw the question about
mandatory goals: inquiries and learner-owned aims already work without one. Do not offer a
structured-reading-led product as an alternative primary mode. “Reliable consumers” was an agent's
suggested validation example, not a learner decision. Keep this ticket claimed and unresolved until the
actual release-boundary discussion is complete; the audit does not constitute a new learner answer.

## Answer

### Learner decision — 2026-10-26

The learner answered “Yes” to making the General tracker remotely accessible with the first usable
conversational tutor, rather than waiting until books and the reader exist. Books, feed and richer
instruments follow in later phases. This adapts the existing milestone sequence and preserves the
long-term product scope; it does not replace it with a smaller product definition.

The first usable release is therefore M1 + M2, including the remote-service work needed for the
supported agents to continue from one authoritative learner record. M1 develops the single tracker;
M2 supplies the conversational tutor and completes the hosted-service readiness needed for that release.
Remote authentication, supported-client verification, migrations and essential recovery/backup work
cannot all be postponed to the old M5 hosting milestone. Their exact contracts and release checks are
resolved by the remaining tickets.

Carry forward the inherited journey: start from an inquiry or goal, learn actively using anchored
material, record exposure/evidence and derived mastery, and return through a supported agent to
continue with due reviews and retained context. Goals remain optional. No particular validation topic
has been selected; the general fixture and detailed acceptance checks belong in the build plan.

Hosting is a release requirement, not evidence that deployment has occurred or authorisation to deploy
without the separate concrete hosting review. No deployment, remote configuration change or commit
was performed to record this decision.

### Consequences

- M3 instruments and M4 books/reader remain later phases.
- M5 covers distributing the reader and later access/operational refinements, not initial tracker hosting.
- State/write ownership, assessment contract and supported-client/access decisions are now unblocked.
- Current specification milestones and the repository entry point reflect this decision.
