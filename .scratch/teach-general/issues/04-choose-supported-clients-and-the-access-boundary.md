---
title: Choose supported clients and the access boundary
label: wayfinder:grilling
mode: HITL
---

Parent: [Find the way to Teach as a lifelong general tutor](../map.md)
Type: grilling
Status: resolved
Assignee: codex
Blocked by: 01

## Question

Which named agent clients and devices must the first release support, which can wait, and what may
each read or write? Decide the learner identity and credential/authorisation boundary, the role of a
hosted endpoint versus development instances, and what proof of compatibility is required. Separate the
chosen support promise from unverified SDK/authentication facts; graduate precise research tickets once
the support set is chosen. Do not deploy or change credentials to resolve this discussion.

## Inherited constraints

Cross-agent continuity and a remotely reachable General tracker are established product goals.
Worker/D1 and one served teaching protocol were accepted in the reference. Exact first-release client
coverage, remote auth and verified interoperability remain open. Investigate compatibility facts rather
than asking the learner to supply them. Local development is not a second product tracker.

## Dependencies

- [Choose the first useful learning experience](01-choose-the-first-useful-learning-experience.md)

## Release timing constraint

The learner confirmed remote tracker access with the first usable conversational tutor. Define this
contract for M1 + M2 readiness; initial hosting, client access and essential recovery cannot wait for the
books/reader phase. The later M5 phase does not introduce the tracker for the first time.

## Contract artifact

[Client access contract](../artifacts/client-access-contract.md) records the official documentation evidence, confirmed coverage and authentication boundary. Provider details and runtime proof remain pending.

## Answer

### Learner decisions — 2026-10-26

The learner answered “yes” to both recommendations:

- Launch support targets Claude Code, Codex CLI/local desktop, and Claude web/mobile.
- OAuth sign-in grants independently revocable client access to the same private learner record.

The first usable conversational release must demonstrate real learning reads/writes and cross-client
continuation on these surfaces; a handshake is insufficient. This is a support requirement, not a claim
that the service or any client has already been tested. Account access, mobile connector availability
and protocol/independent-grading integration must be verified against the actual launch environment.

The linked access contract retains one private learner identity and tracker-owned authorisation;
caller-supplied identity or approval claims do not grant permission. Concept-merge confirmation,
credential administration and deletion require their own control paths. No anonymous learning access
or extra reader surface was selected.

### Consequences and evidence limits

Current official documentation establishes HTTP MCP and OAuth routes, not the chosen provider or its
end-to-end Teach behaviour. The provider/discovery, registration/callback, refresh, revocation and scope
compatibility question graduates to a research ticket, which blocks final specification readiness.
The bearer-token alternative was considered but not selected for the launch architecture. No provider
account, registration, token or global client configuration has been created or changed.

### Follow-up direction — 2026-10-26

During readiness the learner directed reuse of the MyFitnessGuide setup. The
[local source review](../research/myfitnessguide-setup.md) confirms Worker/D1, OAuth Provider and direct
Google OIDC. Use that sign-in/deployment pattern with Teach-owned resources, replacing the earlier
research recommendation to add Access-for-SaaS upstream. Shared grading and stronger control/recovery
requirements remain additions; no inference budget was selected by this direction.
