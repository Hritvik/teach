# Phase B local implementation evidence — 2026-10-29

## Status

Hosted-access code and local verification are complete. Phase B's approved hosted-client exit evidence
is still pending external setup approval. No Cloudflare/Google/Access resource was created or changed,
no paid model call was made, and no commit, push or deployment was performed.

## Implemented

- Pinned `@cloudflare/workers-oauth-provider`1.2.4: canonical discovery/resource, DCR/CIMD configuration,
  exact library redirect validation, PKCE S256, library-bound consent/state and Google nonce callback.
- RS256 Google identity with exact configured issuer, audience, subject and verified owner email;
  separately verified Access identity with its own issuer/audience/subject namespace.
- Trusted pending grant creation, library authorization and authoritative activation before redirect;
  independent grants survive another authorization. Token exchange and refresh consult the ledger.
- Per-request hosted MCP admission, token/ledger scope intersection, generation checks, bounded JSON,
  exact MCP route, per-grant 60/minute refill with burst 10, registration 5/hour/IP and controls 10/minute/session.
- Access-protected browser connections/revocation, signed Secure HttpOnly SameSite sessions, CSRF and
  exact-origin POST checks. Browser merge previews display versions and consequences; one-use approvals
  bind canonical action, versions and generation. Execution/retry binds a stable request identity.
- Production bundle excludes synthetic development entrypoints; missing private configuration returns 503.
  Release evidence gate checks exact source, bundle and migration hashes and explicit operator records.

## Verification

`npm run check`: typecheck and 178 tests across 17 files pass.
Coverage: statements 93.72%, branches 88.91%, functions 98.70%, lines 98.76%.
`npm run build`: production bundle and synthetic-marker check pass.
`npm audit --audit-level=low`: zero known vulnerabilities.
Release inspection prints artifact hashes and deliberately exits nonzero without approving a release.

Fake signed issuers exercise malicious tokens and owner/audience/nonce failures. An actual OAuth library
integration exercises DCR, consent, signed Google callback, PKCE exchange, two independent connections,
refresh and revocation. The production bundle runs in the Workers runtime for discovery, authentication
boundaries and authoritative registration limits. Real D1/SQLite DO tests exercise controls, approval
contention, persistence, a merge commit followed by a lost acknowledgement and same-request receipt replay.

Independent review findings were resolved with observed failing tests before fixes: implicit revocation
of earlier grants, registration preflight quota consumption, production learner ID mismatch, exact MCP
path matching and uncertain merge acknowledgements. Consent POSTs now return explicit continuation links
to avoid CSP-dependent cross-origin form redirect failures; real browser navigation remains a hosted gate.

## Remaining gates and scope

Follow `docs/runbooks/hosted-setup.md` to prepare private configuration and request external setup approval.
Actual Google/Access sign-in and all selected launch-client journeys are not certified by local tests.
Phase C adds independent grading, persisted review schedules and due-review delivery. Phase D adds
encrypted backup, deletion and restore coordinators; those browser endpoints explicitly report unavailable.
The complete first release remains gated on these later capabilities and approved hosted validation.
