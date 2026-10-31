> **Historical — superseded by revision 8 of the [current design](2026-10-23-teach-design.md).** The two-tracker scope below is no longer active.

# teach — a lifelong tutor that grows with the learner

**Date:** 2026-10-23
**Status:** reviewed — design revision 7, approved by the learner for planning M0 and the spike; §5.1's sync layer provisional pending the spike and its LLD (r6 plus round-3 fixes): revision 4 plus the accepted findings of the 2026-10-23 adversarial review. Revision 7: rounds 1–3 of adversarial review dispositioned.
**Author:** hritvik.dinkar (designed with Claude)
**Vocabulary:** [`teach/GLOSSARY.md`](../../../GLOSSARY.md). Every capitalised domain term here is
defined there; where this document and the glossary disagree, the glossary wins.
**Findings:** [`2026-10-23-teach-findings.md`](2026-10-23-teach-findings.md) — facts this design rests on, premise-gated.
**Decisions:** [`docs/adr/0001-two-trackers-split-by-sphere.md`](../../adr/0001-two-trackers-split-by-sphere.md)
**Proof-of-concept target:** `user-returns-service` — the ICUD QC-leak audit-gap fixes (`icud-qc-leak-fixes`), used from time to time to prove the tutor on real work. The build is long-term and its timeline does not follow ICUD.

### Revision history

- **r1** — a course tool: one goal, one syllabus.
- **r2** — a knowledge graph that grows from the learner's inquiries across Meesho, system design and
  CS, with urgent and growth learning held in balance; a shared tracker any agent can continue from.
- **r3** — two trackers with one schema: Meesho knowledge stays on the learner's machine (ADR 0001).
- **r4** — rewritten in the glossary's vocabulary (spheres, aims, mastery states, inquiries and items,
  books); conversation as the primary mode, with books, a feed and other made materials alongside.

## 1. Intent

Hritvik wants wide and deep engineering knowledge, built over many sessions, holding two pulls in
balance:

- **Urgent goals** — concrete work that needs specific understanding soon. The proof-of-concept example is
  the ICUD audit-gap work in URS (durable audit state, reuse on reallocation and reInit, admin
  re-approval, manual approvals reaching the audit, serviceability seeing the verdict, exchange after
  it); the product is built for many such goals over years, not for this one.
- **Growth** — everything else worth knowing: how the Meesho domain fits together across services,
  system design, distributed systems, CS fundamentals. Wandering is welcome. An inquiry about vector
  clocks in the middle of an ODR lesson is not a distraction; it shows where the frontier is.

**Conversation is the primary mode.** The learner enjoys the freedom of talking with an agent and wants
that to stay at the centre. Alongside it they want structured pieces — books with chapters, a feed to
browse at will — that give the visual and psychological satisfaction of finishing something.

Existing tools stop short. `codewalk` produces verified, cited walks (ten exist in URS; six are cited
by the ICUD HLD) but does not teach. `mattpocock-skills:teach` does teach — one topic per workspace
folder, cited lessons, learning records — but by its own documentation has no placement, no scheduled
review, no verified answer keys, and no state outside its folder, so it cannot follow a learner across
subjects, agents or devices (§18). Practice testing and spaced practice rate highest of ten study
techniques reviewed by Dunlosky et al. (2013); summarising and rereading rate lowest.

`teach` is the missing half: a knowledge graph that grows from the learner's own inquiries and work, a
tutor protocol that teaches actively against it, two trackers that let any agent continue the learning,
and made materials — books, a feed, simulators — that turn the learning into something to finish.

## 2. Goals, non-goals, anti-goals

### Goals

- **G1 — Meet the learner where they are.** Any inquiry, in any session, about anything, can grow the
  graph: it is answered, mapped to concepts, and recorded as evidence of where their knowledge ends.
- **G2 — Push the boundary.** As an area's aims are met, the tutor proposes candidates just past it,
  deeper and wider, instead of waiting to be asked.
- **G3 — Keep the gaps.** Every aim not yet met stays visible, so holistic learning comes back for it.
- **G4 — Know what is urgent.** The tutor always knows which gaps block an urgent goal and which are
  growth; the learner sets the balance.
- **G5 — Active and honest.** Lessons make the learner predict, trace, answer, break or build. Every
  fact in an answer key has an anchor. Mastery is derived from dated evidence, never asserted.
- **G6 — Durable.** Reviews bring concepts back before they fade, across sessions, repositories and
  agents. Mastery of code-based concepts is flagged stale when the code moves.
- **G7 — Continue anywhere.** Any MCP-capable agent can read the learner's state, teach against it and
  record evidence — for General knowledge from anywhere, for Meesho knowledge on the learner's machine.
- **G8 — Conversation first, structure alongside.** Sessions are free conversation. Books, chapters and
  the feed exist for when the learner wants structure and the satisfaction of finishing.
- **G9 — Visible.** At any time the learner can see what they know, what is shaky, what is due, what is
  urgent, where the frontier is, and why the tutor chose the next thing.

### Non-goals

- Not a code explainer — `codewalk` is, and `teach` consumes it.
- Not a publishing tool. Nothing is shared with others unless the learner asks.
- Not a multi-learner product in v1. Records are keyed by learner so others can be added later.
- Not a fixed curriculum. Books can be finished; the graph cannot.

### Anti-goals — failure even if it technically works

- **Teaching something false.** An unanchored claim taught as fact is worse than no lesson.
- **Busywork.** Items on what is already Secure (beyond its scheduled review), or ceremony longer than
  the learning.
- **Inflated mastery.** A lenient grader, or credit for recognition when recall was asked, makes a goal
  look ready when the learner is not — and they go into a production change overconfident.
- **Hollow completion.** A chapter marked mastered because it was read. "Read" and "mastered" stay
  separate marks.
- **Sprawl without depth.** A graph of a thousand concepts, each Exposed, has failed G2 as surely as one
  that never grows.
- **Structure crowding out conversation.** If the learner feels steered into a course instead of
  talking freely, G8 has failed.
- **Urgent goals starved by growth, or growth smothered by urgent goals.** The balance is the
  learner's to set.
- **Walls of text.** A lesson that is mostly the tutor talking has regressed into a codewalk.
- **Touching product code.** Exercises run in throwaway worktrees, never on the learner's branch.
- **Meesho knowledge leaving the learner's machine** (ADR 0001).

## 3. What it feels like

> **Monday, URS, Claude Code.** `/tutor`. *"2 reviews due. ICUD `audit-state`: readiness 9 of 14 aims;
> urgent. Today's balance: urgent."* A warm-up review item on consumer redelivery, answered with a
> confidence. Then: *"Next: the ODID lock's critical section. The durable-audit-state write sits inside
> it, so your audit-state goal aims for Transfer; you're at Mechanism. You're Secure on distributed
> locks in general, so I'll bridge rather than teach locks."* The learner predicts from the method
> signature, watches the unit test under the IntelliJ debugger (predicting values at each breakpoint),
> reads the anchored lines, and in a mutation lab predicts which test fails when the lock is removed.
>
> Mid-lesson they ask: *"Would this need vector clocks if two regions wrote the same ODR?"* The tutor
> answers briefly. The inquiry adds `distributed-systems/vector-clocks` as a candidate, and logs the
> inquiry as evidence. Because the session is in the Meesho sphere, the inquiry's wording stays on the
> learner's machine; the General tracker learns only that a candidate was proposed. The lesson returns
> to the lock.
>
> **Thursday evening, phone.** The learner opens the General feed: three review cards, a one-idea card
> on logical clocks from the frontier, and the answer to last week's inquiry about Raft leases. They
> answer the reviews; the cards' evidence is recorded and their review dates move.
>
> **Saturday, laptop, no repository open.** *"Let's do something from growth."* The tutor offers the
> nearest frontier concept: logical clocks, because the learner is Secure on ordering within a Kafka
> partition. A twenty-minute conversation anchored to Lamport (1978) and a DDIA chapter; a short grill at
> Mechanism and Purpose; the concept reaches Solid, and vector clocks joins the frontier. That evening
> the conversation appears as a new chapter in the learner's compiled "Ordering and time" book, marked
> read; its chapter quiz is waiting.

## 4. Principles

1. **One graph, two spheres.** Everything the learner knows lives in one graph, split into the Meesho
   and General spheres. A General concept learned on Saturday is a met prerequisite on Monday.
2. **Growth is demand-driven.** Concepts are added because an inquiry, a goal, a lesson or the frontier
   called for them — never pre-seeded wholesale.
3. **Exposure is not evidence.** Being taught or reading a chapter is exposure. Only answers,
   predictions, teach-backs, inquiries and the learner's own work move mastery.
4. **Evidence is stored; mastery is derived.** Append-only, versioned records are the source of truth;
   mastery is computed by versioned rules. Counts are shown, not scores.
