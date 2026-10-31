# Authentication, control and recovery contract

**Status:** technical design for confirmed product policies; MyFitnessGuide authentication pattern selected by the learner, source-inspected read-only. No Teach deployment or runtime proof.
**Scope:** one Teach Worker, one active learning record, one learner. Sources checked 2026-10-26.
This refines the [accepted access](../../../../.scratch/teach-general/artifacts/client-access-contract.md)
and [recovery](../../../../.scratch/teach-general/artifacts/continuity-and-recovery-contract.md) contracts.

## 1. Components and binding ownership

| Binding/component | Contents and authority |
|---|---|
| `LEARNING_DB_A`, `LEARNING_DB_B` | D1 active and isolated recovery slots; exactly one active learning database selected by SecurityLedger, not two trackers |
| `SECURITY_LEDGER` | One SQLite-backed Durable Object named by the configured learner id; authoritative grants, approval state, deletion ledger, recovery generation, backup catalog/keys and grader budget |
| `OAUTH_KV` | OAuth library clients, codes and token/grant material; never sufficient by itself to permit learning access |
| `BACKUPS` | Private R2 bucket holding encrypted recovery objects; no public bucket or cache |
| Google OIDC | Upstream human login for MCP authorization, adapted from MyFitnessGuide; own Teach OAuth credentials/callback |
| Cloudflare Access OTP | Private `/control` browser app, adapted from MyFitnessGuide; not the MCP authorization server |
| Workers OAuth Provider | Colocated OAuth authorization/resource roles; issues MCP grants after human identity/consent |

The extra control state prevents a learning rollback from resurrecting credentials, deleted records or
spent grading budget. D1 remains the only authoritative learning store. Both D1 slots are provisioned
at setup and bound to the same Worker; the inactive slot is maintenance-only and must be empty except
while staging recovery. It never serves an independent learner record.

