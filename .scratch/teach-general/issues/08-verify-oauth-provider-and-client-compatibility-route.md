---
title: Verify the OAuth provider and client compatibility route
label: wayfinder:research
mode: AFK
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: research
Status: resolved
Assignee: codex
Blocked by: 04

## Question

Which concrete OAuth architecture can protect Teach's single Worker/D1 MCP service while supporting
Claude Code, Codex CLI/local desktop and Claude web/mobile, one authorised learner and independently
revocable client grants? Compare a small number of current, official, Worker-compatible routes.

Verify protected-resource/authorisation discovery, required client registration and callbacks, scopes,
audience validation, refresh/revocation and learner allowlisting. Distinguish upstream login identity
from the MCP authorization-server role. Cite primary sources and identify implementation tests still
required. Do not claim that documentation proves account eligibility or successful end-to-end calls.

## Execution boundary

Research only. Write findings locally under this effort's research directory. No provider signup,
credential/config changes, deployment, push or remote research branch is authorised. The standalone
repository has no remote; preserve a local research artifact rather than following the skill's generic
push suggestion. Use the research skill's primary-source workflow.

## Dependencies

- [Choose supported clients and the access boundary](04-choose-supported-clients-and-the-access-boundary.md)

## Answer

[OAuth route and client compatibility research](../research/oauth-client-compatibility.md) identifies a
concrete documented candidate: Cloudflare Workers OAuth Provider colocated with the Teach Worker,
with a separate upstream human login and sole-learner mapping. Cloudflare Access is the recommended
upstream candidate; GitHub/Google and managed Auth0 routes were also considered. This is research
advice, not learner approval of a provider account, plan or personal login identity.

The route adds OAUTH_KV for grants/credentials; D1 remains the sole learning store. Operation scopes
must be enforced by Teach handlers. Default KV-backed revocation is eventually consistent, so its
propagation promise must be fixed in the continuity contract; independently revocable access refers
to actual grants/connections rather than assumed physical-device boundaries. Auth state recovery must
not resurrect revoked credentials.

The documentation question is resolved. Client login/callbacks, refresh, scopes, mobile calls and
assessment integration are still executable release checks. Provider selection/pinning, identity setup,
trusted learner-control confirmation and revocation consistency remain explicit design/setup work;
readiness cannot treat the research as successful runtime tests. No external state was changed.
