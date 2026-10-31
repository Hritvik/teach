# Continuity and recovery contract

Status: accepted planning contract. The learner confirmed outage handling, daily encrypted backups with at most 30-day retention, approved restore and revocation after acknowledgement on 2026-10-26. Technical safeguards were independently reviewed.
Parent: [Define continuity and recovery promises](../issues/05-define-continuity-and-recovery-promises.md).

## Inherited save and retry behaviour

The tracker is the sole authority for saved learning state. Success identifies committed records and
versions; the tutor does not claim saved progress before acknowledgement. A timeout after submission is
an unknown result, not proof that the write failed. Retry the same semantic operation with the same
request/attempt identity and reconcile its original result. Never manufacture a second attempt merely
to retry a connection. Unauthorised requests are not retried indefinitely; ask the learner to reconnect.

Stale intent/entity changes refuse with current versions. Refresh and explain the conflict; do not
silently replace another session's changes or reuse an approval for different versions. Independent
valid evidence can append concurrently. Bound retry/backoff behaviour in the implementation so an
unavailable tracker does not trap the learner in a conversation that hangs.

## Interruption and continuation

An unclosed session remains resumable; it never fabricates an exit ticket or marks unanswered items
wrong. At the next connection, read acknowledged session state, pending/disputed assessments, due
reviews and the muddiest point if one exists. Summarise the latest committed state and let the learner
resume or begin a fresh session. Other agents can continue from structured records; they are not
promised access to the original provider's entire conversation transcript.

Expired/taken-over review reservations cannot advance an occurrence again. An incomplete or skipped
review does not lower mastery by itself. Cross-client resumption preserves attempt and protocol/rules
provenance rather than pretending one agent personally observed another's conversation.

## Confirmed outage experience

Continue explanations if the learner wants, while clearly saying new learning is not saved. The tutor
may use context still available in the current conversation, but labels it as uncommitted and does not
invent current due/mastery values. This introduces no offline database, background outbox or promise
that a provider will retain the chat.

On reconnection, reconcile uncertain writes first. Then offer to save recoverable unsaved evidence from
the surviving conversation, keeping the actual source/time/help/key provenance. Do not silently grade
reconstructed answers against a different key, or backfill unverifiable claims as certified assessment.
If the conversation is gone, say what cannot be recovered; only acknowledged state is guaranteed by the
service's live record, subject to the backup recovery limits below.

## Confirmed backup and restore policy

Take an encrypted daily recovery backup and retain each copy for at most 30 days from creation,
expiring by age independently of whether later backup jobs succeed (normally up to 30 daily copies).
On 2026-10-26 the learner clarified this as a strict 30-day recovery/access window; physical cleanup of
encrypted storage remnants may lag. Disclose that distinction rather than promise physical erasure at expiry. Target a
recovery point within 24 hours when backup jobs succeed; this is a launch acceptance target, not a
provider feature or unconditional guarantee. Surface backup failure and the age of the latest verified
recovery point. Choose storage, encryption/key recovery and job ownership in the deployment plan.
Do not depend solely on restoring a derived cache or on an untested backup command.

Learning backups contain the authoritative D1 records, history, verification and rules/version material
needed for deterministic projections. A consistent snapshot and manifest pin schema/rules, integrity
metadata and timestamp. Rebuild derived values with the matching rules rather than silently regrade
old evidence under the latest defaults. Export is a portable learner artifact; it is not automatically
a complete server recovery image and excludes credentials.

Restore is a learner-approved maintenance operation, not a tutor write. Restore into an isolated target,
verify integrity and replay, show the recovery point and possible missing newer records, then switch
authority only after approval. Fence old clients/requests with a new recovery generation so delayed
pre-restore operations cannot silently reintroduce discarded state. Take a pre-restore safety snapshot
where safe; an unsafe live database may be unsuitable as a recovery source. The final authority switch
requires a maintenance/write barrier or checked cutover revision covering live writes, deletion-ledger
revision and recovery generation. If any changes after validation, reconcile and retry rather than
switching a stale target live. No newly acknowledged write or deletion may disappear unnoticed during
that interval. Do not promise uninterrupted
availability or a restoration deadline before the deployment runbook is tested.

Credential/grant state is separate from learning recovery. Restoring D1 must not restore old OAuth
keys or revive revoked grants; invalidating grants and reconnecting may be safer than restoring auth
state. Preserve an authoritative security/recovery generation outside the rollback target and refuse
service if it cannot be checked. Choose the exact storage/atomicity design and prove it in tests.

## Confirmed revocation guarantee

Do not acknowledge revocation until an authoritative deny state is committed. Any new request arriving
after that acknowledgement must reject that grant for both reads and writes, including a previously
issued unexpired token. OAuth token validity alone is insufficient. A request already admitted before
the acknowledgement may finish; disclose that limit instead of promising retroactive cancellation.

The current OAuth research candidate uses eventually consistent KV, so default library revocation alone
cannot satisfy this policy. Add an authoritative per-request gate (and matching refresh checks) or choose
a provider/storage route that can prove the same boundary. Its unavailability fails closed. Do not
implement this as a stale allow-cache. This is a confirmed requirement, not a claim that the candidate
already implements it. Verify actual grants: brokered web/mobile or shared desktop/CLI configurations
may share one grant, while separately authorised grants remain usable.

## Deletion, retention and recovery safeguards

Deletion needs trusted learner control distinct from ordinary tutor credentials. Preview what will be
removed, obtain confirmation bound to the target/revision and remove live private content. Retraction
of evidence is not a substitute for deletion. Remove dependent private text and derived artifacts, not
just the visible concept title. Do not describe a retained backup copy as already physically erased.

Encrypted recovery copies expire under the 30-day backup retention, and the learner
is told this limit. Provider-managed retention and logs may differ; verify and disclose the actual
limits before hosting. Do not promise custom retention for a provider-managed recovery feature without
checking its controls. Disable or purge optional stores that would violate the agreed policy.

Before any restore becomes live, reapply subsequent deletion decisions using a minimal deletion ledger
kept outside the rollback target, without retaining deleted content in that ledger. If that ledger is
missing or untrusted, block activation and require a safe reconciliation. A backup restore must not
resurrect intentionally deleted private data. Keep backup encryption keys outside the backups they
protect; define key loss and deletion consequences in the recovery runbook.

## Required release evidence and remaining technical work

- Drop a response after a committed write and prove retry returns the original result once.
- Interrupt sessions and resume from each supported client; never fabricate missing transcript content.
- Fail a backup, surface stale recovery coverage, and restore an actual snapshot rather than only list it.
- Restore across a schema/rules change with consistent effective mastery and scheduled reviews.
- Fence old requests after restore and prove deleted records/revoked credentials do not resurrect.
- Test a revoked grant across request locations and refresh attempts while another grant still works.
- Verify auth-gate failure refuses access; document in-flight request limits.
- Demonstrate live deletion and the expiry/purge limits of every retained private-data copy.

Exact backup storage, encryption, provider retention, request/status lookup, auth consistency and recovery
jobs remain builder-owned implementation design. This contract creates no second active learning store
and authorises no deployment, deletion, restore or credential changes now.