Use MyFitnessGuide’s `@cloudflare/workers-oauth-provider` + direct Google OIDC pattern, with Teach-specific
credentials, callback, KV, D1/DO/R2 state, origin and grants. Never reuse its live credentials or resource
identifiers. Pin the reviewed package version and deployment
compatibility date pinned in the lock/config at scaffold time. Do not invent version pins from the old
spike. Its documented resource discovery, PKCE and client-registration features supply the protocol;
Teach still validates operation scopes. [Provider authorization reference](https://github.com/cloudflare/workers-oauth-provider/blob/main/docs/authorization-server.md)


## Source-inspected MyFitnessGuide adaptation

The existing repository is `/Users/hritvikdinkar/repositories/gym-tracker`; its public authorization page
names MyFitnessGuide. Read-only inspection establishes a reusable implementation shape, not proof of
Teach compatibility:

- [Google login helper](/Users/hritvikdinkar/repositories/gym-tracker/app/worker/src/google-oidc.ts:27)
  defines Google authorization/token/JWKS endpoints, with state/nonce in the authorization request.
- [ID-token checks](/Users/hritvikdinkar/repositories/gym-tracker/app/worker/src/google-oidc.ts:45)
  verify issuer, audience, RS256 signature and nonce; the exchange rejects absent/unverified email at line 78.
- [OAuth callback](/Users/hritvikdinkar/repositories/gym-tracker/app/worker/src/oauth-entry.ts:125)
  resumes library upstream state, verifies Google identity and creates a random `connectionId` in grant props.
- [Provider configuration](/Users/hritvikdinkar/repositories/gym-tracker/app/worker/src/oauth-entry.ts:150)
  selects `/mcp`, `/authorize`, `/oauth/token`, `/register`, CIMD, one-hour access and 30-day refresh TTLs.
- [Public OAuth deployment](/Users/hritvikdinkar/repositories/gym-tracker/app/worker/wrangler.oauth.jsonc:1)
  separates OAuth KV and enables `global_fetch_strictly_public`; the
  [browser deployment](/Users/hritvikdinkar/repositories/gym-tracker/app/worker/wrangler.jsonc:1) describes
  Access one-time-PIN control and same-origin API/assets. Its
  [entry verifier](/Users/hritvikdinkar/repositories/gym-tracker/app/worker/src/index.ts:84) refuses missing
  Access config, and API paths do not fall through to public assets.

Teach adopts direct Google login for MCP and Access OTP for trusted browser controls, with one-hour
access/30-day refresh TTLs as implementation defaults subject to stronger ledger revocation. Issue a
fresh mandatory opaque connection/grant id and retain it across refresh; do not copy the source's
legacy fallback that collapses unknown connections. Enforce each Teach scope per operation rather than
copying MyFitnessGuide's blanket read-plus-write requirement. Add the private-owner allowlist before
authorization completes: the inspected Google helper proves a verified identity, not that it is Teach's owner.

MyFitnessGuide currently deploys OAuth and browser surfaces as two Worker entrypoints sharing its D1.
Teach selects one Worker with route-specific adapters and Access path protection, preserving the
same public-OAuth/private-browser boundary without requiring a second deployment. Verify path matching
and Worker-first control routing in deployment tests; the source’s two entrypoints demonstrate transport
topology, not two trackers. Do not share MyFitnessGuide databases, household model,
Access audience, service tokens, OAuth client, grants or deployment identifiers. Do not modify that repo.

The SecurityLedger strong gate, approval binding, deletion ledger, budget continuity and restore fence
are Teach additions. They were not demonstrated by the inspected MyFitnessGuide auth files and must not
be described as inherited, already-tested guarantees. All selected Teach launch clients still need real
login, refresh, operation, grant-isolation, revoke and cross-client assessment tests.

## 2. Identity, endpoints and permissions

Production origin is `https://<learner-approved-host>` and canonical MCP resource is `<origin>/mcp`.
Configure the actual origin once; reject a resource/audience mismatch rather than derive it from an
untrusted Host header. Development uses loopback, a separate synthetic identity and separate stores.

Bootstrap the sole learner with the verified Google `(issuer, sub)` and a verified owner email in private
deployment configuration. Before completing a grant, require the expected Google subject and verified
email; never treat any Google login as the owner. Google authorization uses state plus a fresh nonce,
then verifies ID-token signature/JWKS, issuer, Teach client-id audience, expiry and nonce. The verified
email is a display/control-mapping attribute, not a caller-controlled identity key. No public learner
signup. Adding an OAuth client is not adding a learner.

Access OTP protects only the browser control paths. Validate its signed JWT issuer/audience/expiry and
map its policy-allowed owner email explicitly to the configured learner; Access subject and Google sub
are different identity namespaces and must not be equated. Never accept an unverified identity header. [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

| Route | Purpose and access |
|---|---|
| `GET /health` | Generic availability only; no learner, backup, database or grant details |
| `/.well-known/oauth-authorization-server`, protected-resource metadata | Public discovery identifying the canonical issuer/resource |
| Library `/authorize`, `/oauth/token`, `/register` | Standards-based OAuth; bounded public client registration, PKCE S256, exact redirect validation and learner consent |
| `GET /callback` | Google OIDC callback; completes the library-managed state/nonce-bound flow after consent, and maps the verified owner before issuing a grant |
| `POST /mcp` | Authenticated Streamable HTTP MCP; verified token plus SecurityLedger admission on every request |
| `/control/*` | Minimal browser-only learner controls needed at launch; separate from the later books/reader |

Pin OAuth library endpoint options to the listed routes in the implementation; integration tests verify
actual metadata URLs and supported client callback/registration variants. Allow CIMD with the library's
strict public-fetch compatibility setting, and DCR where clients require it. Do not fetch arbitrary
private metadata URLs. No credential-bearing cross-origin redirect. Token secrets never enter logs.

MCP grants expose `teach:read`, `teach:learn` and, when explicitly approved in consent, `teach:organize`.
`read` permits protocol/orientation and learning reads. `learn` permits session/inquiry/exposure/answer
submission, not arbitrary grade assertion. `organize` permits proposed concepts/links/aim edits within
existing learner controls. The server owns assessments, derived state and all control operations.
No MCP scope authorizes grant administration, deletion, restore or confirmation of a concept merge.

Registered clients receive only approved scope intersections. Normal controls require upstream human
login, not an MCP token. Specialist identities and reported model names are provenance, not authority.
External free-text grades enter only through the private tracker-owned grading completion path.

## 3. Strong admission and revocation

SecurityLedger durable SQL tables are:

- `control(singleton=1, learner_id, active_slot, generation, mode, deletion_revision, security_revision)`;
- `grants(grant_id PK, subject, client_id, scopes_json, status, security_epoch, created_at, revoked_at)`;
- `approvals(approval_id PK, action_hash, target_versions_json, generation, expires_at, consumed_request_id)`;
- `deletions(sequence PK, target_kind, opaque_target_id, decision_id UNIQUE, created_at, applied_generation)`;
- `maintenance(operation_id PK, kind, phase, source_slot, target_slot, generation, manifest_hash, checkpoint_json)`;
- `backups(backup_id PK, object_key, created_at, expires_at, schema_version, rules_version, manifest_hash, wrapped_key, status)`;
- `budget_reservations(call_id PK, month, estimated_microUSD, settled_microUSD, status, price_policy)`;
- `budget_months(month PK, limit_microUSD, reserved_microUSD, settled_microUSD)`.

Every authority-changing check/update occurs in one synchronous SQL `transactionSync` closure, with
no asynchronous I/O inside it. Do not assume a whole RPC remains serialized across an `await`.
Cloudflare documents synchronous transaction rollback and output gating; use the default confirmed
writes, never `allowUnconfirmed`, for acknowledgements. [Durable Object SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

After validating the OAuth token, call `admit(grant_id, required_scopes, client_generation, operation)`.
It checks the canonical learner, active grant, scope and current generation. Mutations require
`mode=active`; read-only operations may also use `mode=backup`, but final restore cutover denies all
learning reads. On success it returns
`{slot,generation,security_revision,admission_id}`. Missing grant or unavailable ledger denies access.
Never cache an allow decision between requests. Unknown grants are denied even if KV recognizes a token.
Use the mandatory Teach-issued `connectionId` in grant props as `grant_id`; never accept a caller
supplied identifier or a legacy client-id fallback. Issuance creates a pending ledger grant, completes
the library authorization with those props, then marks that ledger grant active before returning the
client redirect. A partial failure leaves it nonactive/denied. Keep the library grant reference where
available for cleanup, while access decisions always use the stable Teach connection id.

`revoke(grant_id)` commits `status=revoked` and increments its security epoch before returning success.
Then revoke the library grant/token records as cleanup; retry cleanup without undoing the denial. Token
refresh and subsequent authorization check the ledger as well. Newly admitted requests after success
are denied globally; requests already admitted may finish. This is the accepted in-flight exception.
Revocation is per actual connection/grant; web/mobile or local surfaces can share a grant.

Retain revoked-grant tombstones while their credentials could be accepted; unknown-grant deny prevents
reintroduction after cleanup. A learning restore never restores SecurityLedger or OAuth KV. If control
state itself is lost or corrupt, fail closed, invalidate all grants and require trusted rebootstrap.
Never restore an old SecurityLedger snapshot while continuing to accept old credentials.

## 4. Trusted learner controls

Launch includes a small Access-OTP-protected `/control` page: connections/revoke, proposed concept merges, deletion preview,
backup status/export, restore preview/approval. This is an operational control surface, not the later
learning reader. Protect both `/control` and `/control/*` in Access, and revalidate the signed Access identity at every
control API request in the Worker. MCP and OAuth callback endpoints remain on the public OAuth route,
not behind a browser-only Access challenge.
Use secure HttpOnly SameSite browser sessions, exact Origin checks and per-session CSRF protection for
state-changing POSTs. GET requests never execute a merge, deletion, revocation or restore.

A tutor can create a proposal and return its control URL, but cannot approve it. The browser displays
the action/affected records, versions and consequences; a human POST creates one short-lived approval
bound to a canonical action hash, generation and expected versions. Default approval lifetime is ten
minutes. Changed proposal/version or expired approval requires a new confirmation. Normal MCP calls
cannot request browser session secrets or set `approved=true` to bypass the control path.

The Worker consumes approval idempotently for a canonical request id. If D1 outcome is uncertain,
reconcile the same request rather than spend approval again. A failed precondition invalidates the old
proposal. Record minimal audit ids/reasons, not secrets or deleted content. Account/API tokens used for
maintenance are least-privileged Worker secrets and never returned through MCP.

Initial input bounds: MCP body 64 KiB, 60 admitted requests/minute/grant, burst ten; control POSTs
10/minute/session; registration five/hour/IP. Return explicit rate-limit errors with bounded retry hints.
Tune from measured usage; limits do not excuse accepting an unauthorised request or dropping evidence.

## 5. Mutation fences and deletion

### Ordinary mutation path

Every ordinary learning mutation, including grader completion, review claims and amendments, must test
`meta.generation = admission.generation AND meta.write_enabled = 1` in the same atomic batch as all
its effects. Client envelopes carry the last observed generation; obtaining a fresh admission must not
silently upgrade an old envelope after recovery or deletion. Return `STALE_GENERATION` and reorient.
The data contract owns conditional-batch mechanics; a failing guard may not leave a partial event.

### Private maintenance authority

Fencing, backup re-enablement, isolated import, migration, purge, projection replay and activation need
a separate internal path that can operate on a disabled database. They must not pretend to hold ordinary
MCP write permission or bypass checks with a caller-supplied maintenance flag. The Worker mints a private
maintenance capability only from the persisted SecurityLedger operation. It binds
`{operation_id,kind,slot,generation,phase,expected_meta}`; each step verifies that operation remains the
exclusive active maintenance owner and uses a compare-and-set D1 batch against its expected meta state.
D1 meta records `maintenance_op_id` and `maintenance_phase` alongside generation/write_enabled.

Only the allowed next action for that kind/phase may execute. Fence installs the operation id and disables
writes; import/migrate/replay/purge keep them disabled; enable/activate clears the marker only after its
prerequisite checkpoints are validated. Uncertain outcomes reconcile the same operation/step id before
retrying. A stale capability from an earlier backup cannot enable a database fenced by another operation.
There is no public maintenance RPC, OAuth scope or user-submitted SQL path. Cron and confirmed control
actions enter via private Worker code; least-privileged export/import credentials do not become MCP tools.

SecurityLedger admits at most one `backup`, `restore` or `deletion` maintenance operation at a time.
Conflicting operations refuse as busy, not queue a hidden destructive action. Revocation remains available
and retains its accepted already-admitted-request exception. Never hold an async cross-store transaction;
persist phases, use conditional D1 steps and reconcile each boundary after crashes.

### Deletion barrier and purge

1. Validate/consume the human approval for the target revisions. In one ledger transaction require no
   competing maintenance operation, persist `mode=deletion`, create its checkpoint and minimal opaque
   tombstones, increment deletion revision and bump the admission generation. Refuse new learning
   mutations and new reads of affected data; whole-account deletion refuses all learning access.
2. Use private maintenance authority to fence the active D1 primary: install the deletion operation id,
   set `write_enabled=0` and the new generation, checking the previous meta revision. Await confirmation.
   An already-admitted old batch serialized before that fence is included in the subsequent purge; one
   serialized after it fails its ordinary generation/write guard. A prior tombstone precheck is not a fence.
3. Idempotently purge the targets, dependent private content, derived artifacts and pending grading
   payloads, then rebuild affected projections while the database remains disabled. An external model
   request already in flight cannot be recalled, but its old-generation completion cannot recreate data.
4. Checkpoint completion, re-enable the active slot at the new generation through the maintenance path,
   then atomically return ledger mode to active. Acknowledge deletion only after these checks and all
   active-service purges succeed. Whole-account deletion instead revokes all grants and leaves learning
   disabled. Do not promise immediate erasure from accepted retained encrypted provider copies.

Every creation/write checks relevant tombstones; identifiers cannot be reused to recreate deleted
records. Retain tombstones through all restorable generations and stale-request windows, independently
of backup-job success, without retaining erased free text. Clients must reorient after the generation
change; never upgrade delayed requests automatically. On a crash or unknown purge/fence result, persist
maintenance mode, fail closed for affected operations and resume the same checkpoint. Do not acknowledge
or reopen writes on the assumption that a Worker timeout proves an older D1 operation never committed.

## 6. Daily encrypted backup

A UTC daily scheduled job calls the maintenance coordinator; repeated job ids are idempotent. It enters
`mode=backup`, refusing new mutations briefly while reads may continue. Fence the active D1 primary
with `write_enabled=0` using the private maintenance path; then export the quiescent database and its pinned schema/rules artifacts. The
export API supplies a SQL object and bookmark; validate completion and manifest before calling this a
successful recovery point. [D1 export API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/)

Use the export API only from the private maintenance path with a scoped credential. Its temporary SQL
artifact must never enter public tools, logs or the learner export. Stream it directly into authenticated
encryption and private storage; measure upstream temporary-artifact lifetime as a release privacy check.

Encrypt using a fresh random AES-256-GCM data key and unique 96-bit nonce per backup. AAD binds
`backup_id,created_at,expires_at,schema_version,rules_version,manifest_hash`; keep the key only wrapped
under a separately provisioned versioned backup KEK in SecurityLedger. R2 stores ciphertext and manifest,
not plaintext keys; Worker secrets hold the KEK. Keep a learner-controlled KEK recovery copy outside
these service backups, documenting that losing all copies makes recovery impossible. Backup manifest
omits OAuth credentials, grant state and private control sessions.

The catalog is marked usable only after object/integrity checks. Resume active writes with the same
learning generation after a successful or failed backup, through its operation-bound enable step;
never let an old backup completion reopen another operation’s fence. A crash leaves explicit maintenance
state until reconciled, not silently unguarded writes.
Expose latest usable recovery point and backup failures in `needs_you` and `/control`. Target <=24h age
only when jobs succeed. Run a restore rehearsal before relying on the first backup.

## 7. Confirmed retention interpretation

The learner accepted a strict 30-day Teach recovery window: expired backups cannot be accessed or
restored through Teach, while physical encrypted storage cleanup may lag. R2 lifecycle expiration is asynchronous, typically
removing an object within 24h after its deadline, and can take longer. Thus a day-30 lifecycle rule alone
cannot guarantee physical erasure by day 30. [R2 lifecycle behaviour](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

A backup becomes inaccessible and unrestorable
through Teach at `created_at+30d`, even if encrypted storage cleanup lags. Every list/download/restore
checks catalog expiry against server time, not just a cached key. At expiry deny access and remove the
active wrapped key; key destruction is not a claim that provider recovery copies vanished. Hourly cleanup
starts object deletion at day 29, uses a day-29 R2 lifecycle rule as defense in depth, and verifies delete
results; failures remain visible. Never serve backups through a public URL/cache. R2 direct deletes are
strongly consistent, but CDN cache behaviour is separate. [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/)

This accepted window does not claim physical erasure by day 30 or provider-operator cryptographic
unrecoverability. If that stronger requirement is introduced later, reassess storage/provider controls;
the documented defaults do not establish it.
D1 Time Travel is always on with provider-managed recovery history up to 30 days; it is not Teach's
encrypted export policy, and must be disclosed separately. [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
No customer-facing logs may contain answer text, item keys, tokens or backup bodies. Provider retention,
transient export copies, control-store PITR and model retention must be documented before hosting.

## 8. Deletion-preserving restore cutover

1. Through `/control`, choose a nonexpired usable backup; preview time/schema and possible missing newer
   records. Obtain an approval bound to manifest, target generation and source slot.
2. Reserve the exclusive restore maintenance operation before touching its inactive D1 slot; reject
   concurrent backup/restore/deletion ownership. Initial staging may allow ordinary source learning
   while the ledger records `phase=staging`; the private operation-bound import path alone writes staging.
   Import and validate with staging writes disabled. Verify integrity, schema
   and rules; rebuild projections using pinned rules. Do not copy auth/control state from it.
3. Advance that operation to `mode=restore, phase=fencing`; block new learning mutations and deletion
   decisions. The staging phase allowed source writes, so do not reuse its old loss preview blindly. Revoke
   operations remain available. Increment the recovery generation for fencing, not for automatic replay.
4. Use private maintenance authority to fence source D1 with `write_enabled=0`, the operation marker
   and new generation, awaiting the primary conditional-batch result.
   Every older mutation serializes before this fence or is refused by its guard; do not infer completion
   from an expired Worker/lease. Re-read source checkpoint to report newly acknowledged writes explicitly.
5. Read the current deletion revision, apply all tombstones to staging, and validate replay again. Check
   manifest, source checkpoint, approval, deletion revision and recovery generation at final cutover.
   If the loss preview/target changed, obtain fresh human approval; do not surprise the learner with a
   newer set of discarded writes. In `restore` mode no new deletion decision can race this check.
6. Use the operation-bound activation step to set staging meta to the new generation and enable writes;
   then atomically switch ledger active slot
   and `mode=active`. Between those actions the ledger still denies public mutations, so staging cannot
   acquire a second authority. Old source stays fenced and is purged after recovery validation.
7. Persist phase checkpoints so a crash resumes safely; never automatically reopen the old source after
   an uncertain cutover. Reconcile active slot and both meta generations first, failing closed on mismatch.

Restore invalidates outstanding review leases, control approvals and old-generation queued grading
completions. Recreate only valid operations from the newly authoritative state; no reuse of old admission
can restore spent budget, deleted text or grant permissions. Read admission uses the active slot/generation
from the ledger; no direct public route addresses either D1 binding. During final cutover all learning
reads are briefly refused, avoiding mixing pre/post-restore records in one response.

## 9. Release evidence

Prove cross-region grant revoke/refresh denial while another grant works; forged browser approval and
scope failures; private maintenance refusing ordinary callers and stale operation capabilities;
D1 writes concurrent with deletion/restore fences; interruption at every maintenance phase; deletion before,
during and after restore staging; stale grader completion; actual decrypt/import/rules replay; expired
backup refusal; cleanup failure visibility; lost KEK; auth/control-state failure; each actual launch client.
These are required tests, not completed results. Confirm provider/account eligibility, dependency pins,
secrets, origin and private identity through the reviewed setup process before any deployment.
