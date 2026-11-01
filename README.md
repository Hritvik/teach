# teach

A lifelong tutor that grows a knowledge graph from the learner’s inquiries and work. Conversation is the primary mode; books, chapters, assessment and spaced review provide structure.

## Repository status

The immediate milestone is an [owner-only capture deployment](docs/superpowers/plans/2026-10-29-teach-capture-deployment.md). Grading and spaced reviews are deferred in that fixed release mode. Use `npm run build:capture` for its bundle.

The capture Worker is deployed at `https://teach-mcp.hritvikdinkar.workers.dev`. Owner sign-in is verified as of 2026-11-01: Google OAuth completes, `/oauth/token` issues a `teach:read` grant, and live `whoami`, `sessions` and `inbox` calls return. A capture write round trip is still pending. `/health`, the `/mcp` OAuth challenge and the protected-resource metadata are verified by `npm run verify:deploy`.

Imported from `teach.zip` on 2026-10-26, this repository now includes the Phase A–C implementation: domain rules, D1 storage, OAuth/OIDC, authoritative grants, trusted browser controls, independent assessment jobs and persisted review scheduling. Hosted access fails closed without private configuration. External setup and client certification remain pending.

The intended implementation is one TypeScript Cloudflare Worker backed by D1: the **General tracker**,
shared across agents and devices. The Meesho track has been removed by the learner's instruction.
See [ADR 0002](docs/adr/0002-single-general-tracker.md). Employer-specific learning is outside scope.

## Start here

1. Read [AGENTS.md](AGENTS.md), [CONTEXT.md](CONTEXT.md), the [current glossary](GLOSSARY.md) and the
   [single-tracker decision](docs/adr/0002-single-general-tracker.md).
2. Review the [first-release specification](docs/superpowers/specs/2026-10-26-teach-general-specification.md)
   and [phased build plan](docs/superpowers/plans/2026-10-26-teach-general-build.md).
3. Use the [Wayfinder map](.scratch/teach-general/map.md) for accepted decisions and readiness status.
4. The [wider product design](docs/superpowers/specs/2026-10-23-teach-design.md) retains later books,
   feed, reader and instrument scope; its historical revision 7 remains available for reference.
5. The [documentation index](docs/README.md) lists the contracts, runbooks and evaluation corpus.

The selected baseline follows MyFitnessGuide's Worker/D1 and direct Google OIDC OAuth setup, using
Teach-owned resources. The first usable release includes remote conversational learning and shared
independent grading; books, feed and richer instruments follow later. The specification and build plan are approved, and the Wayfinder is complete. The initial grading
budget is US$5/month for Teach inference; no paid dispatch or external setup is authorised by these
planning documents. Phase A implements and tests the hosted tracker foundation locally. There is one hosted product tracker; the local runner is development infrastructure.

## What was imported

- `GLOSSARY.md`: agreed domain vocabulary.
- `docs/adr/`: accepted architecture decision.
- `docs/superpowers/specs/`: reviewed design and supporting findings.
- `docs/superpowers/plans/`: M0 and sync spike plans.
- `handover/`: historical state, decisions, open items, and copied execution evidence.

The original design is preserved as revision 7; the current design, glossary and README reflect the
single-tracker scope. Historical plans and handover files carry supersession notices. macOS metadata and the opaque nested `.7z` file were omitted; the original ZIP remains the source archive.

## Working from this checkout

This repository lives at `~/repositories/teach` with a private `origin`. `main` is the always-deployable branch; work lands through pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md).

The handover describes a different checkout and machine state. Its paths, releases, running services and completed checks are historical claims, not verified facts about this environment. The codewalk implementation, sync spike source and external repositories are **not included** in this archive. Do not rerun the old setup or cleanup commands without verifying their targets.

Store general learning only. Use public sources or synthetic data in examples and spikes. Do not commit tokens, local databases or runtime state. Request approval before committing, pushing, publishing, deploying or changing external services.

## Development and validation

Use Node.js 26 and npm 11. From this directory:

```sh
npm ci
npm run check
npm run build
npm run dev

npm run build:capture
npm run deploy:check
npm run verify:deploy
```

`check` runs strict type checking and unit/integration/MCP tests with coverage thresholds of 80%.
Tests use real local D1 and Durable Object runtimes, including restart persistence and receipt replay.
`build` produces the production entry, which returns 503 without complete private configuration.

`deploy:check` rebuilds the capture bundle and verifies the reviewed release evidence without touching
Cloudflare. `deploy` runs the same gate, applies additive remote D1 migrations and deploys the capture
Worker; it refuses a dirty tree. The approval file is private at
`.state/deploy/capture-approval.json`. `verify:deploy` checks `/health`, the `/mcp` OAuth challenge and
the protected-resource metadata.

`dev` starts a synthetic learner at `http://127.0.0.1:8788/mcp`. Its generated bearer token is saved
privately in `.state/development-token`; configure a development MCP client with that token without
pasting it into chat or committing it. State persists in `.state/runtime`; the runner applies additive migrations with checksum checks. Stop with Ctrl-C.
This runner does not create Cloudflare resources or configure clients automatically.

Phase B local coverage includes signed Google/Access identity checks, real OAuth library token/refresh flows, independent connections, revocation, request limits, CSRF and version-bound merge approvals. See the [hosted setup runbook](docs/runbooks/hosted-setup.md) before external setup. The capture Worker is deployed; the full tutor release is not, and launch clients have not been certified.

Phase C now includes immutable assessment items, trusted public-source capture, isolated key verification/grading jobs, exact-key evaluation, disputes, confidence/help corrections and persistent FSRS review coordination. A separate authoritative ledger enforces inference reservations under the US$5 monthly cap. Paid dispatch defaults disabled; all model responses in tests are synthetic.

See the [grading setup runbook](docs/runbooks/grading-setup.md) and [evaluation corpus](evals/README.md). Human review, a separately approved paid sample and hosted client journeys remain pending. Encrypted backups, deletion and restore follow in Phase D; those controls currently return explicit unavailable responses. The full first release remains gated on those capabilities.

For documentation changes, check local Markdown links and review the current design and glossary for
stale dual-tracker requirements. Imported historical bodies remain available for comparison with the archive.