5. **No anchor, no answer key.** A fact appears in an answer key only with an anchor: a code line at a
   commit, or a passage in a named source. The tutor's unanchored knowledge may be taught, labelled as
   such, but never graded against.
6. **Independent grading.** The agent that wrote an item does not grade the answer.
7. **Explain every choice; the learner can override.** Overrides are recorded too.
8. **Degrade loudly.** No repository, no IDE, no tests, no network: say so and fall back.

## 5. Architecture

### 5.1 Two trackers, one schema (ADR 0001)

> **Provisional — sync layer.** The bullets below on the outbox, cache, overlay, version contract, local
> endpoint and daemon lifecycle are provisional. Three review rounds kept finding mechanism changes here
> and nowhere else. They are settled by the spike (A16) and a short sync-contract LLD reviewed after it,
> before M1 fixes the write path. Sphere routing, the allowlist and ADR 0001 are not provisional.

```
 learner's machine (Claude Code, Codex CLI)                 anywhere (claude.ai, phone, any agent)
 ┌──────────────────────────────────────────────┐          ┌──────────────────────────────┐
 │ teach skill + agents + code instruments      │          │ agent + served protocol      │
 │ local reader: Meesho books, feed, simulators │          │ web app: General books, feed │
 └──────────────┬───────────────────────────────┘          └───────────────┬──────────────┘
                │ localhost HTTP MCP (token)                                │ HTTP MCP (auth)
 ┌──────────────▼───────────────────────────────┐  General   ┌─────────────▼────────────────┐
 │ MEESHO TRACKER  (teach-meesho)               │── only ──▶ │ GENERAL TRACKER (teach-general)│
 │ local Worker (workerd) + D1 files            │  guard +   │ Worker + D1 (gym-tracker shape)│
 │ holds the Meesho sphere: concepts, goals,    │  outbox    │ holds the General sphere:      │
 │ inquiries, evidence, items, books, notes     │            │ concepts, goals, evidence,     │
 │ + cached General graph + derived values      │ ◀─ reads ──│ items, books; serves web app   │
 └──────────────────────────────────────────────┘  (cached)  └────────────────────────────────┘
```

- **Two stores, one codebase.** A Meesho store on the learner's machine and a General store hosted
  remotely, each its own database from the first milestone — never one mixed store split apart later.
  From M1 they are **two Worker services** under one local `workerd`: the Meesho tracker and the General
  tracker, each with its own D1 database, joined **only** through the versioned contract below (a service
  binding locally, HTTPS once remote). The Meesho tracker never reads General rows directly, even
  before M5, so the outbox, cache, overlay and version handling run from the first day. M5 deploys the
  General service to Cloudflare and repoints the Meesho tracker at it.
  On the machine, the Meesho tracker keeps a **cache of General data it needs but does not compute**:
  the General graph's structure (ids, links, display fields) and the General tracker's **derived values**
  (mastery per level, FSRS dates, calibration). It holds no raw General evidence and never recomputes
  General derivations. (A raw replica was considered and dropped.) Offline, aim-dependent reads use this
  cache and are marked as cached. One codebase serves both services.
