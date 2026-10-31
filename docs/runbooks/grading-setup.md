# Grading and review setup

The Phase C implementation is tested locally with injected model responses. Inference remains disabled
by default. The selected snapshot is a technical candidate, not an authorization to create a provider
account, supply credentials or make a paid call.

## Local evidence

`npm run check` runs domain, real D1/SQLite Durable Object, model-contract, source-policy, runner and MCP
acceptance tests. The end-to-end fixture captures a synthetic source, requests independent verification,
submits an answer, grades/regrades it, then restarts and inspects saved mastery, budget and schedule state.
The Responses adapter uses raw fetch with no SDK retry layer; prompts and strict schemas have pinned
hashes in each logical job and completion provenance.

`evals/grading-corpus.json` is an original synthetic corpus with expected criterion results and source
passages. Its status is **pending human review**. Schema/invariant tests do not measure model accuracy.
Review every fixture and investigate content-grade disagreements before any quality sign-off.

## Sources

Configure `TEACH_SOURCE_ORIGINS` as a private JSON array of approved exact HTTPS origins. The source tool
accepts a named document and line locator; it returns a saved anchor identity, not a fetch proxy. Initial
support is raw `text/plain` or `text/markdown`. HTML, PDFs, uploads, login-required/private sources and
employer material are unavailable for key verification. Keep explanations explicitly unassessed when
an appropriate trusted capture cannot be made.

Retain `global_fetch_strictly_public` and the platform's public-only outbound transport. Do not attach
private/VPC transport to this adapter. Each redirect revalidates approved origin, HTTPS/443 and URL
constraints, with at most three redirects. Fetch timeout is 10 seconds; decompressed body limit is
1 MiB; passage limit is 16 KiB. The complete model request, including schema/instructions, is at most
32 KiB. Bounds reject rather than truncate. Captures pin bytes and versions; changed captures hold
items. Unsupported or uncertain verifier results never make a key eligible.

## Private inference policy — separate approval required

Before enabling inference, verify entitlement, current snapshot availability, rates, processing region,
usage bounds and privacy terms. Review the fixed corpus and arrange an explicitly approved bounded
paid sample. No live model-quality or hosted-client result is claimed by this repository.

Only after approval, prepare the Worker secret `OPENAI_API_KEY`, set `TEACH_INFERENCE_ENABLED=true`,
and supply private `TEACH_MODEL_PRICE_POLICY` with these exact fields:

- `verified:true`, `modelSnapshot:gpt-5.4-mini-2026-03-17`, `region:global`;
- `priceVersion:openai-global-2026-10-26`;
- `verifiedMonth:YYYY-MM` and `timezone` matching the persisted learner timezone.

These are pinned researched values, not a claim that current rates are verified. The authoritative
ledger separately requires trusted `configureBudgetPolicy` for that learner-local month, using
`pricePolicy:openai-global-2026-10-v1`, the same snapshot/timezone, `authorized:true` and `verified:true`.
There is no public setup or budget-enable endpoint. Do not treat environment variables alone as paid
admission authority. Renew policy verification before a new month or provider/price change.

The ledger limits admitted inference liability to 5,000,000 micro-USD per learner-local month.
Every physical call reserves 309,216 micro-USD before network access. Confirmed usage settles at the
pinned rates; unknown outcomes retain the full reservation. Discrepancies suspend dispatch globally,
including later months. Learning backup/restore cannot replace the budget ledger. The learner database,
model policy and authoritative budget timezone must agree. This bounds Teach-admitted liability under
the verified assumptions, not taxes, FX, hosting costs, unrelated API use or unannounced repricing.

`store:false` does not promise zero provider retention. Disclose provider logging/retention and deletion
limits from the grading contract before sending any learner content. Only necessary general-learning
problem/rubric/capture excerpts and the exact answer enter the model request. No session transcript,
account identity, confidence/hints, tools or previous grader verdict is included.

## Jobs and review operations

The production scheduled handler runs at most one job per wakeup. The prepared one-minute cron also
reconciles cached completions and expired running leases before queued current-generation work. No raw
payload is carried in a wakeup. A timeout never silently dispatches another call. Validated completions
are persisted before finalization so uncertain D1 acknowledgements can reconcile without more inference.

The Access-protected `/control/grading` page shows budget and pending work. Explicit retry/cancel POSTs
require browser identity, signed session, CSRF, exact Origin and the reviewed job revision. A retry uses
another reservation on the same logical job; at most two physical calls are admitted. Ambiguous charges
remain reserved. These controls cannot change the cap, authorize a policy or enable inference.

Verified exact keys are evaluated deterministically. Free-text and regrade results undergo strict
per-point validation and derived aggregate checks before atomic acceptance. Refusal, malformed output,
ungradable answers, unavailable sources and budget/auth failures remain pending or ungraded, never wrong.
Poll `item_status` for verification state and `attempt_status` for a saved answer; polling never queues work.

Review schedules use the pinned FSRS manifest and original server acceptance time. A due concept/level
has one leased occurrence. Explicit takeover fences old jobs. Unknown confidence consumes coordination
without rating and suppresses that review in the current session; later review uses different material.
Confidence/help amendments replay the same observation without changing the accepted answer or grade.

## Release gates

Apply and review additive `0002_assessment.sql` before enabling assessment routes. The local runner
tracks migration checksums and refuses changed applied migrations or future incompatible schema versions.
Production migrations remain subject to the existing release-evidence gate and operator review.

Real Google/Access sign-in, launch-client journeys, human-reviewed model quality and the bounded paid
sample remain pending. Backup, deletion and restore coordinators are Phase D work. Do not advertise the
full first release as complete until those capabilities and all hosted exit evidence pass.
