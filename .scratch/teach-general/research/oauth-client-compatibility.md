# OAuth route and client compatibility

Researched 2026-10-26. Documentation findings and a proposed architecture, not a deployment or interoperability result.
Parent: [Verify the OAuth provider and client compatibility route](../issues/08-verify-oauth-provider-and-client-compatibility-route.md).

## Recommended route

Use Cloudflare's `@cloudflare/workers-oauth-provider` with auth and MCP resource roles colocated in the existing Teach Worker, plus upstream login through Cloudflare Access for SaaS. Restrict the Access policy and Teach account mapping to this learner. Prefer this bounded Cloudflare-native route over implementing OAuth primitives or adding another identity platform solely for a personal tutor. This is the research recommendation, not a new learner-approved provider choice.

The library offers a combined `OAuthProvider`; its newer split-role example is not a requirement to introduce another tracker. It requires `OAUTH_KV` for authorization state. **D1 remains the single learning store, but this route adds KV for credentials/grants.** Pin the implementation version after verifying its current API; do not copy historical spike pins. [Cloudflare library README](https://github.com/cloudflare/workers-oauth-provider/blob/main/README.md)

Access authenticates the human. Teach's OAuth authorization server issues the MCP-client grants and tokens; an Access session or upstream provider token is not itself proof that an MCP request has Teach permissions. Cloudflare documents Access, third-party identity and managed-provider integrations as distinct routes. [Cloudflare MCP authorization](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/)

Cloudflare's Access-for-SaaS integration provides an OAuth upstream flow and configured policies. Use its approved-user policy for login, then explicitly map the verified identity to the sole Teach learner before completing authorization. Do not enable self-service learner signup merely because OAuth clients may register. The actual account identifier, policy and personal login method must be chosen during setup, with approval. [Access integration guide](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/secure-mcp-servers/)

## Alternatives considered

| Route | Assessment |
|---|---|
| Workers OAuth Provider + Access upstream | Recommended first implementation candidate; keeps MCP grant issuance close to the Worker and uses an upstream policy for human login. Adds OAuth KV and Access setup. |
| Same library + GitHub/Google upstream | Viable documented alternative if the learner prefers an existing personal identity. Still needs Teach's own grants, consent and private-learner mapping; upstream login does not replace MCP authorization. |
| Managed authorization server such as Auth0 | Can move more authorization operations outside Teach, but introduces tenant configuration and a separately operated dependency. No plan/cost entitlement or all-client compatibility was established here. |

Auth0's first-party example configures MCP as a resource server, uses scoped protected tools and enables dynamic registration. Its support guidance identifies the resource-parameter compatibility setting needed to avoid an incorrect audience. This makes it a credible fallback, not a configuration-free substitution. [Auth0 example](https://auth0.com/blog/secure-csharp-mcp-server-with-auth0/), [Auth0 audience guidance](https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0)

## Protocol requirements verified in the library docs

The provider supports pre-registered clients, CIMD and optional DCR. CIMD requires both its enable flag and `global_fetch_strictly_public`; redirect validation includes loopback/native rules. PKCE S256 is required for public clients. Issuer identification is advertised. Grants bind to one canonical resource; unknown/mismatching resources are rejected. Configure the Teach `/mcp` resource explicitly. Its authorization handler must authenticate the learner, obtain consent and select the granted scopes. **`requiredScopes` advertises baseline requirements; application code still enforces operation scopes.** Do not expose all control scopes as the basic learning requirement. [Authorization-server reference](https://github.com/cloudflare/workers-oauth-provider/blob/main/docs/authorization-server.md)

The resource host publishes protected-resource metadata and an unauthenticated Bearer challenge naming it. Token validation must return the correct canonical audience; a different audience is refused. Keep learner and grant context from validated credentials rather than accepting caller identity fields. [Resource-server reference](https://github.com/cloudflare/workers-oauth-provider/blob/main/docs/resource-servers.md)

## Refresh and independent revocation

The library stores per-grant identity and tokens, rotates refresh credentials, and offers grant enumeration/revocation. Revoking a grant removes its associated access-token records and refresh grant. Revoke by the specific grant, not by deleting the entire OAuth client, which affects all its grants. [Storage and lifecycle schema](https://github.com/cloudflare/workers-oauth-provider/blob/main/storage-schema.md)

**Do not promise instantaneous global denial from KV deletion.** Workers KV is eventually consistent; a previously cached value can remain visible in another location for 60 seconds or more, and same-location visibility is not guaranteed. Choose and test an explicit revocation propagation contract. If an immediate security cutoff is required, design an authoritative per-request grant-status check with suitably strong consistency rather than assuming the library's default KV path supplies it. This is a design implication of the storage semantics, not a tested implementation. [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

“Independent client access” means independently revocable **grants/connections**, not automatically one credential per device. Shared client identities, brokered connectors or shared local config may use the same grant across surfaces. Identify the actual grant boundaries during tests; do not promise that revoking Claude mobile leaves its web connector signed in. Test that a separate independently authorized connection survives revoking another.

## Launch-client documentation matrix

| Surface | Documented route | Teach proof still required |
|---|---|---|
| Codex CLI/local desktop | Streamable HTTP OAuth; CIMD/DCR; preconfigured clients and callback options. Local surfaces may share MCP config. | Actual configured app version, login/callback, refresh, tool calls, protocol and independent-grading path; separate-grant behaviour if config is shared. |
| Claude Code | Remote HTTP and OAuth authentication configuration. | Selected flow/registration, refresh and all learning operations through its actual tutor setup. |
| Claude web/mobile | Account-configured remote connectors; the request originates from Anthropic infrastructure. | Account eligibility, connector authentication, mobile tools and whether web/mobile share a grant; phone continuation with laptop unavailable. |

Codex documentation confirms these transport/registration mechanisms and project or user configuration, not an account-specific runtime result. [OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)

Claude Code documents remote OAuth setup. Claude's connector guide documents cloud-originating requests, including mobile, and OAuth/client settings. A laptop-only URL cannot meet that remote path. [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

## Required implementation and release checks

1. Pin a reviewed library/API version and implement its discovery, registration, canonical resource and PKCE paths; test the actual client registration/callback variant rather than forcing one guessed redirect.
2. Prove a verified allowlisted human maps to the sole learner; reject other identities before granting access. Public client registration must not enable public data access.
3. Prove per-operation scope enforcement and trusted learner-control confirmation. Normal tutor credentials must not self-approve a merge or administer credentials/deletion.
4. Test authorization-code replay, wrong audience/issuer/scopes, expired credentials, refresh rotation/races and revoked access under the selected revocation propagation contract.
5. Enumerate named connections/grants. Revoke one specific grant while another independently authorized connection remains functional. Check same-client reauthorization does not unexpectedly invalidate another intended connection.
6. On each launch surface, perform real read/write/review operations and cross-client continuation; test mobile while the laptop is unavailable. A handshake alone is insufficient.
7. Verify whether independent item writing/grading can be orchestrated on each selected surface; the auth research does not prove assessment parity.
8. Include the added OAuth KV/grant state in recovery planning, while keeping learning backup/restore distinct from credentials. Restoration must not silently revive revoked access.

## Result and limits

There is a concrete documented route worth implementing and testing; there is no evidence yet that Teach works with every launch client's account or current OAuth flow. Provider selection can follow this recommendation, but upstream identity setup and a revocation consistency policy still require specification. Runtime compatibility remains a release gate. No signup, credentials, remote configuration, deployment or push was performed.
