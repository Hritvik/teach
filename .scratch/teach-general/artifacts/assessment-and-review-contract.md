# Assessment and review contract

Status: accepted planning contract. The learner confirmed the three assessment recommendations on 2026-10-26; technical refinements preserve inherited requirements and include independent review fixes.
Parent: [Define trustworthy assessment and review behaviour](../issues/03-define-trustworthy-assessment-and-review-behaviour.md).

## Inherited constraints

Retain Recall, Mechanism, Purpose and Transfer per concept. Exposure may establish Exposed, but
cannot establish demonstrated mastery above it. Self-ratings affect placement only. Reading is distinct from demonstrating understanding. Unknown, Exposed, Shaky, Solid and
Secure are mastery states; Stale and Fading are flags, never automatic demotions.

The tracker computes mastery from effective dated evidence and versioned rules, not the tutor's
assertion. The tutor records inquiry/exposure automatically, answers an inquiry first, and may offer
an assessment without requiring a goal. Unverified claims never become grading keys.

An item has an immutable version of its stem, rubric/key points, anchors and distractors. Every key
point is verified against its anchor before use. Code anchors are checked at point of use; moved text
can be re-pinned, changed text retires the affected key, and unavailable verification holds the item.
A later key change cannot silently rewrite what the learner was originally asked.

The item author does not grade the answer. A free-text grader receives the supplied item, verified key,
answer and required context but no tracker tools or unrelated learner history. Exact-key items may be
graded by the tracker. The tutor cannot promote its own preferred grade over the independent result.
Confidence and help metadata affect the rules-derived evidence strength, not whether the answer's
content satisfies the key. Preserve both the content grade and its credited strength.

## Attempt identity and coordination

Use the accepted state/write contract: one stable attempt identity binds learner, session, item and key
version. A retry counts once even with a different request id. A changed answer following feedback is
new practice with its help/feedback history, not a retry that replaces the first attempt.

Presentation coordination: issuing a due item reserves that scheduled review for the active
session with an expiring lease. An agent encountering a live reservation skips it and explains why if
asked. The learner can explicitly take over; the old reservation then cannot produce another schedule
transition. Bind reservations to a stable scheduled-review occurrence and a lease generation plus
projection revision. Atomically consume each occurrence at most once, even if reissued as another
attempt after expiry. An expired or taken-over submission may remain assessment evidence if otherwise
valid, but cannot advance that occurrence; explain its status to the submitting client. It must not count
as an additional independent performance solely because the review was reissued. Reservation expiry alone
does not mark a miss. Independent legitimate learning evidence
from another session may still be recorded; assessment submission and scheduling are atomic.

## Confirmed v1 mastery defaults

- Solid: one strong correct with no later miss. Secure: strong corrects on two different learner-local
  calendar days with no subsequent miss; same-day repeats do not satisfy the two-day requirement.
- Strong correct: correct content, no hints or prior answer reveal, and reported confidence sure/think.
  Correct guesses and helped answers retain their content grade but receive partial credit for mastery.
- Wrong or partial assessment evidence since the latest strong correct yields Shaky. Mere exposure or
  an inquiry cannot demote an already demonstrated state. Self-ratings influence placement, not mastery.
- Clarify the inherited hint inconsistency conservatively: any content-bearing hint prevents a strong
  correct. Neutral rephrasing, accessibility assistance and procedural directions are not content hints;
  record what help occurred rather than silently treating all assistance as a miss.
- Do not infer lower-level partial evidence as a direct failed answer: the inherited higher-to-lower
  inference must not create a false miss or lower proven mastery. Store derivation provenance separately.
- Keep the proposed FSRS direction for concept/level reviews, with an explicit versioned mapping from
  answer strength to scheduling input. Exact mapping and retention target require implementation design
  and validation; this contract does not assert an untested mapping or current library behaviour.

## Confirmed confidence interaction

Ask sure/think/guess alongside deliberate quiz/check answers, not ordinary
conversational replies. Accept natural-language confidence without making the learner fill a form.
If omitted, record unknown rather than inferring confidence. Offer one brief confidence follow-up when
it changes mastery credit; if the learner skips it, preserve the answer and mark its credit unresolved
rather than recording a miss. A correct answer with unknown confidence does not qualify as a strong
correct, but missing confidence alone does not demote mastery. Keep its unresolved strength explicit;
any scheduling mapping must preserve that distinction and must not turn it into a failed review.

## Confirmed dispute policy

A challenged grade is marked disputed and sent for independent regrading against the
same anchored question/key version. It does not become correct because the learner or tutor objects.
While unresolved, exclude that attempt from effective mastery and schedule replay; mark affected values
provisional and show the reason. If a previous accepted grade had already changed state, replay without
the disputed attempt, preserving unrelated later evidence. Replaying a disputed attempt invalidates obsolete reservations so
an old client cannot consume an occurrence against the superseded schedule. Provisional values are
labelled and cannot certify readiness while the disputed evidence is material to it. Resolution appends a version-checked amendment,
retains original grade/provenance and recomputes affected projections. A faulty key holds/retires the item
until verified again. If the dispute cannot be resolved, retain it as unresolved, not as a failed answer.

## Review and drift

A review due date is a request to assess, not evidence of forgetting. Stale/Fading flags alone never
lower mastery. Source changes require a delta lesson and verified new items; the changed source does
not retroactively prove that an earlier answer was wrong. Repeated assessment after a key reveal must
be identified as helped practice; a later independent item can establish understanding.

## Implementation evidence to require

- No duplicate attempt or concurrent presentation advances a due review twice.
- Corrections and dispute resolution replay deterministically with pinned rules and key versions.
- Same-day repetition cannot manufacture Secure; use learner timezone without changing old timestamps.
- Unknown confidence, exposure and skipped reviews cannot silently become wrong answers.
- Hints, feedback, content grade and credited strength remain distinguishable in history.
- Unsupported keys are never asked; changed/unavailable anchors are held or retired appropriately.
- Items that only recognise an answer do not establish a level requiring recall or transfer.

The learner accepted the mastery thresholds, confidence interaction and dispute policy. Exact FSRS
outcome mapping, scheduling treatment of unresolved confidence, reservation durations, JSON schemas and
rule-replay implementation remain builder-owned design/validation work. They must satisfy the invariants
above before the specification/build plan is complete. This contract is not evidence that FSRS,
cross-client races or remote writes were tested.
