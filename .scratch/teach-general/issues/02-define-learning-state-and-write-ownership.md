---
title: Define learning state and write ownership
label: wayfinder:grilling
mode: HITL
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: grilling
Status: resolved
Assignee: codex
Blocked by: 01

## Question

For the selected first experience, which facts are authoritative records, which values are derived,
and which operations may a tutor, specialist agent or reader perform? Define session and agent
provenance, concept identity/merges, goal-owned aims, revisions/retractions and the invariants that keep
concurrent agents from creating competing learner histories. Keep one General tracker; no sphere model.

## Inherited constraints

The tracker owns authoritative records and all derivations; append-only versioned evidence, immutable
opaque concept ids/merge redirects, learner- or goal-owned aims and a single served protocol are already
specified. Specialist teaching agents do not write tracker state directly. Refine operation contracts,
conflict handling and correction semantics within those boundaries. Do not ask again which system owns mastery.

## Dependencies

- [Choose the first useful learning experience](01-choose-the-first-useful-learning-experience.md)

## Contract artifact

[State and write contract](../artifacts/state-and-write-contract.md) records the inherited requirements, reviewed planning semantics and confirmed merge policy.

## Answer

### Learner decision — 2026-10-26

The learner replied “proceed” to the recommendation that merging existing concepts requires their
confirmation. Teach may automatically record ordinary inquiries and evidence, reuse existing concepts
and propose merges, but cannot combine two existing concept records without confirmation.

### Reviewed contract

Adopt the linked contract for planning: one authoritative tracker and its derivations; tutor-owned
orchestration with specialist agents returning proposals/grades; immutable evidence and provenance;
version-checked entity edits and correction chains; atomic compound operations; stable request and
assessment-attempt identities; redirects preserving original evidence and separately owned aims.
Only the merge policy was newly put to the learner. These technical details refine inherited constraints;
they are not presented as separately elicited learner preferences.

Independent review identified two gaps, both addressed: an attempt must count once even under different
request ids, and concurrent amendments must compare the effective revision to avoid competing corrections.
A merge confirmation must name the proposed records, survivor and versions so later changes cannot reuse
unrelated approval. Exact tool schemas, SQL, key retention and approval enforcement remain implementation
work within these constraints. Assessment rules and access/recovery promises retain their own tickets.

### Consequences

The current design links this contract as the state/write planning baseline. The tracker cannot silently
overwrite newer intent, double-count an assessment attempt, or discard evidence/aim ownership in a merge.
The continuity ticket still waits on the supported-client/access decision; no new product direction,
validation topic, runtime compatibility claim or deployment approval is implied.
