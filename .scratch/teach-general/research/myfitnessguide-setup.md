# MyFitnessGuide setup as the Teach baseline

Inspected 2026-10-26 from `/Users/hritvikdinkar/repositories/gym-tracker` at
`382f2dcd225b0c76d8e810b6d34233ad2c5e4179`. The root README names the product MyFitnessGuide.
This is a local source/configuration review, not a fresh production check. No files or services in
MyFitnessGuide were changed.

## Reuse the pattern

- Cloudflare Workers and D1 hold product rules and records; ordinary clients use a hosted OAuth MCP
  endpoint without a local privileged adapter.
- `app/worker/src/oauth-entry.ts` uses `@cloudflare/workers-oauth-provider`, MCP resource discovery,
  consent, CIMD and Google sign-in. `connectionId` identifies each authorisation grant across refreshes.
- `app/worker/src/google-oidc.ts` checks Google token signature, issuer, audience, nonce and verified
  email, and returns stable `sub`. Teach maps the verified issuer/subject to its sole learner.
- `app/worker/wrangler.oauth.jsonc` binds the OAuth deployment to D1 and OAuth KV. A separate
  app/API deployment serves the PWA behind Cloudflare Access; this is two delivery surfaces for one
  product record, not two knowledge trackers.
- `app/worker/ACCESS.md` describes private browser controls, scoped service tokens, migration-before-
  deploy order and a deployment guard tied to the actual validated source tree.

Teach will use the established Google OIDC pattern rather than introduce Access-for-SaaS as the MCP
upstream login. It receives its own origin, Google client/callback, OAuth KV, learning database, secrets
and grants. Do not reuse the household's member roles, resource ids, access tokens or production data.
The exact number of deployment entrypoints is implementation packaging; one learner record remains
mandatory. A single Teach Worker can route public OAuth/MCP separately from private control routes.

## Additions that cannot be assumed inherited

- Strong post-acknowledgement revocation, deletion-safe restore fences and trusted merge controls need
  the Teach security ledger design and tests; a connection id alone does not prove those guarantees.
- MyFitnessGuide's Worker source/package manifests inspected here contain no hosted model-call path.
  Its `docs/research/2026-10-07-harness-models-and-runtime.md` is research, not evidence of a deployed
  grading model. Teach's shared independent grader remains an additional component/cost decision.
- Existing backup/runbook references do not establish Teach's encrypted daily 30-day recovery window
  or restoration guarantees. Those require their own operational implementation and tests.
- Reusing scaffolding does not certify Codex, Claude Code and Claude mobile access to Teach; test its
  own credentials and real learning operations on all launch surfaces.

## Source pointers

[README](https://github.com/Hritvik/myfitnessguide/blob/382f2dcd225b0c76d8e810b6d34233ad2c5e4179/README.md),
[OAuth entry](https://github.com/Hritvik/myfitnessguide/blob/382f2dcd225b0c76d8e810b6d34233ad2c5e4179/app/worker/src/oauth-entry.ts),
[Google OIDC](https://github.com/Hritvik/myfitnessguide/blob/382f2dcd225b0c76d8e810b6d34233ad2c5e4179/app/worker/src/google-oidc.ts),
[OAuth config](https://github.com/Hritvik/myfitnessguide/blob/382f2dcd225b0c76d8e810b6d34233ad2c5e4179/app/worker/wrangler.oauth.jsonc),
[Access/deployment runbook](https://github.com/Hritvik/myfitnessguide/blob/382f2dcd225b0c76d8e810b6d34233ad2c5e4179/app/worker/ACCESS.md).
These links identify the source inspected locally; repository access is required.