- **Written once, as a Cloudflare Worker on D1, run in both places.** Remotely, the Worker is deployed
  to Cloudflare with D1 (the gym tracker's shape). Locally, the same Worker runs under `workerd`
  (Miniflare), with its D1 databases persisted as SQLite files on the learner's disk; it never contacts
  Cloudflare for its own stores. The local Worker is one long-running process kept alive by a launchd
  agent and serves MCP at `http://localhost:<port>/mcp`, which also makes it the single owner of the
  Meesho database, the outbox and the local reader. All writes are designed as D1 batches (no
  read-then-write transactions), so behaviour is identical in both places. No storage interface and no
  second backend. A spike precedes M1 (A16).
- **One routing rule.** A record's **concept's sphere** decides where its allowlisted structured fields
  go. **The complete General-bound allowlist:** concept id, level, kind, outcome, confidence, hints,
  timestamps, schedule state, misconception id and state, idempotency key, `protocol_version`. Every
  other field — including `at` (repository and commit), item and session references, and agent — is
  routed by the session's sphere like free text. The **session's sphere**
  decides where its free text goes (inquiry wording, misconceptions, teach-backs, notes, chapter text):
  free text from a Meesho session stays in the Meesho tracker, attached to the local copy of the
  record. So evidence on a General concept gathered in a Meesho session reaches the General tracker as
  structured fields only. Meesho concepts, Meesho goals, and items, books and chapters written in a
  Meesho session never leave the machine.
- **General concepts proposed in a Meesho session are stubs.** Every concept id is an opaque, generated,
  immutable value (for example `c_7f3a91`); realm, area, slug and title are display fields. A General
  concept first proposed in a Meesho session is sent as an id-only stub — no slug, title, purpose or
  anchors. Its draft display fields are stored in the **Meesho** database. Before a stub is created, its
  draft title is checked against the cached General titles, so an existing concept is reused rather than
  duplicated. A stub is completed only by **`promote_stub`**, run on the machine: the learner confirms or
  rewrites the title and purpose, the result passes the local scanner (§14.1 rule 3), and it is sent as an
  audited General write. The General tracker has no agents of its own. Until promotion, other devices
  show "untitled candidate", and `needs_you` lists stubs awaiting promotion.
- **Links cross one way.** A Meesho concept may instantiate (or require) a General one, by id. Nothing in
  the General tracker refers to anything Meesho, so it cannot reveal that a Meesho concept exists.
- **The Meesho tracker presents both spheres.** On the learner's machine, agents talk only to the Meesho
  tracker. It reads General state through a cache and merges it, so `needs_you`, `next`, the frontier
  and goal readiness span both. ICUD readiness, for example, counts the General concepts its Meesho
  concepts instantiate.
- **The General tracker stands alone.** Off the machine, agents and the web app see General knowledge
  only.
- **Who computes what across the boundary.** Everything that depends only on evidence — mastery per
  level, Fading, FSRS review dates, calibration — is computed by the General tracker for General
  concepts and consumed by the Meesho tracker as cached values, never recomputed locally. The Meesho
  tracker computes only what depends on aims (gaps, frontier, priority, readiness), because Meesho goals
  hold aims the General tracker cannot see.
- **A versioned contract.** Every call between the trackers carries a `protocol_version`. The General
  tracker accepts the current and previous version; schema changes are additive first, and removals land
  one release after their replacement. A Meesho tracker that sees a newer remote than it understands
  stops merging and says so, rather than merging partially.
- **The outbox.** Each queued write has a stable idempotency key, so a write sent twice is recorded once.
  A write the General tracker refuses is kept, with the refusal reason, as a dead letter shown in
  `needs_you`; it never blocks the writes behind it and is never silently dropped. The local Worker is the one
  process that owns the Meesho database, the outbox drain and the local reader; every agent session
  connects to it over localhost HTTP, so several open sessions never drain the same rows or race for
  the reader's port.
- **Read your own writes.** Evidence still in the outbox (or dead-lettered) is overlaid on the cached
  General values and marked pending: a concept with a pending answer is not offered again as due, and the
  shown mastery says "pending sync" rather than pretending nothing happened.
- **The local endpoint is authenticated.** The localhost MCP requires a per-install bearer token written
  into each MCP client's configuration, checks the `Host` header (against DNS rebinding), and binds only to
  the loopback interface. Without the token, nothing — including `query` — answers.
- **The daemon has a lifecycle.** It is installed at a version-independent path, not inside a plugin cache
  directory. At session start the skill and the daemon exchange versions. The daemon **only moves forward**: on a
  newer skill it restarts on the newer version; an older skill is refused with a message, never served,
  so two sessions on different cached versions cannot flip it back and forth. Local D1 migrations run at
  daemon start, are additive first (removals one release after their replacement), and a daemon refuses
  to start on a database migrated past its own version. The handshake also checks the **minimum
  versions of the plugins teach depends on** — codewalk (anchored-claims mode, range re-location) and
  throughline (`exam` note kind) — and refuses loudly, naming the plugin to update, when one is older. The Node, `workerd`, Miniflare and `ts-fsrs` versions are pinned exactly in a
  committed lockfile.
- **Offline.** General writes from the machine queue in the outbox and drain when reachable; reads fall
  back to the cache, marked as cached. The Meesho tracker's database is backed up to a local encrypted
  location (my call), never to the General tracker.

### 5.2 Parts

1. **The trackers** (`teach-meesho`, `teach-general`) — MCP servers holding the learner's records and
   every computation over them: mastery, frontier, priority, readiness, review dates, chapter marks.
   Modelled on the gym tracker: versioned records with reasons, a write log, read-only SQL over views.
2. **The tutor protocol** — how to teach against the trackers: lesson shapes, modes, hint ladder,
   grading rules, inquiry capture, growth rules. **One source:** a versioned `protocol` resource served
   by the trackers (versioned with `rules_version`). The Claude Code skill loads it at session start
   rather than carrying a copy, and keeps only what is specific to Claude Code (instruments, agents). An
   agent with no plugin installed teaches by the same text.
3. **The `teach` plugin** (Claude Code) — the full client: the skill, three agents (`concept-mapper`,
   `item-writer`, `answer-grader`, each with a frontmatter `tools:` allowlist that excludes every
   tracker write tool; `answer-grader` gets no tracker tools at all, only the item it is handed), the code instruments (codewalk, IntelliJ debugger, mutation labs,
   worked examples), and the material makers (§11).
4. **The readers** — the General tracker's web app (books, chapters, feed, map; mobile-first) and a
   local reader served by the Meesho tracker on the learner's machine, presenting both spheres.

**Why computation lives in the trackers:** every agent must agree on what is Secure, due and next. If
each agent derived it, two agents would disagree within a week. This was the gym tracker's lesson too.

## 6. The knowledge graph

### 6.1 Spheres, realms and concepts

| Sphere | Realm | Examples | Anchors |
|---|---|---|---|
| Meesho | `repo:<name>` | URS: ODID lock critical section; ODR `attributes` JSON; the approval consumer's audit gate; `OrderDetailRequestModelMapper` round trip | Code lines at a commit (codewalk) |
| Meesho | `meesho` | Returns lifecycle across URS, OSM and ship-it; ds-orch QC rules 4/36/42; audit-platform job retention; `mq-client` and the MQ registry; conventions such as nack-with-backoff | Cross-repo code via UCL citations; documents |
| General | `system-design` | Idempotent consumers, outbox pattern, sagas, rate limiting, caching strategies | Named sources |
| General | `distributed-systems` | At-least-once delivery, logical and vector clocks, consensus, replication | Named sources |
| General | `cs` | B-trees and indexes, transactions and isolation, concurrency primitives, complexity | Named sources |
| General | `stack` | Java 8, Spring Boot 2.7 and `@RefreshScope`, JPA, Jackson, Kafka client semantics | Named sources; code lines |

The sphere rule (glossary): a concept is Meesho if understanding it requires knowing something about
Meesho's systems, code, conventions or data; otherwise it is General, wherever the learner first met it.
A concrete Meesho concept and the abstract General concept it embodies are separate concepts, linked by
**instantiates**.

Fields per concept: `id` (opaque, generated, immutable), display fields `realm/area/slug` and title, one-sentence `purpose`, sphere, realm, area,
`origin` (goal · inquiry · lesson · frontier · seed), anchors, created and updated with reasons.

### 6.2 Links

- **requires** — the first concept must be known at least at Mechanism before the second is taught.
- **instantiates** — a concrete concept embodies an abstract one (ODID lock → distributed locks). Drives
  bridge and detour modes, and probes.
- **deepens** — a more advanced treatment of the same subject (logical clocks → vector clocks → hybrid
  logical clocks). Implies requires. Drives "go deeper" proposals.
- **relates** — neighbouring subjects worth knowing together. Drives "go wider" proposals.

### 6.3 How the graph grows

| Trigger | What is added |
|---|---|
| A goal is created (ICUD) | The concepts its work touches, the invariants in play, their prerequisites, each with an aim owned by the goal — proposed by `concept-mapper` from the HLD and codewalks |
| The learner makes an inquiry, in any session, through any agent | The concepts it is about (existing or new); new ones as candidates; the inquiry as evidence |
| A lesson needs a prerequisite the learner lacks | That concept, taught as a detour now or given an aim for later |
| An area's aims are mostly met (frontier push) | Candidates along deepens and relates links, drafted from sources |
| A probe attributes a miss to an abstract concept | That concept, if absent, with an aim |

**Inquiry capture.** The tutor answers first — the learner asked — then maps the inquiry to concepts and
records it. An inquiry is evidence two ways: knowing enough to ask it is a weak positive on the
concept's prerequisites at Recall, and not knowing the answer places the concept at Exposed at most. A
wrongly-phrased inquiry ("isn't the ODID lock per suborder?") records a misconception. An inquiry
nobody can answer with an anchor goes to the **inbox**, with what would resolve it (a UCL search, a
person, a repository to read); resolving it adds anchored facts and, often, concepts.

**Candidates.** A candidate is a concept with no aim. The learner accepts it by giving it an aim, or
lets it be; candidates untouched for 60 days are archived, kept in history (my call). The trackers
report breadth against depth per area, so sprawl is visible.

### 6.4 Levels

| Level | For code | For ideas |
|---|---|---|
| **Recall** (L1) | What does this code say? | What is it? |
| **Mechanism** (L2) | What happens when it runs, including replays, races and failures? | How does it work? Walk an example. |
| **Purpose** (L3) | Why does it exist; what breaks without it? | Why this rather than the alternatives; trade-offs; failure modes |
| **Transfer** (L4) | How would I change it safely for my goal? | Apply it to a new problem; design with it |

### 6.5 Records

Append-only and versioned; the trackers refuse malformed writes.

```json
{"ts":"2026-10-24T10:12:03+05:30","learner":"hritvik","concept":"c_19e4b2",
 "level":2,"kind":"answer","outcome":"wrong","confidence":"sure","hints":0,"source":"grill",
 "item":"i-0142","session":"s-0031","agent":"claude-code","at":"repo:urs@3ea7f7376",
 "misconception":"m_0031","probe_result":"concrete",
 "rules_version":1}
```

- **Evidence** kinds: `answer` · `prediction` · `teachback` · `inquiry` · `observed` (the learner's own
  work, such as a commit touching an anchored concept). Outcomes: `correct` · `partial` · `wrong` ·
  `na`. Confidence (`sure` · `think` · `guess`) is asked with every answer.
- **Exposure** records: being taught, reading a chapter, reading a card. Never raise mastery above
  Exposed.
- **Self-ratings** ("I know this", "unsure") set the starting point of placement only.
- **Overrides** ("skip this, I know it") are honoured immediately and recorded; the concept still gets
  one item at its aim later.

Every write records the agent, the session and where it came from, as the gym tracker records who
wrote, on whose behalf and from where.

### 6.6 Mastery (rules v1, derived)

| State | Rule |
|---|---|
| **Unknown** | no evidence or exposure |
| **Exposed** | exposure or inquiries only |
| **Shaky** | a wrong or partial answer since the last strong correct |
| **Solid** | at least one strong correct, no miss since |
| **Secure** | strong corrects on two different days, latest not a miss |

Flags: **Stale** — a code anchor's lines changed since the last strong correct; **Fading** — the review is
overdue by more than twice its interval. Flags never lower the state.

A **strong correct** is `correct`, no hints, confidence `sure` or `think`. A correct guess or a hinted
correct counts as partial. A strong correct at one level counts as a partial at the level below when that
level has no evidence. Calibration — confidence against outcome — is tracked per learner and per realm.
A confidently wrong answer records a misconception, as does a wrongly-phrased inquiry.

### 6.7 Misconceptions and probes

A misconception is its own record with an opaque id. Its **wording** follows the session's sphere and
stays local when it arose in a Meesho session. Its **closure is decided by the tracker that holds its
counter-example items** — the Meesho tracker for a misconception that arose in a Meesho session, since
those items are Meesho items — which then sends the concept's tracker a structured
`misconception_closed(id)`. The open/closed state and concept id cross as allowlisted fields. It records the specific wrong belief,
in the learner's words where possible. It closes when
the learner answers two different counter-example items correctly on different days.

After a miss on a concrete concept, a **probe** — one quick item on the abstract concept it instantiates —
tells which is missing. Probe right: the gap is in the concrete concept; reteach it. Probe wrong: detour to
the abstract concept first, or give it an aim if the session has no room.

## 7. Aims, goals and urgency

### 7.1 Aims

An **aim** is the level the learner wants on a concept, owned by a goal or by the learner. Everything
about "not known yet" follows from aims:

- **Gap** — mastery below the aim. Derived, never stored.
- **Candidate** — a concept with no aim.
- **Parked** — an aim the learner deferred: kept, not scheduled.
- **Frontier** — concepts with an aim whose prerequisites are met. Derived.

When two owners set different aims on one concept, the higher one applies.

### 7.2 Goals

A goal owns aims. Its source is a throughline effort, an HLD or other document (local, or a Google Doc
through the google-workspace MCP — the URS copy of the ICUD HLD is marked superseded by one), a PR, or
free text. For code goals, `concept-mapper` proposes aims from the change: concepts the work touches →
Transfer; adjacent concepts (calls in or out, or holding an invariant the change must keep) → Purpose;
background → Mechanism; abstract concepts they instantiate → the highest level needed, capped at Purpose.
The learner sees the proposal and edits it before it is saved.

**Readiness** is the count of the goal's aims met, out of its aims.

**Closing a goal.** When a goal closes (done, or abandoned), the learner decides, aim by aim or in bulk,
whether to keep each aim, lower it, or drop it. Kept and lowered aims pass to the learner as owner.

### 7.3 Urgency and balance

- An **urgent goal** is one the learner has marked urgent. A date sharpens its urgency as the date
  nears. An urgent goal untouched for about three weeks is put back to the learner to reconfirm.
- **Growth** is every aim not owned by an urgent goal.
- **Balance** is the learner's split of session time between urgent goals and growth. Default (my call):
  70/30 while any urgent goal exists, otherwise all growth. A session states its balance up front; the
  learner can change it in a word ("growth today").

### 7.4 Choosing what next

For each concept on the frontier:

```
gap        = max(0, aim − level reached)             # in levels, 0..4
urgent     = Σ over urgent goals owning an aim on it: urgency(goal) × weight(aim)
             # weight: Transfer 3 · Purpose 2 · Mechanism 1; urgency rises as a date nears
growth     = readiness_for_it × interest
             # readiness_for_it: prerequisites Solid or better; interest: the learner asked about it,
             # accepted it as a candidate, or it deepens an area they are close to finishing
priority   = gap × (urgent or growth, per the slot being filled)
           × (1 + 0.25 × concepts it unblocks)
           + 2 if it holds an open misconception + 1 if stale
```

The weights are v1 defaults, recorded with `rules_version`.

**Frontier push.** When most of an area's aims are met, the trackers ask the agent to draft candidates
along deepens and relates links from sources. This is how the boundary moves as the learner reaches it.

**Modes** (glossary): bridge, detour, check, counter-example, delta, teach — chosen from the concept's
state and its abstract concept's state. Every lesson opens with a one-line *why this next* produced by
the tracker.

## 8. Sessions and lessons

### 8.1 Conversation first

A session is a conversation. The learner can steer anywhere at any moment: an inquiry, a tangent, "go
deeper", "skip this", "growth today". The tutor's structure — warm-up reviews, a next concept, an exit
ticket — is offered, not imposed, and recedes when the learner is driving. A session that is all
tangents still records its inquiries and evidence, and can still become a chapter (§10.2).

A session has a sphere: Meesho if it starts in a Meesho repository or on a Meesho goal, or from the
moment it first touches anything Meesho, and never General again (§14.1).

### 8.2 Lesson shape

Code concepts follow **PRIMM** over one to three codewalk steps: **Predict** from the signature, names
and beacons (Hermans, *The Programmer's Brain*) → **Run** → **Investigate** (the anchored lines, then
items up to the aim's level) → **Modify** (a mutation lab or a locate task) → **Make** (kept for a goal's
exam). Idea concepts use the same arc: predict an answer → a worked example from a source → items → apply
to a new case → (exam) design with it. A lesson runs only the stages its gap needs.

### 8.3 Instruments

| Instrument | Built on | Used for | Where |
|---|---|---|---|
| Debugger demo | IntelliJ MCP (`xdebug_*`), started from a test's file and line; predict-then-reveal frame values | Run (Mechanism) | Claude Code |
| IDE pointer | `open_file_in_editor` | Investigate | Claude Code |
| Mutation lab | throwaway worktree in the scratchpad; targeted mutation; `mvn -pl <module> test -Dtest=…` in the background | Modify (Purpose): "which test fails?" | Claude Code |
| Worked example, then fading | `docs/golden-prs.md`; git history on touched symbols (ICUD: #1801, #2022); for ideas, a solved problem from a source | The shape of a solution: a solved one, then a half-done one, then the learner's | Any agent |
| Clicker | `AskUserQuestion` with code previews; feed cards | Recall and Mechanism checks, warm-ups, reviews | Claude Code, readers |
| Simulator | a small interactive page (§11) | Mechanism: watch it run, change inputs | Readers |
| Diagram | `make-diagram`; inline SVG | When structure is the lesson | Any |
| Live data | staging DB (read), Trino warehouse (read-only), Grafana | Grounding in real rows and traffic | Claude Code |
| Sources | WebSearch / WebFetch for papers, docs, books; UCL for Meesho | Anchoring General and Meesho facts | Any agent with those tools |

**Mutation-lab findings feed the work.** A mutation that should break an invariant but fails no test is
reported and offered as a throughline item against the goal's effort.

### 8.4 Help and strictness

- **Hint ladder:** nudge → pointer → partial answer → full answer. The rung is recorded; anything past
  the first caps the outcome at partial.
- **Strictness**, per goal, for exercises, mutation labs and the exam's Make step: strict (questions
  only), pseudocode, or collaborative-after-attempt (code only after the learner's own attempt; default,
  my call). **Real production code is not teach's territory:** `coach:handoff` governs it with its own
  dial, and its output feeds teach as evidence (§15).
- **Frustration:** step back, name what is right, isolate the one sticking point, teach it directly.
  "Just tell me" is honoured and recorded as exposure.

### 8.5 Session close

The **exit ticket**: the learner explains the session's main idea in their own words (graded as a
teach-back) and names what is muddiest (it opens the next session). Then one quick "what helped today?"
(debugger, prediction, mutation lab, diagram, worked example, simulator, conversation). Over time the
tutor prefers the instruments that precede this learner's strong corrects.

