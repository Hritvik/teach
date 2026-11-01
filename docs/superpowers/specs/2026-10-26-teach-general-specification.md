# Teach General — first conversational release specification

Date: 2026-10-26. Status: reviewed and learner-approved for implementation planning on 2026-10-26; not a deployment or paid-call approval.
This is the first-release specification assembled from the resolved Wayfinder decisions. The
[product design](2026-10-23-teach-design.md) remains the wider product reference; this document pins the
release boundary and links the technical contracts. In a conflict, learner-confirmed ticket answers
win; report and resolve conflicts before building rather than silently choosing a different rule.

## 1. Outcome and inherited scope

The learner can begin with an inquiry or goal, learn through conversation and active checks, save a
truthful record of understanding, and continue through another supported agent without starting over.
Teach grows a knowledge graph and distinguishes urgent preparation from longer-term growth. It serves
one learner's general knowledge. Employer-specific records and the former former employer track are excluded.

The first usable release includes the hosted General tracker, conversational tutor, source/key
verification, shared independent free-text grading, reviews and required learner controls. It targets
Claude Code, Codex CLI/local desktop and Claude web/mobile. Books, the feed, the full reader, richer
IDE/code instruments and later integrations retain their product scope but ship in later phases.
This is a phased long-term build, not a reduction of the agreed domain model around a sample topic.

## 2. User journeys

### Begin from curiosity or an aim

An inquiry is answered first and mapped to existing concepts or candidates. A goal is optional. The
tutor may suggest aims, reviews or the next frontier concept and explains its choice; the learner may
steer, skip, ask directly for an explanation or choose growth. Self-ratings guide placement but do not
create demonstrated mastery. The tracker records provenance rather than trusting a model's assertion.

### Learn and demonstrate understanding

Teach distinguishes Recall, Mechanism, Purpose and Transfer. Lessons use prediction, examples,
investigation and application as appropriate to the gap. An item is asked only after every key point
is anchored and verified. Exact-key items are evaluated deterministically; free-text answers use an
isolated shared grader. The tutor cannot award its own preferred grade. Revealed answers and helped
practice are recorded honestly. Reading or hearing an explanation is exposure, never proof of mastery.

Solid follows one strong correct; Secure requires strong corrects on two different recorded local days
without a subsequent genuine miss. Content grade and credited strength are distinct. Deliberate checks
ask sure/think/guess, which may be skipped; unknown confidence never becomes a wrong answer or demotes
mastery by itself. Correct helped/guess answers do not manufacture independent mastery or false misses.

A challenged grade is independently regraded against the same item/key version. Affected progress is
provisional until resolved. History retains original answers, grades and amendments. Source changes
flag Stale; overdue reviews flag Fading. Flags alone never lower mastery.

### Return and continue

A session may close with an exit ticket and muddiest point; interruption never invents one. Another
supported client reads acknowledged session/learner state and due reviews, then resumes or starts a
new session. Teach does not promise access to the original agent provider's entire chat transcript.
Review reservations and stable attempts prevent duplicate scheduling and evidence credit across clients.

### Understand saving and failures

Only an acknowledged write is reported saved. A lost response is reconciled by the same request and
attempt identity. Entity conflicts are surfaced rather than overwritten. During outages, conversation
may continue with new progress explicitly unsaved; after reconnect, offer to save recoverable work.
There is no offline learning database or background outbox. Invalid sources or unavailable grading
leave affected assessments held/pending, not wrong. Verified exact-key checks and explanation may continue.

### Control consequential changes

Ordinary capture and reuse of an existing concept are automatic. Merging two existing concepts requires
learner confirmation for the exact pair, survivor and versions. A minimal private browser control surface
at launch also supports connection revocation, deletion and backup/restore. This is distinct from the
later learning reader. Agent-provided `confirmed=true` or an MCP token is not human approval.

## 3. Architecture and ownership

Use the selected [MyFitnessGuide setup pattern](../../../.scratch/teach-general/research/myfitnessguide-setup.md):
Cloudflare Worker/D1 with OAuth Provider and direct Google OIDC for MCP sign-in, plus Access-protected
private human controls. Teach owns its own origin, resources, Google client/callback, secrets and grants.
No health data, household roles or existing production credentials are shared with MyFitnessGuide.
The comparison is verified against local source at commit `382f2dcd225b0c76d8e810b6d34233ad2c5e4179`;
it is not a fresh production test or certification of Teach client access.

| Boundary | Authority |
|---|---|
| One active learning D1 | Concepts, aims, goals, sessions, evidence, items, jobs and versioned rules; derived learning projections |
| Isolated D1 recovery slot | Temporary restored candidate only, never another active tracker |
| SecurityLedger Durable Object | Authoritative grants/revocations, human approvals, deletion/recovery generations, backup keys/catalog and grading budget |
| OAuth KV | Library registration/token material; insufficient alone to admit learning requests |
| Private encrypted R2 | Time-limited recovery ciphertext; no public backup URLs |
| Shared model invocation | Independent key verification/grading; no tracker tools or arbitrary write credentials |
| Client adapters | Read the served protocol and orchestrate the same contracts; optional local instruments |

All learning derivations live in the tracker. Native specialist agents return proposals, not privileged
state changes. The shared model sees only necessary question/key/capture excerpts and answer, never
unrelated learning history or credentials. Model output is validated and committed by tracker operations.

## 4. Binding technical contracts

These contracts define implementation choices, not additional learner preferences or successful tests:

- [Learning data and rules](contracts/data-and-rules.md): concrete table layouts, tool envelopes,
  validation, transactional guards, attempts, corrections, graph/aim semantics, replay and FSRS mapping.
