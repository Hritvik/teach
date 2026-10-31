> **Historical — scope changed 2026-10-26.** [ADR 0002](../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# Paste-ready prompt for the next agent

Start a Claude Code session (any repo; `~/IdeaProjects/meesho-open-m-skills` is natural) and paste:

---

You are taking over the `teach` project — a long-term, deep, cross-platform tutor plugin for me (Hritvik).
A previous agent designed it with me and started building it; everything you need is in
`~/IdeaProjects/meesho-open-m-skills/teach/handover/`.

1. Read, in order: `handover/README.md`, `STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`, `LEARNER.md`,
   `ENVIRONMENT.md`. Then skim `teach/GLOSSARY.md` and use its vocabulary exactly.
2. Verify the state before acting — `git log` in the marketplace repo and the M0 worktree,
   `/bin/ls ~/.claude/plugins/cache/hritvik-skills/codewalk/`, and
   `launchctl print gui/$(id -u)/com.hritvik.teach-spike`. Tell me anything that no longer matches STATE.md.
3. Then give me a short catch-up (what's done, what's waiting on me, what you'll do next) and ask me the open
   questions in OPEN-ITEMS §1 that I haven't answered yet.
4. Don't re-open decisions in DECISIONS.md without new evidence. Ask before any push, publish, deploy, or commit.

---

## If the next agent is not Claude Code

The handover is plain markdown; any agent with file access can read it. Commands assume macOS/zsh. Skills named
in ENVIRONMENT.md are Claude Code plugins — equivalents elsewhere: follow the spec, plans and ledgers directly.
