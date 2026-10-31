# Capture-first deployment — 2026-10-29

The learner explicitly reprioritized deploying learning capture before grading and spaced reviews.
This is a limited owner-only release with its own acceptance gate. The original full tutor release
continues to require its grading, review, recovery and hosted-client evidence.

## Included

Google sign-in for the pinned owner; per-connection OAuth grants; sessions, inquiries, exposure,
concepts, links, aims, goals, notes and inbox capture; persistent D1 records and idempotent retries.
Cloudflare Access email-code login protects connection listing and revocation under `/control`.

## Deferred

Assessment item authoring/verification/answers, grading/regrading, spaced reviews, model budgets and
source fetching are absent from the capture MCP tool surface. Scheduled inference is a no-op in the
fixed capture entrypoint even if inference environment variables are supplied. Assessed-record
amendments are refused. Merge/goal-close confirmations and all grading/recovery controls are deferred.
Independent backup/restore/deletion execution is not part of this limited input release.

## Deployment boundary

`app/worker/src/capture.ts` fixes the mode; it cannot be switched to the full mode by client arguments
or deployment environment values. `wrangler.capture.jsonc` has no cron triggers and uses Teach-owned D1,
OAuth KV and SecurityLedger resources. Credentials and owner mapping remain in ignored private state.
Google and Access configuration are separate from MyFitnessGuide's resources and credentials.

## Acceptance

1. Strict typecheck, meaningful unit/integration/MCP tests, coverage above 80%, clean dependency audit.
2. Independent review of authentication, capture isolation and migrations; exact source/bundle hashes.
3. Owner Google sign-in, real saved inquiry/concept/session read/write, receipt replay and reconnect.
4. Unauthenticated access denied; wrong owner refused; independent connection revocation enforced.
5. Assessment/review calls rejected, paid dispatch impossible through this release, controls protected.

Use `npm run build:capture` and `npm run release:check:capture -- <private-evidence.json>`.
Capture evidence records local capture/auth/isolation checks and migration review; it does not claim
model quality, recovery readiness or completion of all later hosted-client journeys. The full-release
gate remains unchanged. Record remote observations separately; creating infrastructure is not proof of
working sign-in or durable capture.