## 9. Assessment

### 9.1 Grill mode

The tree-and-rounds shape of `mattpocock-skills:grilling`, changed in two ways: answers are **withheld**
until the learner replies, and items test knowledge, not decisions. The tree is the graph around the
topic; the frontier is what the learner is ready to be asked. Difficulty adapts per concept — start at
the level reached (or Mechanism), step up after a strong correct, down after a miss. Up to four numbered
items per round; grades and anchored keys come back together; misses trigger probes in the next round.

### 9.2 Items and the question bank

Item types: `mcq` · `predict` · `trace` · `free` (explain, teach back) · `locate` · `mutation` ·
`design`. Recall and Mechanism lean to mcq, predict and trace; Purpose and Transfer to free, locate,
mutation and design — recognition is not recall.

Each item stores its concept, level, type, stem, anchors, **answer key as points, each with an anchor**,
distractors (drawn from recorded misconceptions where possible), and for code anchors the commit and a
hash of each anchored range.

- **Written** by `item-writer` from codewalk steps or named sources — never from unanchored memory.
- **Verified before first use** — code keys by `codewalk:claim-verifier` in a new **anchored-claims
  mode** that codewalk owns (§15): one item at a time, every key point checked, no sampling, a verdict per
  key point. Source keys by re-opening the passage. An item is verified only when every key point is
  supported. Unverified items are never asked. Verification runs ahead of sessions.
- **Retired** when an anchored range's **text** changes on the repository's default branch (not the
  working tree, so the learner's own uncommitted edits never retire anything). Code that only moved (11
  of 67 ICUD anchors over 21 commits did) is re-pinned, not retired. Re-location is done by a codewalk
  agent (§15), dispatched by the skill **at point of use** — before `item_next` hands out an item with
  code anchors, and before a review of a code concept — and reaches the tracker as `anchor_repinned` /
  `anchor_changed` records. If re-location cannot run (codewalk too old, the repository not on this
  machine, a timeout), the item is **held, not asked**, and `needs_you` says why: an unchecked key is
  never graded against.
- **Portable or not.** Items with exact keys (mcq, predict) can be answered in a reader or any agent
  without a grader. Free-text items need an agent with the grading protocol.
- **Sphere.** An item written in a Meesho session, or using a Meesho example, is a Meesho item even when
  its concept is General.

### 9.3 Grading

`answer-grader` — or, outside Claude Code, the protocol's grading rules — sees only the item, its
verified key and the answer. It returns `correct`, `partial` or `wrong`; the key points missed; a
misconception hypothesis; and whether a probe is warranted. The tutor may ask again but never overrides a
grade.

### 9.4 Chapter quiz

A chapter's quiz runs grill mode over the chapter's concepts up to their aims. It shows a count ("6 of 8
concepts at their aims") and gives the chapter its **mastered** mark when every concept reaches its aim.
It can be retaken any time; it reuses the review schedule, so it never re-asks what was just answered.

### 9.5 Goal exam

When a goal's aims are met: the learner writes their own plan (a fix plan for code goals, a design for
idea goals); `grilling` stress-tests it unchanged; optionally, `artifact-review` lenses attack it. Holes
become evidence at Transfer and, where needed, new aims. The exam also tests the model: if a goal looked
ready and the exam found many holes, the derivation rules are wrong, and that is recorded.

## 10. Books, chapters and the feed

### 10.1 Planned books

Laid out ahead from a goal or an area. The tutor proposes a chapter order from the concepts' requires
links and aims; the learner edits it. Example, the ICUD `audit-state` book: *1. The verdict's journey
(from forward-delivery images to `auditResult`) · 2. The approval consumer and its gate · 3. The ODID
lock · 4. The ODR and its attributes · 5. Where the verdict is lost · 6. Durable audit state · 7. Reuse
on reallocation and reInit.*

