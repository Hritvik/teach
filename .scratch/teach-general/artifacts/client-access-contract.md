# Supported clients and access

Status: launch coverage and OAuth approach accepted by the learner on 2026-10-26. Provider details and end-to-end compatibility remain unverified.
Parent: [Choose supported clients and the access boundary](../issues/04-choose-supported-clients-and-the-access-boundary.md).

## Inherited requirements

One General tracker serves one learner through authenticated HTTP MCP. The first usable conversational
release includes remote access, shared state and versioned tutor protocol. No installed client plugin
may become a second source of teaching rules or mastery. The service is private to the learner, not an
anonymous public learning database. Future reader access uses the same authority and is a later phase.

## Confirmed launch coverage

- Claude Code: the full tutor client and specialist-agent integration.
- Codex CLI and the local desktop Codex experience used by the learner: protocol-based conversational
  learning, state reads/writes and reviews; verify these as actual separate launch surfaces rather than
  assuming shared configuration proves both work.
- Claude web and mobile through a remote connector: continue general learning without the learner's
  laptop being available. Test the learner's actual mobile client, account and tool availability.

Other MCP clients remain possible but are not certified by protocol compatibility alone. ChatGPT web,
remote execution environments and future first-party Teach readers are not silently included in this
confirmed support list. Plain protocol access need not imply IDE/debugger parity.

## Documentation evidence checked 2026-10-26

[OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) documents Streamable HTTP,
bearer tokens and OAuth, and shared configuration for supported local Codex surfaces. This establishes
documented mechanisms, not an end-to-end Teach test or account-specific availability.

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp) documents remote HTTP and OAuth
connection setup. Existing local spike calls are historical evidence, not proof of this hosted service.

[Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
documents remote connections originating from Anthropic infrastructure, including mobile, plus OAuth
and fixed request-header credentials. A hosted endpoint must be reachable from that infrastructure;
laptop-only reachability is insufficient. Actual account setup still needs verification.

The earlier handover's statement that Codex configuration is global-only is historical: the current
OpenAI page also documents project-scoped configuration. Installation must use the appropriate current
client scope rather than repeat old commands blindly.

## Confirmed authentication and identity boundary

Use an OAuth sign-in to the learner's private Teach account, with independently revocable
client grants. Use an established provider/library compatible with selected MCP clients; implementation
research must verify discovery, registration/callbacks, token refresh, audience/scopes and revocation.
Independently revocable access means distinct authorisation grants/connections, not an unverified
promise of one grant per physical device. Claude web/mobile or local Codex surfaces may share a grant
through their account/configuration. Verify and document that actual boundary and revocation latency.
The sign-in flow must allow only the intended learner; public client registration never means public
learner registration. The selected provider and login identity are still implementation decisions.

Considered alternative: separately issued, revocable bearer credentials for each client. Official
documentation supports both patterns; the learner selected OAuth for sign-in lifecycle and avoiding manual key handling,
not because a fixed-token route is known to be impossible. Do not implement both merely speculatively.

The tracker derives its learner identity and granted capabilities from verified credentials. A payload's
learner id, agent name, session id or claim of human approval never creates permission. Tokens and
provider secrets stay outside prompts, skills, committed config, tool outputs and ordinary logs.

Distinguish learning reads/writes from learner-control actions: merges require the confirmed approval
policy; credential/grant administration and deletion are not ordinary tutor operations. Exact scope
names and the trusted confirmation mechanism must be designed and tested, rather than trusting an
agent-supplied confirmed=true. Do not promise an unavailable confirmation surface works in all clients.

Specialist write restrictions must be implemented in client allowlists and/or scoped service access,
not inferred from an agent label. The independent-grader contract remains mandatory; verify the
integration path on each selected surface before claiming full assessment parity.

## Release evidence required

For every selected launch surface, test authentication, protocol loading, real state reads/writes,
saved progress, due reviews and continuation from another surface against the same hosted learner record.
Use synthetic/general fixtures and approvals for any external configuration or deployment.

Also test wrong/expired/revoked credentials, capability denial, reconnect and retry, concurrent clients,
invalid payload learner ids, and restricted-control operations. Revoke one client's grant and show that
it cannot read/write while another authorised client still can. Never report “supported” from handshake
alone. If refresh/revocation is selected, prove its exact behaviour under the selected auth provider.

Account/plan availability, mobile tool behaviour and independent-grading orchestration are release
verification gates, not facts established merely by these docs. Provider research is tracked by
[Verify the OAuth provider and client compatibility route](../issues/08-verify-oauth-provider-and-client-compatibility-route.md).
End-to-end tests remain release gates, even after that documentation research.

No client registration, global config edit, credential creation or hosting has occurred in this ticket.

## Research outcome

[OAuth route research](../research/oauth-client-compatibility.md) is complete. It recommends a
colocated Workers OAuth Provider plus an upstream identity check, with Cloudflare Access as its first
candidate. This adds OAuth KV separate from the D1 learning record. Provider pinning, identity setup,
trusted confirmation and explicit revocation consistency must be finalised before readiness; actual
flows remain release tests. The learner confirmed the OAuth approach, not a provider account or plan.

## MyFitnessGuide reuse direction

The learner selected the MyFitnessGuide setup during readiness. Use its verified Worker/D1 and direct
Google OIDC OAuth pattern with Teach's own resources; see the [source review](../research/myfitnessguide-setup.md).
This supersedes the Access-for-SaaS upstream recommendation, not the OAuth or private-learner policies.
Do not infer an existing hosted grader, budget or Teach runtime compatibility from that codebase.
