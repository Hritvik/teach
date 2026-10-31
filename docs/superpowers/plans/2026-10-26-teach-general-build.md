# Teach General — phased build plan

> Deployment priority update (2026-10-29): the learner approved a limited capture-first rollout before grading and reviews. See [capture deployment](2026-10-29-teach-capture-deployment.md). Full-tutor exit gates below still apply to the later complete release.

Date: 2026-10-26. Status: reviewed and learner-approved plan, 2026-10-26; paid dispatch/deployment not authorised.
Build from the [first-release specification](../specs/2026-10-26-teach-general-specification.md) and its
three binding technical contracts. Preserve the wider [product design](../specs/2026-10-23-teach-design.md).
This plan resolves implementation boundaries; it is not a report of completed build/test work.

## 1. Starting point and authority

This repository contains documents and local Git metadata, with no source, manifest, installed runtime,
remote or initial commit. MyFitnessGuide's source was inspected as the selected reuse baseline. Reuse
its established patterns deliberately; do not modify that checkout, copy its credentials/resource ids,
or assume its release tests certify Teach. The encrypted nested archive is not needed for this plan.

The learner approved a first release combining M1 tracker and M2 tutor with remote access on Claude
Code, Codex CLI/local desktop and Claude web/mobile. Books, feed and richer instruments follow later.
One learner record and one served teaching protocol remain authoritative. All six Wayfinder product
choices are binding. The learner approved this plan/specification and the initial US$5/month grading
cap on 2026-10-26. Account, credential and live execution approvals remain separately gated.

## 2. Concrete module boundaries

| Area | Responsibility |
|---|---|
| `app/domain/` | Pure immutable graph/aim/mastery/replay and scheduler adapter; no provider/network calls |
| `app/worker/src/data/` | D1 migrations/repositories, receipts, conditional guards, prepared queries and projections |
| `app/worker/src/security/` | SecurityLedger, scopes, approval/control flows, generations and admission |
| `app/worker/src/oauth/` | MyFitnessGuide-style Google OIDC and OAuth Provider adapter with Teach-only resources |
| `app/worker/src/mcp/` | Strict tool schemas, one protocol resource and validation/orchestration; no arbitrary SQL writes |
| `app/worker/src/assessment/` | Source capture, verified item versions, exact-key evaluator and isolated model jobs |
| `app/worker/src/maintenance/` | Backup/export/encryption, age expiry, deletion ledger application and restore coordinator |
| `app/worker/src/control/` | Minimal escaped server-rendered human controls; no full reader dependency |
| `adapters/` | Claude Code/Codex instructions and connection examples; loads served rules rather than duplicating them |
| `tests/` | Fixed general-source/model fixtures, integration tests and selected-client acceptance scripts |

Use TypeScript, npm workspaces and a committed lockfile, matching the reusable MyFitnessGuide shape.
Choose Vitest for domain/Worker integration and Playwright for required control-page journeys. Pin exact
current Worker/OAuth/MCP/scheduler packages only after checking their APIs, then keep a release manifest
of those pins and prompt/schema hashes. Do not blindly copy the old spike's dependency versions.
A protected internal grading module is not a second deployed learner service.

## 3. Phase A — executable local tracker foundation (M1)

### User result

A synthetic learner can start a session, ask an inquiry, accept an aim and inspect an accurate saved
record from a local MCP client. The records survive a restart without a hosted account dependency.

### Work and dependencies

Scaffold the modules above with test-first domain behaviours. Implement the concrete
[data/rules contract](../specs/contracts/data-and-rules.md): schema for graph/intent/records/items/sessions,
immutable item versions, later-material entities, receipts and projections; tool envelopes and error
codes; server sequences, local evidence dates and compatible rule manifests. Implement pure replay,
merge/goal closure rules and pinned FSRS mappings. Preserve correct helped answers as practice and
unknown confidence as non-failing unresolved strength.

