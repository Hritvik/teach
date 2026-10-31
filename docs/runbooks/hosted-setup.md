# Teach hosted setup — approval required before external changes

This runbook prepares the Phase B access layer. It does not authorize deployment or provider changes.
Use Teach-owned resources. Do not reuse MyFitnessGuide databases, OAuth KV or client credentials.

## Local validation

Use Node 26/npm11. Run `npm ci`, `npm run check`, `npm run build` and `npm audit`.
Fake issuer tests exercise signatures, malicious callbacks, owner restrictions, CSRF and grant revocation.
Real local D1/Durable Object tests prove persistence and atomic admission. These are local evidence;
they do not certify Google sign-in or interoperability with any hosted client.

## Configuration to prepare privately

Choose a canonical HTTPS origin and supply these Worker bindings only after approval:

| Binding | Purpose |
| --- | --- |
| `LEARNING_DB` | Teach's new D1 database; reviewed migrations in `app/worker/migrations` |
| `SECURITY_LEDGER` | SQLite Durable Object class `SecurityLedger`; independent from learning restores |
| `OAUTH_KV` | New namespace for OAuth provider state |
| `TEACH_ORIGIN` | Exact HTTPS origin, with no trailing slash or path |
| `TEACH_LEARNER_ID` | Stable `l_<UUID>` production learner ID, distinct from synthetic fixtures |
| `GOOGLE_SUBJECT` | Verified sole owner's Google subject; obtain through a trusted bootstrap |
| `OWNER_EMAIL` | Exact verified owner email for Google and Access policy mapping |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Teach-specific Google web application credentials |
| `ACCESS_ISSUER` / `ACCESS_AUDIENCE` | Access team origin and application audience for browser controls |
| `CONTROL_SESSION_SECRET` | Random private secret with at least 64 characters; never commit |

Google's registered callback is `<TEACH_ORIGIN>/callback`. OAuth routes are `/authorize`,
`/oauth/token` and `/register`; MCP is `/mcp`. Retain `global_fetch_strictly_public` for CIMD.
Leave native private-use redirect schemes disabled until a selected client demonstrates a need and
that variant receives explicit tests. The library validates exact registered redirects and PKCE S256.

Protect both `/control` and `/control/*` with an Access OTP policy allowing only the configured owner.
MCP/discovery/authorization/callback/token routes remain outside the Access browser challenge.
The Worker independently verifies the Access assertion signature, issuer, audience and owner on each
control request; an identity header alone is insufficient. Google subject and Access subject are distinct.

The checked-in Wrangler configuration intentionally contains no resource IDs, routes or credentials.
Prepare a private deployment configuration with D1/KV/DO bindings and a SQLite DO migration tag;
review it before applying. Provision learning state with `initialise(db,{learnerId})` and configure the
ledger through trusted binding RPC `configureLearner(learnerId)`, which creates no credentials.
Neither initialization is a public HTTP route. Never bootstrap a synthetic grant in production.

## Controls and remaining recovery work

Connections and revocation are browser-only, independently authorized from MCP. The ledger's denial
is authoritative before revocation acknowledgement; OAuth KV cleanup may follow without reversing it.
Control actions require the signed browser session, CSRF token and exact Origin. Approval is bound to
canonical action, target versions, generation and a stable request ID for retry reconciliation.

Deletion and backup/restore endpoints remain explicitly unavailable until the Phase D coordinators and
encrypted storage exist. Persisted review schedules and grading are implemented locally; live inference remains gated by the grading setup runbook. Do not advertise
these unavailable capabilities as working controls.

## Release evidence and gate

`npm run build` rejects synthetic runtime markers in the production bundle. Generate current artifact
hashes using `npm run release:check -- /private/path/inspection.json`, where the input contains
`{"inspect":true}`. Inspection prints hashes and exits nonzero: it is not an approval.
A separately reviewed private release evidence JSON must contain those source, bundle and migration
hashes, successful `checks` (`typecheck`, `tests`, `coverage`, `audit`), `reviewedMigrations:true`,
`hostedClientsVerified:true` and `operatorApproved:true`. The gate rejects stale artifacts or missing
claims. These claims must reflect actual evidence; the file is an operator-controlled record, not an
automated substitute for human deployment authorization. `release:check` performs no deployment.

Before marking hosted clients verified, run approved synthetic hosted exercises on Claude Code,
Codex CLI/desktop and Claude web/mobile: sign-in, real read/write, refresh/reconnect, independent
connections, revoke, rejected old credentials and browser control confirmation. Verify cross-client
progress. Record client versions, observed outcomes and sanitized evidence; a handshake alone fails.
Initial rollout remains gated on the complete first-release specification, including later-phase work.
