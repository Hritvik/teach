# Teaching integration and dependency contract

Status: accepted planning contract. The learner selected a shared independent free-text grading service behind the tracker on 2026-10-26. Inherited boundaries and proposed implementation separation received independent review.
Parent: [Choose the teaching integration and dependency boundary](../issues/06-choose-the-teaching-integration-and-dependency-boundary.md).

## Established core and scope

The first usable release is one remotely accessible General tracker plus conversational teaching on
all selected launch clients. The tracker serves one versioned tutor protocol, owns the learning record
and derived state, and enforces accepted access/write/assessment/recovery contracts. Client adapters
load that protocol and orchestrate teaching. They must not copy it into diverging rules or assert mastery.

No fixed lesson topic or optional instrument dictates the build timeline. Use public named sources and
synthetic or learner-owned examples. Ideas-only lessons remain useful without a repository or IDE.
Richer instruments, books, feed and reader are later phases, not prerequisites for the core conversation.

## Dependency and authority boundary

| Component | Boundary | If unavailable |
|---|---|---|
| Tracker and served protocol | Required for stateful teaching; compatible rules/version negotiation | Explain outage, continue unsaved only under the accepted recovery policy |
| Source/key verification | Required before an item is asked; each key point anchored | Hold affected item; offer another verified item or explain without grading |
| Exact-key evaluation | Tracker evaluates a verified key and records attempts atomically | Do not claim a grade/save until acknowledged |
| Independent free-text grader | Required shared service for credited free-text assessment; see below | Hold grade as pending/ungraded, never substitute tutor self-grading |
| Claude Code tutor skill/specialists | Native orchestration client, no specialist tracker writes | Another supported adapter uses served protocol and required grading path |
| Codewalk | Owns code-anchor relocation and anchored-claims verification | Disable affected code assessment; general source-based learning continues |
| IDE/debugger/mutation tools | Optional local instruments, later phase | Explain limitation; offer concept/example alternative, not a fake successful run |
| Throughline | Optional effort binding and exam integration | Remain silent when unbound; Teach record remains authoritative |
| Coach | Owns changes to real product code; learner-authored outputs may become evidence | Do not have Teach take over product edits; synthetic exercises remain separate |
| Diagram/review/archaeology plugins | Optional enhancements | Use available basic explanation or omit enhancement honestly |

Use codewalk's published agent contracts when available, not scripts globbed from another plugin's
cache. The historical 0.8.1 release report is not installation evidence. Before enabling a code path,
verify required capabilities/version and actual general fixture behaviour; absent external source repos
do not prevent a source-based lesson. Do not duplicate the relocation implementation inside Teach.

Throughline's exam-note change and optional integrations do not block the first general conversation.
No duplicate auto-memory mirror becomes a second preference store. Keep client-specific installs and
secrets scoped appropriately; never modify global configuration without the authorised setup step.

## Cross-client capability checks

At session start obtain tracker/protocol compatibility and the concrete supported-client adapter
capabilities. Feature labels alone are not proof: release tests exercise the actual paths, source access,
tool restrictions and grading separation. Never infer a separate isolated agent exists merely because
an instruction says “act as grader.” A model switch or renamed prompt in one conversation is not proof
of independent grading. Model/provider identity and unsupported-client compatibility must not be guessed.

Older incompatible clients are refused before writes; missing optional instruments disable only their
operations. Missing core protocol/auth fails closed. Source access limitations hold affected items and
appear as actionable needs_you reasons rather than unverified keys. Do not claim saved exposure is
assessed evidence just because no grading route is available.

## Confirmed shared free-text grading boundary

The launch set includes Claude web/mobile as well as Claude Code and Codex. The reference establishes
independent grading but has not demonstrated isolated specialist orchestration on every surface.
A remote connector alone does not prove it can dispatch a protected independent grader.

Provide a shared independent grading service behind the tracker for free-text answers,
so launch clients do not need to start a separate grader manually. It receives only the versioned item,
verified rubric/key, the learner answer and essential question context; no unrelated history or tracker
write credentials. A constrained service result is validated and committed by tracker-owned operations,
not by allowing the grading model to write arbitrary state. Preserve deterministic tracker evaluation
for exact-key items. Operational isolation, tool restrictions and author/grader separation need tests. “Service” denotes
a protected grading boundary; it does not require an independently deployed tracker or a second learner
database. Its invocation has separate context and permissions from the item author/tutor, even if the
same model family is used; provider diversity alone is not the independence mechanism.

This is a learner-approved design boundary, not an existing tested service. Model/provider choice,
cost control, credentials, privacy handling, prompt/output schema, job idempotency, cancellation/retry,
request limits and deployment remain unselected design work. No paid inference or credential setup is
authorised by adopting a design. Do not describe worker-to-model I/O as deterministic D1 computation.

Considered alternative, not selected: keep grading client-orchestrated and prove an actually independent grader route for each
launch surface before release. This avoids a hosted grading-model dependency but may require additional
client integration; do not silently certify mobile free-text grading or drop that surface instead.

A temporary shared-grader outage leaves the answer pending/ungraded, not incorrect.
Verified exact-key checks and conversation can continue. This is degraded operation, not permission to
ship a selected launch client without the normal required grading path. Assessment leases, duplicate
attempts, disputes and write acknowledgements still follow the accepted contracts.

## Required evidence before enabling an integration

- Each launch client loads the same served rules and completes the selected grading route.
- Show that item authoring and grading context/permissions are separated; no grade by tutor assertion.
- Test optional tools absent, incompatible and timed out; affected code keys cannot be asked unchecked.
- Test key/protocol/grader failures, retries and pending answers without duplicate grades/evidence.
- General learning and reviews work without codewalk, IDE, Throughline or a separate product reader.
- No employer material or private product artifacts enter hosted sources, model prompts or fixtures.

Provider/client SDK facts, isolated grading implementation and actual tool availability need verification;
this document is not a certification of model or platform capabilities.
