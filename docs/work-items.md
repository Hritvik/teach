# Teach work items

Status lines are the central coordination baseline. Source: `AGENTS.md`,
`docs/superpowers/plans/2026-10-29-teach-capture-deployment.md`, and the general build plan.

## W-1 — Prove the capture write journey

**Status.** Ready.
**Summary.** Complete `session_start` → `log_inquiry` → reconnect against the live Worker and record the round trip as evidence; writes are unproven until then.
**Depends on.** None.

## W-2 — Add the full-mode grading boundary

**Status.** Planned.
**Summary.** Introduce grading and scheduled work behind the full-mode boundary without letting the capture entrypoint gain those capabilities.
**Depends on.** `W-1.`

## W-3 — Build Phase C assessment and tutor

**Status.** Planned.
**Summary.** Implement shared assessment and the conversational tutor from the general build plan, with verified answer keys and graph updates.
**Depends on.** `W-2.`

## W-4 — Complete Phase D recovery and release gate

**Status.** Planned.
**Summary.** Prove recovery, run the full release gates, and record production approval evidence.
**Depends on.** `W-3.`

## Wayfinder reconciliation

`.scratch/teach-general/map.md` is complete; all 8 decision tickets are resolved and the
first-release specification and phased build plan are learner-approved. The decisions are
implementation inputs, not open tasks. The W-1…W-4 items above are the remaining build slices.
