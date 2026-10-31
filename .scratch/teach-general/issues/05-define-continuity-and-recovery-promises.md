---
title: Define continuity and recovery promises
label: wayfinder:grilling
mode: HITL
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: grilling
Status: resolved
Assignee: codex
Blocked by: 02, 04

## Question

What must the learner observe after a lost response, retry, concurrent agent update, interrupted
session, network failure or unavailable tracker? Decide acknowledgement semantics, idempotency,
conflict handling, resumption, export/deletion and backup/restore expectations. Distinguish an unsaved
conversation from acknowledged learning state. Do not reintroduce a second tracker or silent offline
sync as a convenience assumption.

## Inherited constraints

Versioned idempotent writes, recorded provenance/reasons, explicit refusals and shared derived state
are inherited. The local spike reports atomic-batch and retry evidence but remote parity was not run.
Define the single-service recovery contract and evidence still needed; do not restart the storage
architecture discussion or resurrect removed sync machinery.

## Dependencies

- [Define learning state and write ownership](02-define-learning-state-and-write-ownership.md)
- [Choose supported clients and the access boundary](04-choose-supported-clients-and-the-access-boundary.md)

## Release timing constraint

The learner confirmed remote tracker access with the first usable conversational tutor. Define this
contract for M1 + M2 readiness; initial hosting, client access and essential recovery cannot wait for the
books/reader phase. The later M5 phase does not introduce the tracker for the first time.

## OAuth research input

[OAuth compatibility research](../research/oauth-client-compatibility.md) found a concrete candidate
with separate OAuth KV credential/grant state. Define revocation propagation and credential recovery
separately from D1 learning recovery. Independent revocation is per actual grant, not assumed per-device
isolation. Do not promise immediate cutoff from eventually consistent KV or revive revoked access when
restoring a learning backup. The provider/account choice is not yet a learner-approved setup action.

## Contract artifact

[Continuity and recovery contract](../artifacts/continuity-and-recovery-contract.md) records inherited save/retry semantics, reviewed safeguards and the learner-confirmed outage, backup and revocation policies.

## Answer

### Learner decisions — 2026-10-26

The learner answered “Yes” to all three recommendations:

1. Continue conversation during outages with new progress clearly unsaved. On reconnection reconcile
   uncertain saves, then offer to record recoverable work with its actual provenance.
2. Take encrypted daily backups and retain each for at most 30 days. Restore requires learner
   confirmation, exposes the recovery point and potentially missing newer work, and must not resurrect
   deleted data or revoked access.
3. Once revocation is acknowledged, reject new requests from that connection immediately. Requests
   admitted before acknowledgement may finish.

The linked contract carries these choices into the inherited idempotency, amendment and session model.
There is no offline database/outbox, full-transcript continuity guarantee or automatic lossless restore.
Backup recovery-point age is observable; failed jobs cannot silently claim 24-hour coverage.

### Reviewed safeguards and remaining implementation design

Independent review identified two necessary refinements: expire backups by creation age even if later
jobs fail, and fence restore cutover with a live-write/deletion-ledger/recovery-generation barrier so a
concurrent acknowledged deletion or write cannot silently disappear. Both are in the contract.

Default OAuth KV revocation alone is insufficient for the accepted post-acknowledgement guarantee.
Before release, design and test an authoritative fail-closed access gate or an equivalent provider
route, with grants and refresh paths covered. Restore must preserve security/deletion state outside the
rollback target. Exact storage, encryption/key recovery, retention controls, backup jobs and cutover
mechanics are builder-owned work; the readiness/build plan must specify and validate them.

Provider-managed copies/log retention may differ from Teach's backup policy. Verify actual controls and
disclose any incompatible retention before hosting rather than promise unavailable deletion behaviour.
No backup job, deletion, restore, credential operation or deployment was performed by this decision.

### Retention clarification — 2026-10-26

The learner accepted “30-day recovery window”: expired copies cannot be accessed or restored through
Teach, while physical cleanup of encrypted storage remnants may happen later. Disclose that distinction
and provider-managed recovery/log retention; do not describe logical expiry as proven physical erasure.
