---
status: superseded by ADR-0002
---

> **Historical decision.** Superseded on 2026-10-26 by [ADR 0002](0002-single-general-tracker.md); the former employer track is removed.

# Two trackers, split by sphere; former employer knowledge never leaves the learner's machine

The learner's knowledge is kept in two trackers that share one schema: a **General tracker**, hosted
online like the gym tracker so any agent or device can continue the learning, and a **former employer tracker**,
kept only on the learner's machine. We split by sphere rather than hosting everything in one place
because the record holds former employer internals (service names, code paths, invariants, the learner's
misconceptions about them, and the wording of their inquiries), and that is employer data that should
not sit on personal infrastructure. The former employer tracker is the only writer to the General tracker from the
learner's machine, and it sends no free text from a former employer session.

## Considered Options

- **One online tracker for everything.** Simplest and reachable everywhere, but it puts employer data on
  personal infrastructure.
- **One online tracker storing former employer concepts as opaque ids**, with their content held locally. Keeps
  phone reviews for everything, but splits every former employer record across two stores.
- **Everything local.** No data risk, but no continuity from claude.ai, other agents or the phone.
- **A private former employer git repository as the store.** No hosting, but claude.ai cannot reach it.

## Consequences

- former employer reviews and former employer lessons happen only on the learner's machine; the phone and claude.ai see
  General knowledge only.
- Links between spheres go one way: a former employer concept may instantiate a General one; nothing in the
  General tracker refers to anything former employer.
- Free text leaks through paraphrase, not through fields, so the boundary is enforced by the session's
  sphere (a structural rule) with a text scanner only as a backstop.
- Amended after review (2026-10-23): a record's concept's sphere decides where its structured fields go,
  and the session's sphere decides where its free text goes. A General concept first proposed in a
  former employer session crosses as an id-only stub. The General tracker also scans text from every client, not
  only from the learner's machine.