- [Authentication and recovery](contracts/auth-and-recovery.md): Google/Access identities, routes/scopes,
  authoritative access gate, trusted confirmations, mutation fences, backup encryption and restore.
- [Shared model service](contracts/grading-service.md): provider candidate/snapshot, strict requests and
  outputs, source verification, isolated jobs, idempotency, privacy and cost reservations.

The first schema retains the agreed later books/chapters/cards model; their reader/endpoints activate
only in their phases. No optional codewalk installation blocks the general conversation. Enable code
assessment only after its relocation and verification capabilities pass a public/synthetic fixture.

## 5. Source capture and verification

Key verification consumes server-trusted immutable captures, never a tutor's `verified:true` field.
Initial source mode is named public HTTPS documents and synthetic fixtures; private/employer sources,
login-required pages and arbitrary uploads are excluded from the hosted verifier. Unsupported sources
may support labelled explanation but cannot provide an assessment key.

The capture adapter uses configured approved source origins, HTTPS/443 only, no embedded credentials,
no IP-literal/private/loopback/link-local targets and no ambient browser cookies. Redirects are capped at
three and revalidated at each hop; outbound fetch must enforce a public-address policy under DNS changes.
Timeout is 10 seconds, fetched body limit 1 MiB, selected passage limit 16 KiB, model input limit 32 KiB
including prompt/schema/data. Reject unsupported MIME types, oversized/decompression output or missing
locators; never silently truncate a rubric. HTML/text extraction removes executable content. Record
canonical URL, locator, retrieval time, source hash, passage and verification version. Do not expose a
general-purpose fetch proxy through MCP. The build must test SSRF/redirect and prompt-injection cases.

The grader's key-verification role checks every rubric point against supplied trusted captures. Any
unsupported or uncertain point holds the key. Codewalk remains the owner of code-anchor relocation;
public code verification compares anchored bytes at the named commit. Source text is evidence, never
instructions granting the model tools or permission. A changed item/key content produces a new immutable item version. Capture rechecks append verification
records and update publication eligibility without rewriting content. Attempts retain their original
item/key and accepted verification ids.

## 6. Recovery and access promises

Once revocation is acknowledged, reject new requests from that grant, including valid unexpired tokens;
already-admitted requests may finish. A fail-closed authoritative ledger supplements OAuth KV. Revoke
actual grants/connections; do not assume mobile/web or desktop/CLI have distinct grants merely because
they are different devices. Normal learning credentials cannot approve merges or administer restore.

Take encrypted daily backups, expose failures and the latest verified recovery point, and target a
24-hour recovery point when jobs succeed. Each copy becomes inaccessible/unrestorable through Teach at
30 days from creation even if subsequent jobs fail. The learner accepted that physical cleanup of
encrypted storage remnants may lag. Provider Time Travel/log/export/model retention must be separately
disclosed; expiry is not a claim of physical erasure everywhere.

Restore requires human approval of the recovery point and possible newer-record loss. Stage in the
inactive database, verify integrity/replay, fence live writes and check deletion/security generations
before switching authority. Reapply deletion decisions; never restore revoked credentials or spent
budget. Crash recovery resumes a recorded maintenance phase and fails closed on inconsistent control
state. Lost key material can make backups unrecoverable; setup includes private key recovery instructions.

## 7. Costs, privacy and approved budget

The proposed grading implementation uses the concrete researched model/API in its contract. This is
an engineering recommendation, not proof of model quality, existing MyFitnessGuide infrastructure or
permission to incur charges. The learner approved an initial US$5/month Teach inference cap
(5,000,000 micro-USD per learner-local calendar month). Exhausting it leaves answers pending;
credential setup and live paid-call approval remain execution gates. Verification, grading, regrading and retries share one conservative reservation ledger.

The cap covers Teach-admitted inference under a pinned verified price policy, not taxes, FX, unrelated
account use, hosting or unannounced provider changes. Live setup must disclose provider content-retention
limits; stateless requests do not imply zero retention. No model key or provider account has been set up.

## 8. First-release acceptance and exclusions

Release requires the same complete inquiry/goal → verified check → saved evidence → independent grade
→ due review → cross-client return loop on every selected surface, including mobile without the laptop.
Use fixed human-reviewed general fixtures; the validation topic is an engineering fixture, not an
invented learner goal or reason to shrink scope. Show the learner the result before release approval.

Required failure evidence includes duplicate attempts, lost acknowledgements, conflicting corrections,
source/grader outages, budget exhaustion, injection, revocation/refresh, deleted-data restore, backups
and recovery-generation races. Unit, D1/DO integration and critical client E2E tests must pass with at
least 80% measured executable-code coverage. Mocked tests alone do not prove remote semantics. Do not
claim those tests ran during planning.

No production implementation, public signup, billing product, employer track, new portfolio integration,
full learning reader or automatic offline sync is authorised by this specification. Existing optional
integration and later-product commitments remain in the wider design and later build phases.

## 9. Decision provenance and readiness

The [Wayfinder map](../../../.scratch/teach-general/map.md) indexes the six learner decisions, OAuth
research and original-reference audit. Technical contracts make builder-owned choices explicit. The
[phased build plan](../plans/2026-10-26-teach-general-build.md) pins the sequence and proof required.
Cross-contract review is complete. The learner approved the specification, phased plan and US$5/month
inference cap on 2026-10-26; the readiness ticket is resolved and the map complete. Documentation is
not runtime proof: the planned tests and external-action gates still apply.
