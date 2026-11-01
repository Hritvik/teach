# Teach — agent orientation

Read this first. Teach is a conversation-first lifelong tutor that grows a knowledge graph from the
learner's own inquiries and work. The implementation is one TypeScript Cloudflare Worker backed by D1,
exposed as an OAuth-protected MCP server.

## Current release

The deployed release is **owner-only capture**. It records sessions, inquiries, exposure, concepts,
links, aims, goals, notes and inbox entries. Grading, spaced reviews, model budgets and source fetching
are deliberately absent from the capture entrypoint.

- Worker: `teach-mcp` at `https://teach-mcp.hritvikdinkar.workers.dev`
- Entrypoint: `app/worker/src/capture.ts`
- Deploy config: `app/worker/wrangler.capture.jsonc`
- Deployment record: `docs/superpowers/plans/2026-10-29-teach-capture-deployment.md`

Owner sign-in and the capture write path are verified as of 2026-11-01. A live ChatGPT session ran
`session_start` → `log_inquiry` → `session_end` → `retract`; D1 recorded sequences 1–4, the session
closed, the inquiry disappeared from the inbox, and the retraction remained in audit history. Reads
from a new chat and `history` with a `record_id` both returned the expected records.

Hosted-client notes:
- After a scope change, remove and re-add the connector. Refreshing the tool list does not re-run OAuth
  discovery.
- Writes need the full envelope and the current entity versions in `expected`; `session_end` without
  the session version fails with `VERSION_CONFLICT`.
- `history` requires a `record_id`; it is not a session list.
- `retract` and other destructive tools may require an explicit client confirmation.
- Closed sessions cannot be deleted through the capture surface; the retraction suppresses the
  inquiry but leaves the closed session as history.

## Read in this order

1. `GLOSSARY.md` — agreed domain vocabulary. Use its terms exactly.
2. `docs/superpowers/specs/2026-10-26-teach-general-specification.md` — first-release specification.
3. `docs/superpowers/plans/2026-10-26-teach-general-build.md` — phased build and full-release gates.
4. `docs/superpowers/plans/2026-10-29-teach-capture-deployment.md` — the current limited release.
5. `.scratch/teach-general/map.md` — completed Wayfinder map and accepted decisions.
6. `docs/superpowers/specs/2026-10-23-teach-design.md` — wider product design; later books, feed,
   reader and instrument scope.

`handover/` is historical. Its paths, running services and completed checks describe a different
checkout and machine. Do not rerun its setup or cleanup commands without verifying their targets.

## Layout

| Path | Responsibility |
|---|---|
| `app/domain/` | Pure graph, mastery, priority and scheduler rules. No network or provider calls. |
| `app/worker/src/data/` | D1 migrations, repositories, receipts and projections. |
| `app/worker/src/security/` | Security ledger, scopes, grants, approvals and rate limits. |
| `app/worker/src/auth/` | Google OIDC identity and OAuth provider adapter. |
| `app/worker/src/mcp/` | Strict MCP tool schemas and orchestration. |
| `app/worker/src/grading/` | Assessment, capture and isolated grading jobs (full mode only). |
| `app/worker/src/control/` | Minimal human control pages behind Cloudflare Access. |
| `app/worker/test/`, `tests/` | Unit, integration, MCP and end-to-end tests. |
| `docs/`, `evals/`, `scripts/` | Runbooks, reviewed specs/plans, grading corpus and release tooling. |

## Commands

Use Node.js 26 and npm 11 from the repository root.

```sh
npm ci
npm run check          # strict typecheck + tests with 80% coverage thresholds
npm run build:capture  # build the capture bundle
npm run deploy:check   # run every release check without touching Cloudflare
npm run deploy         # checks, migrations and deploy; requires a clean tree
npm run verify:deploy  # health, OAuth challenge and metadata checks
npm run dev            # local synthetic learner at http://127.0.0.1:8788/mcp
```

`npm run deploy` requires `.state/deploy/capture-approval.json`. The file is private and ignored; it
records the reviewed source and bundle hashes, migration hashes and the operator's approval.

## Rules

- Do not commit secrets, local databases, runtime state or `.state/`. The Worker secrets are
  `GOOGLE_CLIENT_SECRET` and `CONTROL_SESSION_SECRET`; non-secret deployment identity lives in
  `wrangler.capture.jsonc`.
- Ask before creating Cloudflare resources, changing credentials, deploying the full mode or changing
  external services.
- Keep one general tracker. Employer-specific or Meesho-scoped learning is out of scope.
- Preserve the capture/full boundary. The capture entrypoint must not gain grading or scheduled work.
- Cloudflare Workers throws a `TypeError` for `redirect: 'error'`; it does not implement that Fetch
  mode. Use `redirect: 'manual'` or omit it. The auth, control and grading fetches avoid it, and the
  OAuth test fails if it returns.
- `~/repositories/gym-tracker` (MyFitnessGuide) is a reference baseline, not part of this repository.
  Do not modify it from Teach work.
