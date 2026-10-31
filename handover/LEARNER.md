> **Historical — scope changed 2026-10-26.** [ADR 0002](../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# Working with this learner

Hritvik Dinkar — engineer on the returns team at Meesho (user-returns-service), and author/owner of the
`hritvik-skills` plugins (codewalk, throughline, artifact-review, make-diagram, coach, …). Pronouns not stated:
use **they/them**, including in thinking and in documents.

## How they work

- **Short approvals.** "yes", "sure", "c", "aligned with your reccos" are real answers. When you offer options,
  lead with a recommendation; they usually take it.
- **Decide, then delegate the sequencing.** Once a strategy is agreed they want finished outputs, not per-step
  check-ins. Still stop for new decisions and for anything destructive or outward-facing (pushes, publishes,
  deploys, data leaving the machine).
- **They think by talking, and they widen the scope as they go.** Several mid-turn messages may arrive while you
  work; fold each one in and acknowledge it.
- **They like options laid out with trade-offs**, then a clear recommendation — not a survey.
- **Adversarial review is expected** for specs, plans and code (`artifact-review` for design artifacts;
  per-task + whole-branch review for code). Self-review alone is not accepted.
- **Code is primary, docs secondary.** Verify claims against source; cite `file:line`; flag drift.
- **Dual aim:** every session also improves the hritvik-skills tools. When a skill misbehaves, file it to
  throughline effort `skill-corpus` (prefix SC; `tl add task "…" --effort skill-corpus`) — but offer first.
- **When they step away,** keep going on unblocked work *and* keep improving the design and docs; leave changes
  to their decisions as written proposals, not edits.
- **Lessons go into the skill,** not just the artifact (if a reusable skill is in play).
- Plain language over jargon in messages to them; they read the terminal.

## Their stated wishes for `teach` (the why behind the design)

- "i want to understand the codebase related to the changes i'm planning" — the original need.
- "grow to meet me where i am… wander around the meesho domain knowledge, general system design, computer
  science… pushing a boundary as i'm reaching close to it in pursuit of wide and deep knowledge while keeping
  track of gaps… while keeping track of what's urgently needed and what's not."
- "utilise an mcp to keep track of progress and any agent can use it to continue our learning like we did with
  gym tracker."
- Meesho vs general knowledge kept apart: local store for Meesho, remote for general.
- "the freedom that comes with conversing with an agent is what i enjoy in learning these days so i want this to
  be my primary mode but still would like some structured pieces… visual and psychological satisfaction of
  finishing something."
- "something much deeper with cross platform support and more features" than mattpocock's skills.

## Guardrails that apply to everything here

- Never contact `prd.meesho.int`, `int.meesho.int`, `prd.mrouter.int`, `int.mrouter.int` (read-only Trino via its
  guarded runner is the only exception, per URS's CLAUDE.md).
- Meesho knowledge never leaves the learner's machine (ADR 0001).
- In user-returns-service, never stash/reset/discard tracked files — `CLAUDE.md` has their uncommitted edit.
- Never print tokens (`teach-spike/meesho/.dev.vars`).
