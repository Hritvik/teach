---
status: accepted
---

# One General tracker

On 2026-10-26 the learner directed: “Do away with the former employer track, we just need the generic one.”
Teach now covers general learning only, with one General tracker shared across agents and devices.
This supersedes [ADR 0001](0001-two-trackers-split-by-sphere.md).

Retain the previously selected Cloudflare Worker and D1 implementation, authenticated MCP access, versioned protocol
and tracker-owned derivations. Use a local instance for development and testing, then host the single
service with approval. Development state is not a second tracker requiring replication.

Remove sphere fields and routing, the former employer database, cross-tracker contracts and signatures, stubs and
promotion, sync outbox/cache/overlay, the local daemon and employer-policy hosting gates. Employer-specific
learning is outside scope; it is not moved into the General tracker. Concepts, aims, mastery, inquiries,
items, books, feed and review scheduling remain. Historical handover and spike evidence are retained,
but their dual-tracker execution steps no longer govern this build.