### 10.2 Compiled books

Built behind the learner from their sessions. After a session, the tutor proposes a chapter from its
inquiries, answers, worked examples and anchored facts, placed in an existing compiled book on that
subject or a new one; the learner accepts, edits or declines. Conversation stays free; structure
accumulates afterwards. A compiled chapter is marked read on creation (the learner was there) and has a
quiz like any other.

### 10.3 Chapter pages

An article-style page: a short narrative; inline diagrams; code excerpts and source quotations, each
with its anchor; two or three embedded checks (items); a "go deeper" link that opens a conversation about
the chapter in the learner's agent of choice. Scrolling to the end marks it **read** (exposure). The
quiz gives **mastered**.

### 10.4 The feed

An open-ended stream of cards, filtered by sphere, realm or book: due reviews, one-idea explanations from
the frontier, answers to earlier inquiries, small worked examples, diagrams, simulator links. Answering a
card is evidence; reading one is exposure. The feed puts due reviews first and never runs dry — when
nothing is due it draws from the frontier and from books in progress. A "today's set done" marker
appears when the day's due reviews are cleared, so an open-ended feed still has a finish line.

### 10.5 Where they live

General books and the General feed are served by the General tracker's web app and reachable anywhere.
Meesho books, Meesho chapters, the Meesho feed and Meesho simulators are served only by the local reader
on the learner's machine (ADR 0001). The local reader shows both spheres; the web app shows General
only.

## 11. Made materials

Beyond chapters and cards, agents make, on request or when a lesson calls for it:

| Material | What it is | Mainly for |
|---|---|---|
| **Simulator** | a small interactive page: step through vector clocks; replay a redelivered `OdrApprovalRequestMessage` racing a reallocation; toggle the ODID lock and watch the race | Mechanism |
| **Booklet** | a finished book compiled to PDF or EPUB for offline reading | finishing, re-reading |
| **One-pager** | a cheat sheet for a concept or a chapter: the key facts with anchors, the invariants, the common misconceptions | re-entry before work |
| **The map** | the graph drawn by area, chapters and areas lighting up as they reach their aims; the frontier at the edge | the visible sense of progress |
| **Diagram** | via `make-diagram`, at the altitude the lesson needs | structure |

Every material carries the anchors of the facts it states. Meesho materials are written only to the
learner's machine.

## 12. Retention and drift

- **Reviews** are scheduled with **FSRS** (the open-source scheduler Anki adopted; `ts-fsrs`), one
  schedule per concept and level once Solid. It models memory from each review's outcome rather than
  following a fixed ladder.
- **Everywhere.** Due reviews open every session and lead the feed. A `SessionStart` hook in Claude Code
  prints one line when something is due (from the Meesho tracker, which includes cached General state; a
  short timeout; silent on failure). Any agent can call `needs_you`.
- **Code drift.** Code anchors carry their range's text and hash at the last strong correct. The skill
  re-locates anchors at point of use through codewalk's agent (as in §9.2), against the repository's
  default branch; a range that only moved is re-pinned silently. Only when the text itself changed is
  the concept flagged Stale and given a delta lesson: the diff, and an item on whether the old
  understanding still holds. The trackers derive Stale from those records; they cannot see a repository.
  The `SessionStart` hook only prints `needs_you`; it runs no other plugin's code.
- **The learner's own work (later).** Commits and PRs touching an anchored concept are recorded as
  `observed` evidence — enough to schedule a review sooner, never enough for Secure.

## 13. The trackers' tools

Shaped like the gym tracker's: precise reads; every write carries a reason; every record is versioned.
Both trackers expose the same tools; the Meesho tracker's reads span both spheres.

| Group | Tools (draft) |
|---|---|
| Orientation | `whoami` · `needs_you` (due reviews, stale, urgent-goal gaps, inbox, goals to reconfirm; ranked) · `next` (top concepts for a slot — urgent or growth — each with *why*) · `protocol` |
| Graph | `concept_search` · `concept_get` (mastery per level, anchors, links, evidence summary) · `concept_upsert` · `concept_merge` (writes a `merged_into` redirect; the Meesho tracker follows redirects when it refreshes its cache and rewrites its own links) · `link` / `unlink` · `neighbors` · `frontier` · `propose_candidates` · `archive_candidate` |
| Aims | `set_aim` · `park_aim` / `unpark_aim` · `aims` (by owner, goal, realm) · `gaps` |
| Evidence | `record` (batch: evidence, exposure, self-ratings, overrides) · `log_inquiry` (with mapped concepts) · `mastery` · `calibration` · `misconceptions` |
| Inbox | `inbox` · `submit_to_inbox` · `resolve_inbox_entry` |
| Goals | `goal_create` · `goal_get` (readiness, gaps, urgency) · `goal_list` · `goal_update` · `goal_close` (with a decision per aim) · `set_balance` |
| Items | `item_add` · `item_verify` · `item_next` (for a concept and level: verified, not stale, due or unseen) · `item_retire` · `answer` (records, and grades exact-key items) |
| Books | `book_create` · `book_get` (chapters with read and mastered marks) · `chapter_upsert` · `chapter_read` · `compile_chapter` (from a session) · `books` |
| Feed | `feed` (cards for a filter, due first) |
| Sessions | `session_start` · `session_end` (exit ticket, muddiest point, what helped) · `sessions` |
| Notes | `learner_notes` · `write_learner_note` (versioned prose: preferences, reasoning) |
| Records | `amend` · `history` · `retract` |
| Analysis | `query` — one read-only SELECT over curated `v_*` views |

## 14. Safety, data and guardrails

### 14.1 The sphere boundary (ADR 0001)

Records go to their concept's sphere (§5.1), but Meesho detail also leaks through **free text**: a
General inquiry asked in a Meesho lesson, a misconception, an item stem that uses an ODR as its example.
The Meesho tracker is the only writer to the General tracker from the learner's machine, and guards every
write:

1. **Session rule (structural).** From a Meesho session, General writes carry only the allowlisted
   structured fields of §5.1 — nothing else, including no repository, item or session reference. All free text (inquiry wording,
   misconceptions, notes, teach-backs, chapter text) stays in the Meesho tracker, attached to its local
   copy of the record.
2. **Item rule.** An item is General only if written in a General session from General sources.
3. **Local scanner (backstop).** On the learner's machine, every General-bound text field is scanned
   before sending: `com.meesho`, Meesho hostnames, repository paths, known service names (from the
   metadata server, cached locally), and the titles of Meesho concepts. A hit blocks the write and keeps
   it local; it never redacts and sends. This word list is Meesho data and never leaves the machine.
4. **Audit.** Every General write is logged locally with what was sent; `teach-meesho audit` lists every
   outbound text field.

5. **Every writer is guarded, not just the laptop.** The General tracker runs a **separate, Meesho-free**
   scanner on every incoming text field from any client — claude.ai, Codex, the phone — using generic
   patterns only (`com.meesho`, `*.meesho.int`, Meesho URL shapes, Java package paths of the
   `com.<org>` form), and refuses hits. It cannot hold the local word list, so it is weaker: a paraphrase
   or a bare class name typed on the phone can pass it (A18). The served
   protocol tells an off-machine agent that when an inquiry is about Meesho, it answers if it can but
   records nothing, and suggests continuing on the learner's machine.
6. **Purge.** A `purge` operation removes a record's text from the General tracker — the row and its
   version history — and rewrites every retained weekly export that contains it. `retract` is not
   enough, because it keeps history. D1's point-in-time restore window cannot be purged; its retention
   is a known residual (A17), stated to the policy owner in rule 8.
7. **Tested before it ships.** M5 is gated on a test set of Meesho-flavoured text (service and class
   names, ODR examples, paraphrases of Meesho mechanisms), run against **both** paths separately: the
   laptop path (session rule plus local scanner) must keep all of it off the General tracker; the
   off-machine path (remote scanner alone) has its catch rate measured and stated.
8. **Policy before hosting.** M5 is also gated on an answer from Meesho's data-policy owner (found via
   UCL) to one question: may structured learning records made in work sessions, and the backend of a
   plugin distributed from a Meesho marketplace, live on personally run Cloudflare? If not,
   `teach-general` is hosted on infrastructure they approve.

On the learner's machine the plugin configures only the Meesho tracker; the General tracker rejects
writes from that machine that lack the Meesho tracker's signature (my call; mechanism left to the
builder).

### 14.2 Other guardrails

- Never contact `prd.meesho.int`, `int.meesho.int`, `prd.mrouter.int` or `int.mrouter.int` (pattern
  match), except the read-only Trino warehouse through its guarded runner, as URS's CLAUDE.md allows.
