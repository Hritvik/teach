# Phase C local implementation evidence — 2026-10-29

## Status and scope

The conversational assessment and review implementation is complete for local synthetic verification.
This does not satisfy the approved live model-quality, paid-sample or hosted-client exit gates. Inference
remains disabled by default. No provider account, credential, deployment, paid call, commit or push was made.

## Implemented

- Named approved public raw-text/Markdown source capture with connect-time public transport enforcement,
  bounded redirects/time/body/passage and immutable trusted capture provenance. HTML/PDF/private sources
  remain unsupported for verifier keys. Changed captures hold dependent items.
- Immutable item versions, append-only independent key verification, private exact keys and learner-visible
  offers. Clients cannot submit verification verdicts, grade assertions or provenance.
- Atomic accepted answers and logical jobs; deterministic exact evaluation, isolated free-text grading,
  status polling, disputes/regrades and effective correction feedback after reconnect.
- Strict model request/result schemas, complete point coverage, aggregate validation, isolated prompts,
  pinned prompt/schema provenance and 32 KiB assembled input limits. Refusals/malformed/ungradable output
  remain pending rather than wrong. Raw Responses fetch has no SDK retry layer.
- CAS dispatch claims and completion fences; persisted validated outcomes reconcile uncertain D1 commits
  without another model call. Explicit retries are bounded and separately reserved; cancel/supersede cannot
  award wrong evidence or accept a stale result.
- Authoritative 5,000,000 micro-USD monthly cap, conservative 309,216 micro-USD reservation per physical
  call, trustworthy settlement, held ambiguous costs and global discrepancy suspension. D1 learner, model
  policy and budget timezones must agree. Learning restore cannot reset this authority.
- Persisted FSRS replay at original acceptance times, stable due review occurrences, session leases,
  explicit takeover, unknown-confidence suppression and stale-lease fencing. Own-session confidence/help
  corrections replay one observation without rewriting its answer, content grade or authority.
- Curated calibration counts, labelled misconception hypotheses and owned inbox resolution. Browser
  budget/pending-job controls support revision-bound explicit retry/cancel with Access/session/CSRF checks.
- Served tutor protocol and shared adapter instructions for all selected client surfaces. Source and
  assessment tools are wired through MCP; scheduled work selects current-generation jobs and prioritizes
  cached/expired running dispatches for reconciliation.

## Verification

`npm run check`: strict typecheck and **275 tests across 30 files pass**.
Coverage: statements **92.82%**, branches **87.82%**, functions **97.64%**, lines **98.76%**.
`npm run build`: production bundle builds and excludes synthetic runtime markers.
`npm audit --audit-level=low`: zero known vulnerabilities.
Development runner smoke test: existing Phase A state migrated additively, loopback health passed,
and the runner was stopped after validation. Local migration checksums reject changed applied scripts.

The full MCP acceptance test captures a synthetic passage, queues verification, publishes an accepted
key, issues an item, saves and grades an answer, disputes/regrades the original observation, restarts,
then verifies saved mastery, one evidence record, budget settlement and persisted review state.
All physical model invocations are injected synthetic responses; no live API traffic is used.

Independent review findings were resolved with failing regressions before fixes: previous-month
billing discrepancy leakage; lost completion reconciliation; cancellation state; due/busy review
selection; assessed metadata amendment; exact-answer polling; prompt/schema identity; revision-bound
browser actions; old-generation scheduler starvation; timezone-bound admission and disabled-status clarity.
The final independent review reported no remaining actionable findings.

## Remaining release evidence

The eleven-case evaluation corpus is explicitly pending human review; synthetic schema tests are not
model-quality measurements. Confirm the actual snapshot, entitlement, price/region/privacy policy and
an approved bounded paid sample before live inference. Complete Google/Access and all selected hosted
client journeys separately. See `docs/runbooks/grading-setup.md` and `evals/README.md`.

Phase D remains: encrypted daily backups, strict 30-day through-Teach recovery expiry, deletion barriers,
isolated restore/replay/cutover and first-release recovery rehearsals. Those execution controls are
explicitly unavailable until implemented. The full first release is not declared complete.
