# State and write contract

Status: accepted planning contract. Merge confirmation was approved by the learner; detailed write semantics were derived from the inherited requirements and independently reviewed. Exact implementation schemas remain to be designed.
Parent: [Define learning state and write ownership](../issues/02-define-learning-state-and-write-ownership.md).

## Inherited ownership

The General tracker is the authority for the learner record. It owns computation of mastery, review
dates, calibration, gaps, frontier, priority and readiness. Agents submit observations and explanations;
they cannot set mastery or duplicate these derivations as another source of truth.

The tracker serves the versioned teaching protocol. The tutor orchestrates writes. Concept-mapper and
item-writer return proposals; their tool allowlists exclude writes. Answer-grader sees the supplied item,
verified key and answer, and returns a grade without tracker access. Exact-key answers may be graded
by the tracker. Authentication and capability enforcement details belong to the access ticket.

The tutor records normal inquiries, exposure and evidence as part of teaching, without requiring
per-record confirmation. Existing learner controls remain: accept/edit aims, override the next lesson,
decide each aim when closing a goal, and accept/edit/decline proposed compiled chapters.

## Record classes

| Class | Authoritative facts | Tracker-derived values |
|---|---|---|
| Graph | Concept identity/display fields, anchors, links, merge redirects | Neighbours and prerequisite reachability |
| Intent | Learner- or goal-owned aims, goal state/urgency, parked state, balance | Gaps, effective aims, frontier, priority, readiness |
| Learning | Inquiries, evidence, exposure, misconceptions, source/key verification and grade provenance | Mastery, review schedule, calibration, Stale/Fading |
| Session | Session identity, participating agent provenance, associated goals, exit ticket and muddiest point | Orientation summaries |
| Materials | Items/keys and their versions; later books, chapters and cards; read records | Chapter mastered status and feed ordering |
| History | Reasons, versions, amendments, retractions and actor attribution | Current effective projections and audit views |

Goal-free sessions are valid. Sharing a learner does not make two simultaneous sessions one session.
A continued session keeps its identity when explicitly resumed by another agent; otherwise a new
session uses the same learner record. Client coverage and recovery guarantees remain separate decisions.

## Write envelope and outcome

Every write carries a stable request id, operation, reason, session id where applicable, compatible
protocol/rules version, and validated operation data. The server obtains the authorised learner and
writer identity from the authenticated context, rather than trusting a caller-supplied learner field.
Record the orchestrating writer and any specialist grade provenance separately; client identity labels
are reported provenance, not proof of a particular model or human action.

- An append adds a new immutable evidence/exposure/history record. Do not reject independent evidence
  from another session merely because the graph changed meanwhile; validate referenced identities and
  assessment versions before accepting it.
- Each assessed answer has a stable attempt id bound to the learner, session, item and verified key
  version. One attempt contributes evidence and advances scheduling once, even if submitted with
  different request ids. A retry reuses the attempt identity; a genuinely new answer creates a new
  attempt. Reservation/presentation coordination between agents is specified in the assessment contract.
- A mutable entity edit includes its expected version. A stale edit refuses with current version and a
  useful conflict reason; it never silently overwrites newer intent, item keys or concept metadata.
- A compound operation validates and commits all required record changes atomically, or applies none.
- The same request id and same semantic operation replay the original result without another learning
  event. Reusing a key for different content refuses. Stable identity survives a retry after an uncertain
  response; the implementation must define canonical comparison and retention in its schema plan.
- The success result identifies committed records and versions, and the rules/projection revision used
  by returned derived values. No client reports “saved” before acknowledgement.
- A failure explains whether the request was invalid, incompatible, unauthorised or conflicted. Its
  retryability and recovery presentation are specified by the continuity ticket.

These are planning contract semantics; exact JSON schemas, SQL batches and tool signatures follow in
the implementation design. The contract does not claim current remote D1 behaviour has been tested.

## Corrections and concept identity

Evidence is never edited in place to conceal a mistake. An amendment or retraction references the
original record and a reason, plus the expected effective revision of its correction chain. Only one
concurrent correction may advance that revision; stale corrections refuse with the current revision.
Effective projections reflect the accepted correction while history retains the original. Deletion of personal data is a separate operation and is not constrained to retain private
text forever; its backup/retention semantics belong to the recovery ticket.

Concept ids are immutable and opaque. Merging creates a redirect to a surviving concept; reads and
writes resolve it to the canonical identity, while evidence retains its original provenance. Reject
redirect cycles and invalid merges. Preserve all evidence and separately owned aims; do not silently
drop or lower an aim because concepts merge. Reject merges that introduce prerequisite cycles
or otherwise violate graph constraints and describe the required resolution. Detailed link and aim
coalescing semantics must be explicit in the schema/merge transaction design.

## Confirmed merge policy

The learner confirmed the recommendation on 2026-10-26: the tutor may search for and reuse an existing
concept, and propose duplicate merges, but merging two existing concept records requires learner
confirmation. Ordinary daily capture remains automatic. The merge operation must refer to the approved
pair, survivor and their expected versions; a changed proposal requires fresh confirmation rather than
silently applying the old approval to different records. Exact confirmation transport/enforcement is
part of the access and implementation contracts.

## Review checks for the eventual implementation

- Concurrent evidence appends survive; stale intent edits cannot overwrite newer decisions.
- A lost response followed by a retry creates exactly one record; changed payload reuse is rejected.
- A single attempt cannot count twice under different request ids or advance scheduling twice.
- Concurrent corrections cannot create conflicting effective evidence.
- A correction changes effective mastery/scheduling consistently while preserving audit provenance.
- Failed compound writes leave no partial goal closure, concept merge or graded-answer record.
- Canonical redirects work on both reads and writes; a merge loses neither evidence nor aim ownership.
- Forged learner/agent fields do not grant authority; specialist output is validated before tutor writes.
- Unsupported or stale key/protocol versions cannot silently create certified assessment evidence.

Assessment rules and scheduling defaults belong to their existing ticket. This contract adds no new
mastery thresholds, client promise or offline sync layer.