- Debugger demos run local unit tests only. Mutation labs run in a scratchpad worktree, are never
  committed or pushed, and are removed afterwards. Staging DB access is read-only.
- No secrets or PII in concepts, items, records or materials; examples use IDs from tests.
- Nothing is shared without the learner asking.

## 15. Integrations and enhancements

| Tool | Change | Why |
|---|---|---|
| **codewalk** (its own releases, in order) | **First:** the sidecar writer preserves keys it does not know, instead of dropping them. **Then:** optional per-step `purpose` (the invariant, ADR or bug it guards) and `tests` (a test file and line that exercises it), added at `schema_version` 1 so older readers still accept them (today's reader refuses any newer version). Pass 5 records the tests it already reads. Also: an anchored-claims mode for `claim-verifier` (§9.2), and **range-level re-location** (today's staleness is per file): for each anchor, report moved (re-pinned) or text changed against a named ref — the one algorithm both codewalk walks and teach items use, exposed to teach as a codewalk **agent** (cross-plugin reuse is by agent, never by running another plugin's `bin/`). M0 refreshes no URS sidecar until these releases are installed. | Purpose-level items need "why"; debugger demos and mutation labs need a runnable test per step. Verified gap: current sidecars carry `n, symbol, file, line, end, tier, what, side_effects, error_handling` only. |
| **codewalk:claim-verifier** | Gains an anchored-claims mode, owned by codewalk (above). | A wrong key teaches the wrong thing confidently; today's contract checks only `read` claims in a finished walk and samples 25. |
| **throughline** | A goal may bind to an effort. Throughline's `comprehension` axis is derived (answered leaves carrying a human-attested review) and cannot be probed, and there is no `understanding` axis; and its `review` note requires eight change-description fields an exam does not have. So throughline gains an **`exam` note kind** (an additive schema change in a plugin the same author owns), and `_comprehension` counts a leaf held by a human-attested review **or** a passed exam. teach writes goal-exam results there. Mutation-lab findings are offered as items. Silent when unbound. | The learning is part of the effort, through the axis throughline already computes, without forging review fields or being overwritten by a later agent review. |
| **grilling** | Used unchanged for goal exams. | Its native purpose. |
| **coach:handoff** | Owns real production code. For goals bound to an effort, teach reads each handoff: the brief's expected delta (the learner's own) becomes `prediction` evidence, scored against the actual change, on the concepts the change touches. Review answers 1–8 count only when the learner wrote them: then `answer-grader` grades them against a key built from the diff, as Transfer evidence. Answers written by the agent are exposure. The human attestation counts only as a self-rating. | Real work becomes the strongest evidence, and one dial governs production code. The same review notes feed throughline's `comprehension` axis. |
| **artifact-review** | Optional exam lenses. | — |
| **make-diagram** | Used unchanged. | Altitudes suit progressive reveal. |
| **UCL** | Anchors for the `meesho` realm; resolves inbox entries. | Cross-service knowledge belongs to UCL. |
| **archaeology** | Optional: find earlier inquiries in past sessions; seed compiled books. | — |
| **IntelliJ MCP** | Used unchanged. | Verified: a debug session can start from a test's file and line. |
| **auto-memory** | No mirror. Preferences live only in tracker `learner_notes`; the `SessionStart` hook prints the current ones. | Two stores for one fact would disagree. |

## 16. Build milestones

Each milestone is usable on its own; every module has tests; each ends with a real session reviewed
against the anti-goals.

| Milestone | Contents | Usable result |
|---|---|---|
| **M0 — codewalk v2** | The codewalk releases of §15 (writer keeps unknown keys; `purpose`/`tests` at schema 1; anchored-claims mode; range-level re-location); **refresh** the six ICUD walks through codewalk's stale path (all six are pinned 21 commits behind HEAD with 19 of 30 cited files changed — findings F13), then add the new fields; re-run claim-verifier | Lessons can say why and find a test, against current code |
| **M1 — tracker core** | After the spike (A16): two Worker services under one local `workerd` — the Meesho tracker (authenticated localhost HTTP MCP) and the General tracker — each with its own D1 database, joined only by the versioned contract, with the routing rule, allowlist, guard, outbox, cache and pending overlay in the Meesho tracker's write and read paths; daemon lifecycle (install path, forward-only version handshake including dependency minimums, additive migrations at start, pinned lockfile); `promote_stub`. Every record carries its session's sphere and every item its provenance. Schema (concepts, links, aims, goals, records, misconceptions, items, books, chapters, sessions, inbox, notes, versions, write log); derived mastery, frontier, priority, readiness, review dates; MCP tools | One source of truth for every agent on the learner's machine, already split by sphere |
| **M2 — the tutor** | `teach` skill and protocol; `concept-mapper`, `item-writer`, `answer-grader`; the ICUD goal and placement; modes; grill mode; inquiry capture and candidates; exit tickets | The ICUD goal runs end to end in conversation, and inquiries grow the graph |
| **M3 — instruments** | Debugger demos, IDE pointer, mutation labs, worked examples with fading, anchored idea lessons | Run and Modify are real; growth lessons work outside code |
| **M4 — books and the local reader** | Planned and compiled books; chapter pages with read and mastered marks; chapter quizzes; the feed; simulators; one-pagers; booklets; the map — all served locally | Structured reading and finishing, on the learner's machine |
| **M5 — everywhere** | **Gated** on the data-policy answer and the leak test set (§14.1). Deploy the same Worker to Cloudflare with D1 and auth; repoint the Meesho tracker at the remote General service, moving the local General database by a one-time export and import in which **every text field is re-scanned** with the M5-gated scanner and hits are held back and listed, not sent; remote Meesho-free scanner; leak audit; `purge`; the protocol served by both trackers; the web app (feed, General books, map); `SessionStart` hook; backups for both | General learning continues from claude.ai, Codex or the phone; Meesho never leaves the machine |
| **M6 — the moving boundary** | Frontier push and the candidate lifecycle; urgency, reconfirmation and balance; calibration views; drift and delta lessons; `observed` evidence; instrument weighting; throughline `exam` notes | The graph grows ahead of the learner and stays true as code moves |

## 17. How we'll know it works

- **Urgent goals (proof of concept):** when ICUD is used as a target, its goals reach readiness and the exam agrees (few holes at Transfer).
- **Growth:** the frontier moves — concepts reaching Purpose or above per month, across realms — not just
  new candidates.
- **Retention:** review accuracy at roughly one week and three weeks out.
- **Model calibration:** derived Secure predicts later correct answers.
- **Continuity:** a session started from a different agent resumes correctly, with nothing lost.
- **Conversation stays primary:** the learner reports feeling free in sessions; most evidence comes from
  conversation, not forced quizzes.
- **Finishing feels good:** chapters reach their mastered mark; the learner returns to the feed by
  choice.
- **No anti-goal hits** in reviewed sessions, and nothing Meesho in the General tracker's audit.
- **The learner's own verdict** after the first goal.

## Assumptions & Unverified Claims

| # | Assumption or claim | Status | How to verify |
|---|---|---|---|
| A1 | The IntelliJ MCP can start a debug session from a JUnit test's file and line in URS and read frame values | Tool schema read; not exercised on URS | Run one demo on an ICUD test in M3 |
| A2 | URS unit tests for the ICUD change sites exist and run offline via `mvn -pl <module> test -Dtest=…` in reasonable time | Not checked | Inventory tests for the six ICUD walks in M0 |
| A3 | The gym tracker's stack (Worker + D1 + auth + HTTP MCP) is reusable here | Inferred from its configuration, tool list and backup script; its source was not found at the path in `~/.claude.json` | Locate the gym-tracker source; reuse its server scaffolding |
| A4 | claude.ai and Codex can connect to the General tracker as a remote MCP with its auth | Works for the gym tracker per its configuration; not verified for these clients | Connect each in M5 |
| A5 | Keeping Meesho knowledge on the learner's machine satisfies employer data policy, and General knowledge on personal infrastructure raises no issue | The learner's decision; policy not checked | The learner confirms if in doubt |
| A6 | Anchors to web sources can be re-opened for verification | Plausible; paywalled sources will fail | Unverifiable sources never key an item |
| A7 | Dunlosky et al. (2013) rate practice testing and distributed practice highest | Read in secondary summaries, not the paper | Read the paper if it becomes load-bearing |
| A8 | Inquiries can be mapped to concepts accurately enough | Untested | Measure in M2: the share of mappings the learner corrects |
| A9 | Mastery rules v1 predict exam outcomes | Untested by design | The exam's calibration check (§9.5) |
| A10 | The session rule plus the scanner keep Meesho detail out of General text | Untested; scanners miss paraphrase, which is why the session rule is structural and the scanner a backstop | Leak audit over the first month of General writes |
| A11 | Merging cached General state into the Meesho tracker's views keeps agents in agreement | Untested | Compare `next` from the machine and from the web app for the same General concepts in M5 |
| A12 | Compiled chapters drafted from sessions are good enough that the learner usually accepts them | Untested | Measure in M4: accepted, edited and declined proposals |
| A14 | An anchored-claims mode of `claim-verifier` can check item keys with the same reliability it checks walks | New mode; untested | Measure on the first ICUD item batch: key points supported, wrong-line, unsupported |
| A15 | Meesho's data-policy owner allows structured learning records from work sessions on personal infrastructure | Not asked | Gate on M5 (§14.1 rule 8) |
| A16 | A Worker run locally under `workerd`/Miniflare is dependable as a long-lived launchd service with D1 persisted to disk, survives plugin upgrades through the lifecycle in §5.1, and Claude Code and Codex connect to its token-authenticated localhost MCP | Officially supported for local development; not tried as an always-on service | Spike before M1: run a gym-tracker-style Worker locally for several days; check restarts, persistence path, MCP from both clients |
| A17 | D1's point-in-time restore keeps data for about 30 days and cannot be disabled | Reported by a reviewer; not checked against Cloudflare's documentation | Check the D1 documentation before rule 8's question is sent |
| A18 | The remote, Meesho-free scanner catches enough off-machine leaks to be worth running | Untested; it is weaker by construction | Measure its catch rate on the leak test set (rule 7) |
| A13 | FSRS (`ts-fsrs`) can schedule per concept and level, with partial outcomes mapped onto its ratings | Plausible; FSRS rates single cards on four grades | Map outcome and hints to FSRS ratings in M1; check against review accuracy |

