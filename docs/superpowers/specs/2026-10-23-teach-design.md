# teach — a lifelong tutor that grows with the learner

**Date:** 2026-10-23
**Status:** design revision 16 — single General tracker; remote access included with the first usable conversational tutor, confirmed by the learner on 2026-10-26. The revision-7 review applies to the historical design; the changed scope and release plan require their own review.

**Author:** hritvik.dinkar (designed with Claude)
**Vocabulary:** [`teach/GLOSSARY.md`](../../../GLOSSARY.md). Every capitalised domain term here is
defined there; where this document and the glossary disagree, the glossary wins.
**Findings:** [`2026-10-23-teach-findings.md`](2026-10-23-teach-findings.md) — facts this design rests on, premise-gated.
**Decisions:** [ADR 0002 — one General tracker](../../adr/0002-single-general-tracker.md), superseding ADR 0001.
**Scope:** general learning only. Employer-specific learning and repositories are outside this product.

### Revision history

Revisions 1–7 and their review logs are preserved in the [historical revision 7](2026-10-23-teach-design-r7-historical.md).
Revision 8 removes the Meesho track, sphere partition, cross-tracker sync and local daemon. The learning model remains intact.
Revision 9 moves initial General tracker hosting into the first usable conversational release (M1 + M2),
with books, feed and richer instruments later. See the [release decision](../../../.scratch/teach-general/issues/01-choose-the-first-useful-learning-experience.md#answer).

Revision 10 records the reviewed state/write contract and learner-confirmed concept merge policy.
Revision 11 records confirmed mastery defaults, optional confidence during deliberate checks and independent
regrading of disputed assessments; see the assessment contract in §9.3.

Revision 12 confirms launch clients and OAuth access; provider compatibility research and runtime
verification remain outstanding.

Revision 13 records confirmed outage, backup/restore and post-acknowledgement revocation policies.

Revision 14 selects shared independent free-text grading behind the tracker and makes optional
codewalk/instrument checks conditional on enabling their features.

Revision 15 links the consolidated first-release specification and build plan, adopts the inspected
MyFitnessGuide Google OIDC pattern, and records the clarified 30-day recovery-access window.

The [first-release specification](2026-10-26-teach-general-specification.md) and
[build plan](../plans/2026-10-26-teach-general-build.md) consolidate the release contracts. They remain
reviewed and learner-approved, with an initial US$5/month inference cap. The Wayfinder is complete;
the documents do not certify runtime behaviour or authorise deployment/paid calls.

Revision 16 records learner approval of the consolidated specification/build plan and the initial
US$5/month inference cap, completing the Wayfinder planning map.

## 1. Intent

Hritvik wants wide and deep engineering knowledge, built over many sessions, holding two pulls in
balance:

- **Urgent goals** — concrete learning needs with a date or immediate application, such as preparing to design a reliable message consumer.
- **Growth** — system design, distributed systems, CS fundamentals and other general knowledge. Wandering is welcome; an inquiry about vector clocks during a concurrency lesson can reveal the frontier.

**Conversation is the primary mode.** The learner enjoys the freedom of talking with an agent and wants
that to stay at the centre. Alongside it they want structured pieces — books with chapters, a feed to
browse at will — that give the visual and psychological satisfaction of finishing something.

Existing tools stop short. `codewalk` produces verified, anchored code walks but does not teach. `mattpocock-skills:teach` does teach — one topic per workspace
folder, cited lessons, learning records — but by its own documentation has no placement, no scheduled
review, no verified answer keys, and no state outside its folder, so it cannot follow a learner across
subjects, agents or devices (§18). Practice testing and spaced practice rate highest of ten study
techniques reviewed by Dunlosky et al. (2013); summarising and rereading rate lowest.

`teach` is the missing half: a knowledge graph that grows from the learner's own inquiries and work, a
tutor protocol that teaches actively against it, one General tracker that lets any agent continue the learning,
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
  record evidence for general learning from anywhere.
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
- **Storing employer-specific material.** This product is for general learning; it has no employer knowledge track.

## 3. What it feels like

> **Monday, laptop.** `/tutor`: “2 reviews due. Reliable consumers: readiness 9 of 14 aims; urgent.”
> After a warm-up, the learner predicts what happens when a synthetic consumer crashes between a write
> and an acknowledgement. They run a local test, investigate its anchored code, and predict which test
> fails when deduplication is removed. A tangent about vector clocks becomes an inquiry and a candidate.
>
> **Thursday, phone.** The feed shows due reviews, a logical-clocks card and an earlier inquiry's answer.
> Answering cards records evidence in the same tracker used on Monday.
>
> **Saturday, any agent.** A growth session follows the frontier to logical clocks using named sources.
> A short grill reaches Solid; the learner accepts a compiled chapter, marked read with its quiz waiting.

## 4. Principles

1. **One graph, one tracker.** General learning shares one record across agents and devices. A concept
   learned on Saturday is a met prerequisite on Monday. Realms organise knowledge without storage partitions.
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

### 5.1 One General tracker (ADR 0002)

- **One service and database.** A TypeScript Cloudflare Worker backed by D1 is the authoritative General
  tracker. Local development uses the same Worker with a disposable local D1 database; it is a development
  environment, not a second tracker or a replica of the hosted learner record.
- **Direct access.** The first usable conversational release includes the remotely accessible tracker.
  MCP-capable agents connect directly to the authenticated HTTP MCP endpoint. The
  web reader uses the same service and derived state. There is no local proxy or always-on daemon.
- **One owner of computation.** The tracker derives mastery, Fading, review dates, calibration, gaps,
  frontier, priority and readiness. Clients never maintain competing versions of these derivations.
- **Writes.** Validate input, record provenance and reasons, use stable idempotency keys and versioned
  records, and design atomic writes as D1 batches. Surface refused writes with their reasons. Clients
  retain the same key when retrying an uncertain write; no automatic offline queue is specified.
- **Protocol and upgrades.** The tracker serves the versioned tutor protocol and checks compatible client,
  rules and schema versions. Migrations are additive first; older code must refuse a newer schema.
  Pin implementation dependencies in the lockfile. Deployment and migration order belong in the M1 plan.
- **Authentication.** The hosted endpoint requires authentication and learner authorisation for reads and
  writes. The learner selected OAuth with independently revocable client grants. Verify the concrete provider
  and mechanism against target clients before hosting; never embed credentials
  in a skill. Local development binds to loopback and authenticates access with Host/Origin checks.
- **Availability.** On network failure, say that state cannot be read or saved; conversation may continue
  with new progress explicitly unsaved. Reconcile uncertain writes and offer to capture recoverable
  work on reconnect. Do not claim persistence until acknowledged. Offline exports remain readable;
  offline record sync is outside the initial scope.
- **Data lifecycle.** Encrypt daily recovery backups and expire access/restore through Teach within 30 days by creation age,
  independently of subsequent backup success. Restore requires learner confirmation and discloses its
  recovery point/possible loss of newer work; deleted records and revoked access must not resurrect.
  Physical encrypted-storage cleanup may lag, as accepted by the learner; disclose that distinction.
  Show backup failures and actual recovery coverage. Keep credentials separate from learning exports.
- **Revocation.** After revocation acknowledgement, new requests from that grant are refused for reads
  and writes. Already-admitted requests may finish. The default eventually consistent OAuth candidate
  needs an authoritative fail-closed gate or equivalent verified mechanism to meet this requirement.

The two-tracker machinery is removed: sphere routing, inter-service contracts, cross-tracker allowlists,
stubs and `promote_stub`, signatures from a local proxy, sync outbox/dead letters, derived-value cache,
pending overlay and launchd lifecycle. The old sync spike is historical evidence, not a build gate.
No hosting or deployment is authorised by this design update.

Launch targets are Claude Code, Codex CLI/local desktop and Claude web/mobile. Each must pass real
learning reads/writes, protocol loading and cross-client continuation tests before the first release.
The [client access contract](../../../.scratch/teach-general/artifacts/client-access-contract.md) records
this confirmed scope and the private-learner authorization boundary. It does not certify interoperability.
[OAuth provider research](../../../.scratch/teach-general/issues/08-verify-oauth-provider-and-client-compatibility-route.md)
documents a candidate; the learner subsequently selected the inspected MyFitnessGuide direct Google
OIDC pattern. Actual client and credential lifecycle tests remain release gates.

The [continuity and recovery contract](../../../.scratch/teach-general/artifacts/continuity-and-recovery-contract.md)
defines retries, resumption, recovery generations, backup expiry, deletion-preserving restore cutover and
revocation. Its [resolved decision](../../../.scratch/teach-general/issues/05-define-continuity-and-recovery-promises.md#answer)
records the learner's confirmation and reviewed safeguards. Provider-managed retention and concrete
recovery/auth mechanisms still require implementation design and validation before hosting.

### 5.2 Parts

1. **The General tracker** (`teach-general`) — an MCP server holding the learner's records and
   every computation over them: mastery, frontier, priority, readiness, review dates, chapter marks.
   Modelled on the gym tracker: versioned records with reasons, a write log, read-only SQL over views.
2. **The tutor protocol** — how to teach against the tracker: lesson shapes, modes, hint ladder,
   grading rules, inquiry capture, growth rules. **One source:** a versioned `protocol` resource served
   by the tracker (versioned with `rules_version`). The Claude Code skill loads it at session start
   rather than carrying a copy, and keeps only what is specific to Claude Code (instruments, agents). An
   agent with no plugin installed teaches by the same text.
3. **The `teach` plugin** (Claude Code) — the full client: the skill, three agents (`concept-mapper`,
   `item-writer`, `answer-grader`, each with a frontmatter `tools:` allowlist that excludes every
   tracker write tool; `answer-grader` gets no tracker tools at all, only the item it is handed), the code instruments (codewalk, IntelliJ debugger, mutation labs,
   worked examples), and the material makers (§11).
4. **The shared grading service** — a protected model invocation behind the tracker for free-text
   assessment on every launch client. It receives only the supplied item/key, answer and essential
   context, has no tracker-write access and returns a constrained result validated by the tracker.
   It is distinct from tracker-owned deterministic computation, not a second learner database.
5. **The reader** — the General tracker's web app (books, chapters, feed, map; mobile-first). The same
   reader can run against the development service; offline book exports are separate artifacts.

**Why computation lives in the tracker:** every agent must agree on what is Secure, due and next. If
each agent derived it, two agents would disagree within a week. This was the gym tracker's lesson too.

## 6. The knowledge graph

### 6.1 Realms and concepts

| Realm | Examples | Anchors |
|---|---|---|
| `system-design` | Idempotent consumers, outbox pattern, sagas, rate limiting, caching | Named sources |
| `distributed-systems` | Delivery guarantees, logical and vector clocks, consensus, replication | Named sources |
| `cs` | B-trees, transactions, concurrency primitives, complexity | Named sources |
| `stack` | Language, framework and database semantics | Official documentation; public or synthetic code |
| `repo:<name>` | A public or learner-owned example consumer and its tests | Code lines at a commit |

A concrete concept and the abstract concept it embodies remain separate, linked by **instantiates**.
Realms organise the graph; no sphere field or storage partition is needed.

Fields per concept: opaque generated immutable `id`, display fields `realm/area/slug`, title,
one-sentence `purpose`, `origin` (goal · inquiry · lesson · frontier · seed), anchors, and creation/update
metadata with reasons.

### 6.2 Links

- **requires** — the first concept must be known at least at Mechanism before the second is taught.
- **instantiates** — a concrete concept embodies an abstract one (example consumer lock → distributed locks). Drives
  bridge and detour modes, and probes.
- **deepens** — a more advanced treatment of the same subject (logical clocks → vector clocks → hybrid
  logical clocks). Implies requires. Drives "go deeper" proposals.
- **relates** — neighbouring subjects worth knowing together. Drives "go wider" proposals.

### 6.3 How the graph grows

| Trigger | What is added |
|---|---|
| A goal is created (reliable consumers) | The concepts its work touches, the invariants in play, their prerequisites, each with an aim owned by the goal — proposed by `concept-mapper` from the goal brief, sources and codewalks |
| The learner makes an inquiry, in any session, through any agent | The concepts it is about (existing or new); new ones as candidates; the inquiry as evidence |
| A lesson needs a prerequisite the learner lacks | That concept, taught as a detour now or given an aim for later |
| An area's aims are mostly met (frontier push) | Candidates along deepens and relates links, drafted from sources |
| A probe attributes a miss to an abstract concept | That concept, if absent, with an aim |

**Inquiry capture.** The tutor answers first — the learner asked — then maps the inquiry to concepts and
records it. An inquiry is evidence two ways: knowing enough to ask it is a weak positive on the
concept's prerequisites at Recall, and not knowing the answer places the concept at Exposed at most. A
wrongly-phrased inquiry ("doesn't at-least-once delivery prevent duplicates?") records a misconception. An inquiry
nobody can answer with an anchor goes to the **inbox**, with what would resolve it (a named source, an experiment, or
a public repository to read); resolving it adds anchored facts and, often, concepts.

**Candidates.** A candidate is a concept with no aim. The learner accepts it by giving it an aim, or
lets it be; candidates untouched for 60 days are archived, kept in history (my call). The tracker
reports breadth against depth per area, so sprawl is visible.

### 6.4 Levels

| Level | For code | For ideas |
|---|---|---|
| **Recall** (L1) | What does this code say? | What is it? |
| **Mechanism** (L2) | What happens when it runs, including replays, races and failures? | How does it work? Walk an example. |
| **Purpose** (L3) | Why does it exist; what breaks without it? | Why this rather than the alternatives; trade-offs; failure modes |
| **Transfer** (L4) | How would I change it safely for my goal? | Apply it to a new problem; design with it |

### 6.5 Records

Append-only and versioned; the tracker refuses malformed writes.

```json
{"ts":"2026-10-24T10:12:03+05:30","learner":"hritvik","concept":"c_19e4b2",
 "level":2,"kind":"answer","outcome":"wrong","confidence":"sure","hints":0,"source":"grill",
 "item":"i-0142","session":"s-0031","agent":"claude-code","at":"repo:example-consumer@abc1234",
 "misconception":"m_0031","probe_result":"concrete",
 "rules_version":1}
```

- **Evidence** kinds: `answer` · `prediction` · `teachback` · `inquiry` · `observed` (the learner's own
  work, such as a commit touching an anchored concept). Outcomes: `correct` · `partial` · `wrong` ·
  `na`. Confidence (`sure` · `think` · `guess`) is requested during deliberate checks, not ordinary
  conversation, and may be skipped. Missing confidence is recorded as unknown, never as a wrong answer.
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
| **Secure** | strong corrects on two different learner-local calendar days, no subsequent miss |

Flags: **Stale** — a code anchor's lines changed since the last strong correct; **Fading** — the review is
overdue by more than twice its interval. Flags never lower the state.

A **strong correct** is correct content, no content-bearing hints or answer reveal, and confidence
`sure` or `think`. Keep the content grade separate from credited evidence strength: a correct guess or
helped answer does not prove independent understanding. Unknown confidence does not qualify as strong,
but omission alone never demotes mastery. Neutral clarification and accessibility help are not hints.
Any inferred evidence at another level must be marked as derived; it cannot fabricate a direct failed
answer or demote mastery. Calibration compares reported confidence with outcome per learner and realm.
A confidently wrong answer may indicate a misconception, as may the phrasing of an inquiry.

### 6.7 Misconceptions and probes

A misconception is its own record with an opaque id, concept id and the specific wrong belief,
in the learner's words where possible. The tracker stores its wording and open/closed state together.
It closes when the learner answers two different counter-example items correctly on different days.

After a miss on a concrete concept, a **probe** — one quick item on the abstract concept it instantiates —
tells which is missing. Probe right: the gap is in the concrete concept; reteach it. Probe wrong: detour to
the abstract concept first, or give it an aim if the session has no room.

### 6.8 State and write contract

The [state and write contract](../../../.scratch/teach-general/artifacts/state-and-write-contract.md)
is the planning baseline for authoritative records, agent write ownership, provenance, concurrent
updates, corrections, idempotency and concept merges. Merging existing concepts requires learner
confirmation; ordinary learning capture and reuse of an existing concept do not require per-record approval.
See the [resolved decision](../../../.scratch/teach-general/issues/02-define-learning-state-and-write-ownership.md#answer)
for its provenance and review. Exact implementation schemas remain builder-owned.

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

A goal owns aims. Its source is a general-learning brief, an optional throughline effort, a public
design document, a learner-owned example PR, or free text. For code goals, `concept-mapper` proposes aims from the change: concepts the work touches →
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

**Frontier push.** When most of an area's aims are met, the tracker asks the agent to draft candidates
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

A session records its goals, inquiries, evidence and provenance in the General tracker. It has no sphere
field. Employer-specific material is outside scope (§14.1).

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
| Worked example, then fading | `docs/golden-prs.md`; git history on public or learner-owned example symbols; for ideas, a solved problem from a source | The shape of a solution: a solved one, then a half-done one, then the learner's | Any agent |
| Clicker | `AskUserQuestion` with code previews; feed cards | Recall and Mechanism checks, warm-ups, reviews | Claude Code, readers |
| Simulator | a small interactive page (§11) | Mechanism: watch it run, change inputs | Readers |
| Diagram | `make-diagram`; inline SVG | When structure is the lesson | Any |
| Example data | synthetic fixtures and public datasets | Grounding ideas in concrete examples | Any agent |
| Sources | WebSearch / WebFetch for papers, docs, books | Anchoring general facts | Any agent with those tools |

**Mutation-lab findings feed the work.** A mutation that should break an invariant but fails no test is
reported and offered as a throughline item against the goal's effort.

### 8.4 Help and strictness

- **Hint ladder:** nudge → pointer → partial answer → full answer. Record the help given. Any
  content-bearing hint prevents strong-correct credit while preserving the actual content grade;
  neutral clarification or accessibility help does not count as a content hint.
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
  working tree, so the learner's own uncommitted edits never retire anything). Code that only moved is re-pinned, not retired. Re-location is done by a codewalk
  agent (§15), dispatched by the skill **at point of use** — before `item_next` hands out an item with
  code anchors, and before a review of a code concept — and reaches the tracker as `anchor_repinned` /
  `anchor_changed` records. If re-location cannot run (codewalk too old, the repository not on this
  machine, a timeout), the item is **held, not asked**, and `needs_you` says why: an unchecked key is
  never graded against.
- **Portable or not.** Items with exact keys (mcq, predict) can be answered in a reader or any agent
  without a grading model. Free-text answers use the shared independent grading service on every launch client.
- **Provenance.** Items record their sources and verification history; use general, public or synthetic examples.

### 9.3 Grading

Free-text answers use the shared independent grading service behind the tracker on all launch clients.
Its isolated grading invocation sees only the versioned item, verified key, answer and essential question
context, with no unrelated history or tracker write credentials. It returns `correct`, `partial` or
`wrong`, missed key points, a misconception hypothesis and whether a probe is warranted. The tracker
validates and commits the result; the tutor never substitutes its own grade. Exact-key items remain
deterministically graded. If the service is unavailable, free-text answers stay pending/ungraded;
conversation and verified exact-key checks can continue without claiming a completed assessment.

The [integration contract](../../../.scratch/teach-general/artifacts/integration-and-dependency-contract.md)
and [resolved integration decision](../../../.scratch/teach-general/issues/06-choose-the-teaching-integration-and-dependency-boundary.md#answer)
define this boundary. The Claude Code answer-grader role must use this shared path; native specialist
instructions do not constitute a second independently authoritative grading implementation. Model,
cost/privacy limits, isolation enforcement and job semantics require specification and release tests.

A challenged grade triggers independent regrading against the same anchored item/key version. Mark
affected progress provisional, preserve the original answer and grade, and apply any correction through
version-checked amendments and projection replay. Neither the learner's objection nor the tutor's
preference automatically turns a grade into correct. Material unresolved disputes cannot certify readiness.

The [assessment and review contract](../../../.scratch/teach-general/artifacts/assessment-and-review-contract.md)
defines the planning constraints for attempts, review occurrence coordination, confidence, disputes and
rule replay. See the [resolved assessment decision](../../../.scratch/teach-general/issues/03-define-trustworthy-assessment-and-review-behaviour.md#answer)
for learner confirmation and review provenance. Exact scheduling mappings remain implementation design.

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
links and aims; the learner edits it. Example, a “Reliable consumers” book: *1. Delivery guarantees ·
2. Acknowledgements and retries · 3. Idempotency · 4. Concurrent deliveries · 5. Crash recovery ·
6. Testing failure paths.*

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

An open-ended stream of cards, filtered by realm or book: due reviews, one-idea explanations from
the frontier, answers to earlier inquiries, small worked examples, diagrams, simulator links. Answering a
card is evidence; reading one is exposure. The feed puts due reviews first and never runs dry — when
nothing is due it draws from the frontier and from books in progress. A "today's set done" marker
appears when the day's due reviews are cleared, so an open-ended feed still has a finish line.

### 10.5 Where they live

Books, chapters, the feed and simulators are served by the General tracker's web app. Exported booklets
can be read offline; read marks and answers are persisted only when acknowledged by the tracker.

## 11. Made materials

Beyond chapters and cards, agents make, on request or when a lesson calls for it:

| Material | What it is | Mainly for |
|---|---|---|
| **Simulator** | a small interactive page: step through vector clocks; replay a duplicate message racing a retry; toggle a consumer lock and watch the race | Mechanism |
| **Booklet** | a finished book compiled to PDF or EPUB for offline reading | finishing, re-reading |
| **One-pager** | a cheat sheet for a concept or a chapter: the key facts with anchors, the invariants, the common misconceptions | re-entry before work |
| **The map** | the graph drawn by area, chapters and areas lighting up as they reach their aims; the frontier at the edge | the visible sense of progress |
| **Diagram** | via `make-diagram`, at the altitude the lesson needs | structure |

Every material carries the anchors of the facts it states. Materials use general knowledge and public
or synthetic examples.

## 12. Retention and drift

- **Reviews** are scheduled with **FSRS** (the open-source scheduler Anki adopted; `ts-fsrs`), one
  schedule per concept and level once Solid. It models memory from each review's outcome rather than
  following a fixed ladder.
- **Everywhere.** Due reviews open every session and lead the feed. A `SessionStart` hook in Claude Code
  prints one line when something is due (from the General tracker; a short timeout; silent on failure). Any agent can call `needs_you`.
- **Code drift.** Code anchors carry their range's text and hash at the last strong correct. The skill
  re-locates anchors at point of use through codewalk's agent (as in §9.2), against the repository's
  default branch; a range that only moved is re-pinned silently. Only when the text itself changed is
  the concept flagged Stale and given a delta lesson: the diff, and an item on whether the old
  understanding still holds. The tracker derives Stale from those records; it cannot see a repository.
  The `SessionStart` hook only prints `needs_you`; it runs no other plugin's code.
- **The learner's own work (later).** Commits and PRs touching an anchored concept are recorded as
  `observed` evidence — enough to schedule a review sooner, never enough for Secure.

## 13. The tracker's tools

Shaped like the gym tracker's: precise reads; every write carries a reason; every record is versioned.
All clients use the General tracker and its derived state.

| Group | Tools (draft) |
|---|---|
| Orientation | `whoami` · `needs_you` (due reviews, stale, urgent-goal gaps, inbox, goals to reconfirm; ranked) · `next` (top concepts for a slot — urgent or growth — each with *why*) · `protocol` |
| Graph | `concept_search` · `concept_get` (mastery per level, anchors, links, evidence summary) · `concept_upsert` · `concept_merge` (writes a `merged_into` redirect followed by all reads and graph traversals) · `link` / `unlink` · `neighbors` · `frontier` · `propose_candidates` · `archive_candidate` |
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

### 14.1 General learning only

The service stores general learning. Employer-specific systems, code, conventions, datasets and private
work artifacts are outside scope. The tutor must not ingest or upload them. Use public sources,
learner-owned examples and synthetic fixtures. There is no local employer tracker, routing rule,
redaction pipeline, cross-tracker scanner or employer-policy hosting gate.

### 14.2 Other guardrails

- Authenticate and authorise every tracker operation; validate inputs and restrict `query` to read-only views.
- Debugger demos and mutation labs run local tests in disposable example worktrees. Never change the
  learner's working branch or connect to production systems as part of an exercise.
- No secrets or PII in concepts, items, records or materials; examples use synthetic identifiers.
- Nothing is shared without the learner asking. Keep backup retention and deletion limits explicit.
- Review the hosting plan and obtain approval before deployment or external configuration changes.

## 15. Integrations and enhancements

| Tool | Change | Why |
|---|---|---|
| **codewalk** (its own releases, in order) | **First:** the sidecar writer preserves keys it does not know, instead of dropping them. **Then:** optional per-step `purpose` (the invariant, ADR or bug it guards) and `tests` (a test file and line that exercises it), added at `schema_version` 1 so older readers still accept them (today's reader refuses any newer version). Pass 5 records the tests it already reads. Also: an anchored-claims mode for `claim-verifier` (§9.2), and **range-level re-location** (today's staleness is per file): for each anchor, report moved (re-pinned) or text changed against a named ref — the one algorithm both codewalk walks and teach items use, exposed to teach as a codewalk **agent** (cross-plugin reuse is by agent, never by running another plugin's `bin/`). Verify the required capabilities before using codewalk instruments. | Purpose-level items need "why"; debugger demos and mutation labs need a runnable test per step. Historical gap (verify installed versions before use): sidecars carried `n, symbol, file, line, end, tier, what, side_effects, error_handling` only. |
| **codewalk:claim-verifier** | Gains an anchored-claims mode, owned by codewalk (above). | A wrong key teaches the wrong thing confidently; today's contract checks only `read` claims in a finished walk and samples 25. |
| **throughline** | A goal may bind to an effort. Throughline's `comprehension` axis is derived (answered leaves carrying a human-attested review) and cannot be probed, and there is no `understanding` axis; and its `review` note requires eight change-description fields an exam does not have. So throughline gains an **`exam` note kind** (an additive schema change in a plugin the same author owns), and `_comprehension` counts a leaf held by a human-attested review **or** a passed exam. teach writes goal-exam results there. Mutation-lab findings are offered as items. Silent when unbound. | The learning is part of the effort, through the axis throughline already computes, without forging review fields or being overwritten by a later agent review. |
| **grilling** | Used unchanged for goal exams. | Its native purpose. |
| **coach:handoff** | Owns real production code. For goals bound to an effort, teach reads each handoff: the brief's expected delta (the learner's own) becomes `prediction` evidence, scored against the actual change, on the concepts the change touches. Review answers 1–8 count only when the learner wrote them: then `answer-grader` grades them against a key built from the diff, as Transfer evidence. Answers written by the agent are exposure. The human attestation counts only as a self-rating. | Real work becomes the strongest evidence, and one dial governs production code. The same review notes feed throughline's `comprehension` axis. |
| **artifact-review** | Optional exam lenses. | — |
| **make-diagram** | Used unchanged. | Altitudes suit progressive reveal. |
| **archaeology** | Optional: find earlier inquiries in past sessions; seed compiled books. | — |
| **IntelliJ MCP** | Used unchanged. | Verified: a debug session can start from a test's file and line. |
| **auto-memory** | No mirror. Preferences live only in tracker `learner_notes`; the `SessionStart` hook prints the current ones. | Two stores for one fact would disagree. |

## 16. Build milestones

Each milestone is usable on its own, tested, and ends with a real general-learning session reviewed
against the anti-goals. Existing plugin releases are historical dependencies, not code in this repository.

| Milestone | Contents | Usable result |
|---|---|---|
| **M0 — conditional codewalk verification** | Check required codewalk capabilities and versions when enabling its instruments, against a public or synthetic example; does not block general M1/M2 learning | Code lessons can explain purpose and locate tests |
| **M1 — tracker core** | One Worker and D1 database; authenticated HTTP MCP; validated, idempotent, versioned writes with reasons and provenance; schema and migrations; mastery, frontier, priority, readiness, FSRS dates; versioned protocol; local development tests | One authoritative learning record, ready for the first hosted conversational release |
| **M2 — first usable conversational release** | `tutor` skill; concept-mapper, item-writer and shared independent free-text grading service; placement, modes, quizzes, inquiries, candidates and exit tickets; remotely accessible General tracker; supported-client auth and continuity checks; release migrations and essential backup/restore/export/deletion readiness, with deployment separately approved | Learn from an inquiry or goal, save progress, and resume with reviews through supported agents against the same hosted record |
| **M3 — instruments** | Optional codewalk, debugger demos, mutation labs, worked examples and anchored idea lessons on public or synthetic material | Active learning works with and without code |
| **M4 — books and reader** | Planned and compiled books, read/mastered marks, chapter quizzes, feed, simulators, exports and map; develop the single reader locally | Structured reading and finishing |
| **M5 — reader access and refinements** | Publish the reader with explicit approval; verify phone/browser journeys against the already-hosted tracker; extend client coverage as agreed; refine operations and optional session-start reminders | Structured learning is available across reader surfaces without adding a second tracker |
| **M6 — the moving boundary** | Frontier push, candidate lifecycle, urgency, reconfirmation, balance, calibration, code drift, observed evidence and optional throughline exam integration | The graph grows with the learner and stays accurate |

The first usable release combines M1 and M2 with remote tracker access. Books, the feed and richer
instruments remain later phases; do not defer service authentication, client compatibility or essential
data recovery until M5. Optional codewalk checks gate only their instruments. The shared grading
service, its cost/privacy controls and supported-client assessment checks are M2 release requirements.
Exact operational checks belong in the remaining decisions and build plan.

Next: plan the single-tracker M1 schema, write contract, authentication and migrations. A two-tracker
sync-contract LLD and launchd spike closure are no longer prerequisites.

## 17. How we'll know it works

- **Urgent goals:** a general-learning goal reaches readiness and the exam agrees (few holes at Transfer).
- **Growth:** the frontier moves — concepts reaching Purpose or above per month, across realms — not just
  new candidates.
- **Retention:** review accuracy at roughly one week and three weeks out.
- **Model calibration:** derived Secure predicts later correct answers.
- **Continuity:** a session started from a different agent resumes correctly, with nothing lost.
- **Conversation stays primary:** the learner reports feeling free in sessions; most evidence comes from
  conversation, not forced quizzes.
- **Finishing feels good:** chapters reach their mastered mark; the learner returns to the feed by
  choice.
- **No anti-goal hits** in reviewed sessions; stored material stays within general-learning scope.
- **The learner's own verdict** after the first goal.

## Assumptions & Unverified Claims

Historical findings and version claims are not verified against this checkout. Confirm APIs and supported
versions when implementing; do not copy the spike's dependency pins without checking them.

| # | Assumption or claim | Status | How to verify |
|---|---|---|---|
| A1 | Optional IDE instruments can start a test and inspect values | Not checked here | Run a synthetic example in M3 |
| A2 | Example code has suitable local tests | Not checked | Inventory and run them before a code lesson |
| A3 | Worker + D1 + authenticated HTTP MCP fits the single tracker | Historical spike evidence only | Verify current APIs and exercise M1 writes and migrations |
| A4 | Target agents can connect with the selected remote authentication | Unverified for this service | Verify client requirements in M1 planning and end-to-end connections before the first M1 + M2 release |
| A6 | Named sources can be reopened for key verification | Source-dependent | Unverifiable facts never key an item |
| A7 | Practice testing and spaced practice support retention | Original research attribution not verified here | Check primary research if load-bearing |
| A8 | Inquiries map accurately to concepts | Untested | Measure learner corrections in M2 |
| A9 | Mastery rules predict exam outcomes | Untested | Compare readiness with exams |
| A12 | Compiled chapters are useful | Untested | Measure acceptance, edits and declines in M4 |
| A13 | FSRS outcomes can be mapped per concept and level | Untested | Validate mappings and review accuracy in M1 |
| A14 | Anchored-claims verification is reliable enough for keys | Historical dependency claim | Test supported, wrong-line and unsupported key points |
| A17 | Backup retention and deletion meet the learner's needs | Unverified | Confirm provider behaviour and test restore before hosting |

A5, A10, A11, A15, A16 and A18 from revision 7 concern the removed employer track or its sync/daemon
machinery and are retired.

## 18. Alternatives considered for where the learner's records live

**Chosen:** one online General tracker with one MCP service and database (ADR 0002). Develop and test the
same service locally; local development is not a second learner store to keep synchronised.
A local-only database limits continuity from other devices. Per-folder learning records fragment the
learner model. The old dual-tracker choice is superseded because employer knowledge is no longer in scope.
FSRS remains the proposed review scheduler.

### Extending `mattpocock-skills:teach` (considered after review)

An installed `teach` skill already exists: one mission per workspace directory, cited HTML lessons,
learning records, reusable components. By its own documentation it has no placement step, no scheduled
review, and no state outside the workspace folder. The learner chose to build separately: this product
aims deeper (one graph across all subjects, verified answer keys, a learner model that drives choice)
and must work across agents and devices, which a per-folder skill cannot. Its lesson format and
component approach are worth borrowing. Its `/teach` command name is taken, so this plugin's entry point
needs another name.

## 19. Decided, my calls, and left to the builder

**Decided with the learner:** a separate deep tutor; conversation first; one General tracker with no
Meesho track; active lessons and four levels; evidence-based mastery; verified keys and independent
grading; inquiry-driven graph growth; urgent goals balanced against growth; concepts linked by
requires, instantiates, deepens and relates; aims owned by goals or the learner; the learner deciding
aims when a goal closes; books with distinct read and mastered marks, quizzes, feed and materials.

**Proposed defaults retained from revision 7:** the `teach` plugin with `tutor` skill; candidates archived
after 60 days; urgent/growth balance 70/30 while an urgent goal exists; collaborative-after-attempt help;
§7.4 priority weights;
FSRS; higher aim winning between owners; compiled chapters proposed after sessions; a daily finish marker.

**Left to the builder:** exact schema and tool contracts, auth/client compatibility, query views, reader
appearance, prompts, verification/compilation queues, FSRS mapping, fixtures and deployment runbook.

## Review history

The three revision-7 review rounds are preserved with the [historical design](2026-10-23-teach-design-r7-historical.md).
They do not certify the single-tracker revision. Review the current revision for stale dual-tracker requirements, preservation of the learning behaviour,
and consistency with the confirmed hosted-first conversational release before planning implementation.