Implement SecurityLedger admission and generation interfaces with synthetic local credentials before
adding production authentication. Every D1 write uses the same conditional guard mechanics; validate
schema/rules/generation/versions inside the atomic batch, not only in a prior read. Expose curated
prepared read views, never caller-authored mutation SQL. Use separate synthetic fixtures and storage;
local test headers/secrets cannot enter a production entrypoint.

### Exit evidence

Observed red→green tests for domain rules and D1/DO contention; receipt replay after lost response;
concurrent attempts/corrections and deterministic replays; graph cycles/aim ownership; same-day/hints/
unknown confidence; forward-only migration refusal. Typecheck, unit/integration suite and measured
coverage >=80% pass. A restart/persistence exercise and local MCP round trip pass. No remote claims.

## 4. Phase B — private hosted-access and learner controls (M1/M2 prerequisites)

### User result

The intended learner can sign in, view connections and approve consequential actions; unauthorised
clients cannot read or change learning state. This phase does not yet certify conversational grading.

### Work and dependencies

Use the [auth/recovery contract](../specs/contracts/auth-and-recovery.md) and inspected MyFitnessGuide
Google OIDC pattern. Configure Teach-specific issuer/resource origin and a verified sole-learner
mapping. Implement discovery/CIMD/DCR/callback variants actually needed by launch clients, scopes and
per-grant ledger admission. Keep Access-protected browser controls distinct from MCP credentials.
Include connection revocation, merge/deletion proposals and backup/restore previews at launch.

Implement post-acknowledgement revocation against the authoritative ledger, not eventually consistent
KV alone. Enforce nonce/state/audience/issuer checks, CSRF and exact-origin browser controls, bounded
registration/rates and trusted one-use action approvals. Optional client metadata cannot grant authority.
Keep the learner's setup identity and secrets private; prepare placeholders/runbook first, then obtain
approval before account, credential or remote configuration changes.

### Exit evidence

Local fake-issuer tests prove malicious callbacks, forged approval, wrong audience/scope and old
credentials fail closed. Approved synthetic hosted tests then demonstrate actual sign-in/read/write on
all selected clients, independent-grant revocation, refresh/reconnect, and private control actions.
A source-tree deploy gate refuses development identities, unverified bundles and unreviewed migrations.
A handshake is not the exit criterion. Production rollout still waits for the complete first-release gate.

## 5. Phase C — shared assessment and conversational tutor (M2)

### User result

On every launch surface, the learner can discuss a general idea, answer a verified question, receive an
independent grade and return through another client with the correct saved progress and due reviews.

### Work and dependencies

Implement public-source capture policy from the specification and the concrete
[model/job contract](../specs/contracts/grading-service.md). Item authors cannot self-certify keys.
Verification and grading have separate contexts/jobs with no write tools. Validate point coverage and
aggregate grades before the tracker commits evidence; model errors/refusals remain pending.
Implement stable review occurrences/attempts, polling, disputes, immutable key provenance and correction
replay. A queue/scheduled wakeup contains job identity, not raw learner content, and cannot itself grant
permission. Bound retries, cancellation and post-restore completion with CAS/generation fences.

Implement a transactional micro-USD admission budget covering source-key verification, normal grading,
regrading and retries. Pin the researched snapshot/rate/limits and disable dispatch when price/cap/key
is not authorised or verified. Confirm usage before releasing reservations; ambiguous outcomes retain
cost. Set the approved initial monthly cap to 5,000,000 micro-USD (US$5); live paid calls still require
reviewed setup and separate authorisation.

Implement the served tutor protocol and native adapter instructions for inquiry-first conversation,
placement, lesson modes, hints/confidence, reviews, exit tickets and goal-free sessions. The Claude Code
answer-grader role must use the shared route, not a divergent local authority. Keep source/grade/job
provenance available without revealing the answer key before an attempt.

### Exit evidence