## 18. Alternatives considered for where the learner's records live

The learner proposed the gym-tracker shape as their current best idea and asked for others. Requirements:
any agent continues the learning; agents agree on derived state; Meesho data stays where it may live;
reviews reachable away from the machine.

| # | Approach | Any agent? | Phone | Data boundary | Cost | Main weakness |
|---|---|---|---|---|---|---|
| A | One online MCP service (gym-tracker shape) | Yes | Yes | Puts Meesho data online | High | Policy |
| B | Git-backed records in a private Meesho repository, with a local MCP | Agents that can run the local MCP | Weak | Strong | Low | Sync conflicts; claude.ai cannot reach it |
| C | Local SQLite with a local MCP | Local agents only | No | Strong | Lowest | No continuity off the machine |
| D | An Artifact's database as the store | Claude Code and claude.ai; not Codex | Yes | Company's Claude account | Low | Derived state computed in two places; limits unverified |
| E | Anki for reviews plus an Obsidian vault for the graph | Partly | Yes | Depends on sync | High glue | Levels, aims and goals fit neither |
| F | One library and MCP, deployed per need | Grows | Later | Per deployment | Medium | — |

**Chosen (ADR 0001):** F, deployed twice — A's shape for the General sphere, C's for the Meesho sphere.
B remains an option for backing up the Meesho tracker to a private Meesho repository if a second machine
ever needs it. From E: FSRS for review scheduling (§12).

### Extending `mattpocock-skills:teach` (considered after review)

An installed `teach` skill already exists: one mission per workspace directory, cited HTML lessons,
learning records, reusable components. By its own documentation it has no placement step, no scheduled
review, and no state outside the workspace folder. The learner chose to build separately: this product
aims deeper (one graph across all subjects, verified answer keys, a learner model that drives choice)
and must work across agents and devices, which a per-folder skill cannot. Its lesson format and
component approach are worth borrowing. Its `/teach` command name is taken, so this plugin's entry point
needs another name.

## 19. Decided, my calls, and left to the builder

**Decided with the learner:** a separate plugin on top of codewalk; codewalk enhanced with purpose and
tests; PRIMM and the four levels; grill mode with withheld answers and adaptive difficulty; `grilling`
for goal exams; evidence-based mastery; adaptation inside and outside the Meesho sphere; debugger demos,
clicker items, golden PRs as worked examples, spaced review; a graph that grows from inquiries across
Meesho, system design and CS, pushing its boundary and keeping gaps; urgent goals against growth with a
balance the learner sets; two trackers split by sphere with Meesho on the learner's machine; abstract
and concrete as separate concepts linked by instantiates; aims owned by goals or the learner, with the
learner deciding each aim when a goal closes; urgent goals marked by the learner, sharpened by dates and
reconfirmed after about three weeks; a session's sphere becoming Meesho on first touch; the glossary's
vocabulary throughout; conversation as the primary mode; planned and compiled books with read and
mastered marks; chapter quizzes; a feed; simulators, booklets, one-pagers and the map.

**My calls (flagged for review):** every computation inside the trackers; one `tutor` skill (in the `teach` plugin) with modes;
the realms in §6.1; candidates archived after 60 days untouched; balance 70/30 while any urgent goal
exists, otherwise all growth; Secure needing two strong corrects on different days; confidence asked on
every answer; strictness collaborative-after-attempt by default; the priority weights in §7.4; FSRS for
reviews; the higher aim winning when owners disagree; compiled chapters proposed after every session;
the "today's set done" marker; the Meesho tracker backed up only to a local encrypted location; the
General tracker rejecting unsigned writes from the learner's machine.

**Left to the builder:** table design beyond the fields named here; exact tool signatures; view
definitions for `query`; the readers' visual design; prompt wording for the three agents and the served
protocol; how verification and compilation are queued; how FSRS ratings map from outcomes; test
fixtures.

## Adversarial Review

Reviewed 2026-10-23 · premise gate on `2026-10-23-teach-findings.md`: ground-truth, premise (1 IMPORTANT,
accepted as F13) · design panel: premise, repo-invariant, ground-truth, completeness, prior-art, structural,
proportionality, cost-model, ownership-boundary · grounding: `docs/design-review/grounding.md` (mostly TODO,
so several lenses ran generic checks) · no figures, so no picture lenses.

