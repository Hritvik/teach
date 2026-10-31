# Specification and build-plan readiness review

Date: 2026-10-26. Status: technical review complete; learner approved the specification, build plan and US$5/month inference cap on 2026-10-26.

## Reviewed artifacts

- [First-release specification](../../../docs/superpowers/specs/2026-10-26-teach-general-specification.md).
- [Phased build plan](../../../docs/superpowers/plans/2026-10-26-teach-general-build.md).
- [Data/rules contract](../../../docs/superpowers/specs/contracts/data-and-rules.md).
- [Authentication/recovery contract](../../../docs/superpowers/specs/contracts/auth-and-recovery.md).
- [Shared model contract](../../../docs/superpowers/specs/contracts/grading-service.md).

The root synthesised the product/release documents. Separate data, security and model specialists owned
the technical contracts; independent correctness/security and implementability reviewers checked the
combined result. All work was local documentation and read-only source research. MyFitnessGuide source
at `382f2dcd225b0c76d8e810b6d34233ad2c5e4179` was inspected without modification.

## Findings and disposition

| Finding | Disposition |
|---|---|
| 64/256 KiB, status-name and generation-error mismatches | One 64 KiB envelope, attempt_status and STALE_GENERATION everywhere |
| Generic amend/retract could bypass independent grading | Closed authority/field matrix; trusted grading and learner-control exclusions separated |
| Exact-key evaluation had no concrete wire/equality schema | Single-choice and scalar-prediction schemas/evaluation and recognition credit limits pinned |
| Maintenance cannot execute under ordinary enabled-write guard | Separate private operation/phase/slot/meta guarded maintenance path |
| Already-admitted writes could resurrect deleted data after purge | Exclusive deletion maintenance, generation bump, confirmed primary fence, purge and checked reopen |
| Verification mutated immutable content or created an endless version loop | Immutable content, append-only trusted captures/verification records and pinned verification ids |
| Summary still conflated capture recheck with content version | Summary reconciled to the fixed technical contracts |

Both independent reviewers rechecked their material findings; they reported the technical findings
closed. The final summary-only reconciliation was applied after their scoped reports. No runtime
behaviour, security property, remote D1 parity or model-quality result was certified by this review.

## Actual changes in user direction during synthesis

The learner selected MyFitnessGuide's setup; the source-backed direct Google OIDC pattern replaces the
prior Access-for-SaaS upstream candidate. Teach resources/grants remain separate. The learner also
accepted a strict 30-day through-Teach recovery/access window with disclosed later physical cleanup of
encrypted storage remnants. These are recorded in the respective resolved tickets and contracts.

## Final learner approval and execution gates

The learner responded “proceed” to the presented specification/build plan and final US$5/month
inference-cap question. Record the cap as 5,000,000 micro-USD per learner-local month, covering Teach's
admitted verification/grading/regrading/retry calls at the approved price-policy boundary. The cap does
not authorise live inference, account/credential setup or deployment. MyFitnessGuide reuse does not
supply a pre-existing grader or shared production credentials.

All eight tickets can now be marked resolved and the map complete for its planning destination.
Package/API pin verification, secret/account setup, actual selected-client tests, provider
retention checks, restore rehearsal and paid-model quality tests are explicit execution gates in the
plan. They do not justify claiming those tests are already done or asking the learner to supply facts
we can verify during implementation.

## Verification performed

Local Markdown file links and ticket dependency references were checked. The historical original
revision-7 body remains preserved. No executable application exists yet, so no build, coverage or
application test result is claimed. A future implementation must meet the documented >=80% coverage,
integration, critical E2E and release-evidence requirements.