A human-reviewed fixed corpus covers supported/unsupported keys, misconceptions, valid alternative
answers, injection and ambiguous questions. Require zero unsupported-key acceptance and safety-invariant
failures; investigate any content-grade disagreement before sign-off rather than inventing an accuracy
claim. Local fake-provider tests cover budget races, malformed output, timeouts, duplicate deliveries,
month rollover and correction replay. With separate approval, a bounded paid sample confirms the actual
snapshot/schema/rates. All selected clients complete the whole loop, including phone with laptop off.

## 6. Phase D — tested recovery and first-release gate (M1 + M2 release)

### User result

The learner can recover from interruption, see honest save/backup state and control access without
silent duplicate progress, erased intent or restored deleted content.

### Work and dependencies

Finish encrypted daily backup, strict 30-day through-Teach recovery expiry and cleanup visibility;
provider-managed retention is separately disclosed. Select and privately provision backup KEK recovery,
scoped maintenance credentials and resource bindings. Implement consistent export/import, manifest
integrity, isolated D1 staging, pinned-rules projection replay and write/deletion-generation cutover.
Do not restore OAuth/security/budget authority from the learning snapshot. Keep deleted content blocked
when applying deletion decisions; fail closed on missing authoritative control state.

Expose acknowledged/unsaved/pending/conflict/provisional states consistently. Reconcile uncertain writes
before offering to capture surviving unsaved conversation. No offline outbox or complete provider-chat
recovery is promised. Rehearse deployment rollback and additive migrations using synthetic data first.

### Exit evidence and production approval

Actually decrypt/import/replay a backup and inject failures at each cutover phase. Test expired recovery
refusal despite cleanup failure, deleted-record/revoked-grant non-resurrection, old-client epochs and
late grading completions. Verify actual provider retention limits and publish the private runbook.
Pass unit/integration/critical E2E checks and >=80% measured coverage, security review and an independent
whole-change review. A clean source revision, dependency tree, migration state and client acceptance
record must match the deploy artifact. Present the exact release and cost/retention limits for learner
approval before production deployment. No skill, document or general “proceed” bypasses this gate.

## 7. Later vertical phases retained

| Phase | User-visible result and trigger |
|---|---|
| Conditional M0 + M3 instruments | When a code lesson requires them, verify codewalk and add debugger/mutation/worked-example paths on public/synthetic repositories; absence never blocks ideas-only learning |
| M4 books/feed/reader | Planned and compiled chapters, read/mastered marks, chapter quizzes, cards, simulators, exports and map; reuse the existing schemas and protocols |
| M5 reader distribution | Publish reader access with approval, test browser/phone journeys and extend client coverage; the tracker is already hosted |
| M6 moving frontier | Refine growth proposals, urgency/balance, calibration, code drift and optional Throughline/Coach evidence integrations |

Keep original boundaries: Coach owns real product edits; Throughline is optional when unbound; no
preference mirror or silent portfolio data sharing. Each later phase needs its own focused spec/plan
review without reopening the first-release learner model merely because a feature is optional.

## 8. Approved handoff and execution gates

The Wayfinder is complete: the numeric US$5 cap and learner review are recorded, and cross-contract
findings reconciled. This plan and specification are linked from the resolved readiness ticket. Provider/account
identifiers, secrets and destination origin are setup inputs, not guessed values or public artifacts.
External service entitlements and actual remote/model behaviour are executable gates in these phases,
not facts established by a design document. If a design cannot satisfy a selected guarantee, return the
specific trade-off to the learner rather than silently weaken it.

No new product decision should be needed to invent state ownership, grading isolation or recovery
semantics during the build. Package API/pin confirmation, migration code, indexes and test fixtures
remain ordinary implementation work against the explicit contracts. No unanswered product input blocks
this planning handoff. External setup and real-service validation remain execution gates. No code tests, paid calls, remote setup or
production deployment were performed while writing this plan.