| # | Lens | Sev | Finding | Disposition |
|---|------|-----|---------|-------------|
| 1 | premise | IMPORTANT | "Existing tools teach not at all" is false: `mattpocock-skills:teach` (1.3.1, installed) is a stateful tutor (mission, cited HTML lessons, learning records, ZPD); `m-skills:service-quest` quizzes on Meesho services. `/teach` would collide. | **Accepted; learner decided to build separately** — verified `mattpocock-skills/1.3.1/docs/productivity/teach.md`. Problem restated against it (§18). Command named `/tutor` (my call). |
| 2 | premise | MINOR | ICUD is advanced (HLD final, superseded 2026-10-16); its first lesson lands only after M0–M2. | **Resolved by the learner** — the build is long-term; ICUD is an occasional proof-of-concept target, not the timeline driver. Intent and success criteria reworded. |
| 3 | ground-truth, ownership-boundary, prior-art | IMPORTANT | `tl probe --axis understanding` is refused: no such axis; `--checked` required; `comprehension` is derived and unprobeable. | **Accepted** — verified `axes.py:51-107`, `readings.py:_DERIVERS`, `cli.py:3187`. §15 now feeds `comprehension` via human-attested `review` notes. |
| 4 | completeness, ownership-boundary | IMPORTANT | `claim-verifier` "used unchanged" checks only `read` claims in a walk and samples 25. | **Accepted** — verified `claim-verifier.md:9,38`. Anchored-claims mode owned by codewalk; every key point, no sampling (§9.2, §15, A14). |
| 5 | completeness | IMPORTANT | No guard for Meesho text written to the General tracker from claude.ai / phone / Codex. | **Accepted** — §14.1 rule 5. |
| 6 | completeness | IMPORTANT | No way to remove a leak; guard tested only on production writes. | **Accepted** — `purge` (rule 6) and a pre-ship leak test set gating M5 (rule 7). |
| 7 | completeness, repo-invariant, proportionality, structural | IMPORTANT | Outbox undefined: refused writes, duplicate drains, version skew between independently released trackers. | **Accepted** (four-lens convergence) — §5.1 versioned contract, idempotency keys, dead letters in `needs_you`, one daemon owning DB, drain and reader. |
| 8 | structural, repo-invariant | IMPORTANT | §5.1 routed by session, §14.1 by concept — contradictory; General concepts born in Meesho sessions cannot cross without free text. | **Accepted** — one rule (concept sphere → structured fields; session sphere → free text); id-only stubs with opaque ids. ADR 0001 amended. |
| 9 | structural | IMPORTANT | Evidence-only derivations for General concepts computed in both trackers will diverge. | **Accepted** — General tracker owns evidence-only derivations; Meesho tracker owns aim-dependent ones (§5.1). |
| 10 | completeness | IMPORTANT | M5 migration of mixed M1–M4 records undefined; session sphere and item provenance not in schema. | **Accepted** (fields in M1). How the stores are split before M5 is #15. |
| 11 | repo-invariant | IMPORTANT | codewalk v2 sidecars would be refused by cached v1 readers; v1 writer drops unknown keys. | **Accepted** — verified `sidecar.py:168-170, 88-123`. Writer-preserves-unknown-keys ships first; fields added at schema 1; M0 waits for the release. |
| 12 | ownership-boundary | IMPORTANT | Data-policy question is Meesho's, not the learner's alone. | **Accepted** — M5 gated on the policy owner's answer (§14.1 rule 8, A15). |
| 13 | cost-model | MINOR | Line-range hashes retire unchanged code that only moved: 11 of 67 ICUD anchors over 21 commits. | **Accepted** — reproduced with the lens's script. Anchors re-located by content first (§9.2, §12). |
| 14 | repo-invariant | MINOR | Agents' read-only roles stated in prose, not `tools:`. | **Accepted** — §5.2. |
| 15 | structural | IMPORTANT | Both spheres in one store until M5 builds a mixed state to sort later. Alternative: two local stores of the same library from M1. | **Accepted (learner)** — two stores from M1: Meesho local, General remote (with a local replica if useful), via one or two MCPs. |
| 16 | structural | IMPORTANT | Tutor protocol copied in the skill and in each tracker; grading drift becomes permanent evidence. Alternative: the tracker's versioned `protocol` resource is the single source; the skill loads it. | **Accepted (learner)** — §5.2 item 2. |
| 17 | proportionality | IMPORTANT | A storage interface with one backend until M5. Alternative: one D1-semantics implementation, run locally through Miniflare. | **Accepted (learner)** — one Worker on D1, run locally under `workerd` and remotely on Cloudflare (§5.1); spike first (A16). |
| 18 | proportionality | MINOR | M1 builds tables for M4/M6 features before the first ICUD lesson. Alternative: ~7 tables in M1; others added by later milestones. | **Rejected (learner)** — the finding rested on ICUD urgency; the timeline does not follow ICUD. |
| 19 | proportionality | IMPORTANT | No rename/merge for concept ids across the one-way boundary. Alternative: opaque immutable ids plus `merged_into` redirects. | **Accepted** — opaque ids (#8) and `concept_merge` redirects (§13). |
| 20 | prior-art | MINOR | Per-goal strictness overlaps `coach:handoff` (verified `coach/skills/handoff/SKILL.md`). | **Accepted (learner)** — option (a): teach owns learning, handoff owns production code and feeds teach evidence (§8.4, §15). |
| 21 | structural, prior-art | MINOR | Preferences mirrored into auto-memory create a second store. | **Accepted** (two-lens convergence, trivially right) — mirror dropped (§15). |

Unresolved: none. Command name chosen as my call: the plugin stays `teach`, its skill is `tutor` (`/tutor`), avoiding `mattpocock-skills:teach`. No BLOCKER was raised. Revision 5 added new text (§5.1 storage and contract, §14.1 rules 5–8, the handoff integration) that this round did not review.

### Round 2 — 2026-10-23 · lenses: repo-invariant, completeness, structural, ground-truth (on revision 5's new text)

| # | Lens | Sev | Finding | Disposition |
|---|------|-----|---------|-------------|
| R2-1 | ground-truth, completeness, repo-invariant, structural | IMPORTANT | M1/M5 rows still built the rejected mixed store and storage interface; diagram and outbox said "stdio" against §5.1's localhost HTTP. | **Accepted** (four-lens convergence; the r5 edit had prepended instead of replacing) — M1/M5 rewritten, "stdio" removed. |
| R2-2 | ground-truth, completeness, repo-invariant | IMPORTANT | The remote scanner cannot hold the Meesho word list without breaking ADR 0001. | **Accepted** — rule 3 is local-only; rule 5 is a separate Meesho-free scanner with stated weaker coverage (A18); rule 7 tests both paths. |
| R2-3 | completeness | IMPORTANT | Purge misses retained weekly exports and D1 point-in-time restore. | **Accepted** — purge rewrites exports; restore window stated as residual (A17, external — unverified). |
| R2-4 | completeness | IMPORTANT | Localhost MCP unauthenticated while holding the Meesho store and the signing key. | **Accepted** — bearer token, `Host` check, loopback only (§5.1); in the spike (A16). |
| R2-5 | completeness | IMPORTANT | No read-your-writes for pending or dead-lettered General evidence. | **Accepted** — pending overlay (§5.1). |
| R2-6 | repo-invariant | IMPORTANT | launchd daemon has no install, upgrade, migration or pinning story under the lagging plugin cache. | **Accepted** — lifecycle bullet (§5.1), M1 row. |
| R2-7 | repo-invariant | IMPORTANT | `realm/area/slug` ids carry Meesho-derived names past the scanner as "structured" fields. | **Accepted** — opaque generated ids everywhere; display fields of a stub stay local (§5.1, §6.1, §6.5). |
| R2-8 | structural | IMPORTANT | Drift detection placed in trackers that cannot see a repository; algorithm duplicated with codewalk. | **Accepted** — verified `codewalk/bin/cache.py:146-152` is per-file. Range-level re-location added to codewalk; teach records its results (§9.2, §12, §15). |
| R2-9 | structural | IMPORTANT | Exam forced into throughline `review` notes (eight required change fields; a later agent review overwrites it). | **Accepted** — verified `store.py:78-79, 333-336`. New `exam` note kind in throughline; `_comprehension` counts it (§15). |
| R2-10 | ground-truth | MINOR | handoff answers 1–8 are not graded and are usually agent-written. | **Accepted** — verified `coach/skills/handoff/SKILL.md` (agent answers 1–8). Only learner-authored answers count, graded by `answer-grader`; agent answers are exposure. |
| R2-11 | structural | MINOR | A raw General replica would recompute derivations in a second place. | **Accepted** — derived-value cache only after M5. Within the learner's decision #3, which allowed a local copy only where technically useful. |
| R2-12 | structural | MINOR | Misconception lifecycle stranded across spheres. | **Accepted** — misconception is its own record; state follows the concept's sphere, wording the session's (§6.7). |

Round 2 changed mechanism (store layout, scanner split, drift ownership), so by the stop rule another round is warranted before the spec is final; its scope is revision 6's new text only.

### Round 3 — 2026-10-23 · lenses: completeness, structural, repo-invariant (on revision 6's new text)

| # | Lens | Sev | Finding | Disposition |
|---|------|-----|---------|-------------|
| R3-1 | structural, completeness, repo-invariant | IMPORTANT | Drift re-location in a `SessionStart` hook running codewalk's `bin/`: wrong layer (cross-plugin code reuse), wrong trigger (repos never opened), silent on failure, no named ref. | **Accepted** (three-lens convergence) — re-location at point of use via a codewalk agent, against the default branch; unverifiable items held, not asked; hook only prints `needs_you` (§9.2, §12, §15). |
| R3-2 | structural, completeness | IMPORTANT | Stubs cannot be filled (the General tracker has no agents; the title is local) and duplicates go undetected. | **Accepted** — `promote_stub` on the machine through the local scanner; duplicate check against cached General titles (§5.1). |
| R3-3 | completeness, repo-invariant | IMPORTANT | Daemon handshake flip-flops between sessions on different versions; no rule for a database migrated past the code. | **Accepted** — forward-only daemon; additive local migrations; refuse on a newer database (§5.1). |
| R3-4 | repo-invariant | IMPORTANT | No minimum-version check for codewalk and throughline features teach depends on. | **Accepted** — handshake checks dependency minimums and refuses loudly (§5.1). |
| R3-5 | structural | IMPORTANT | Cross-tracker machinery first exercised at M5 because one Worker binds both databases. | **Accepted** — two Worker services joined only by the contract from M1; M5 repoints (§5.1, M1, M5). |
| R3-6 | structural | IMPORTANT | Misconception closure assigned to a tracker that cannot see the counter-example items. | **Accepted** — closure decided where the counter-example items live; `misconception_closed(id)` crosses (§6.7). |
| R3-7 | completeness | IMPORTANT | After M5 the cache lacks the General graph the Meesho tracker's aim computations traverse. | **Accepted** — cache holds the General graph's structure and display fields plus derived values; no raw evidence (§5.1). |
| R3-8 | completeness | IMPORTANT | M5 import uploads M1–M4 text unscanned; stub titles' store unspecified. | **Accepted** — import re-scans every text field and holds back hits; stub drafts live in the Meesho DB (§5.1, M5). |
| R3-9 | repo-invariant | MINOR | Structured-field allowlist incomplete; `at` (repo and commit) would cross. | **Accepted** — one complete allowlist; `at`, item and session references routed by session sphere (§5.1, §14.1). |

Rounds 2 and 3 each still changed mechanism, all of it in the cross-tracker sync layer (§5.1) that is first deployed at M5. See the hand-off note to the learner on how to close this out.
