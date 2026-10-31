# teach

A lifelong tutor: it models what one learner knows across general computing and other general knowledge,
grows that model from the learner's own questions and work, and teaches against it.

## Language

### The learner and their record

**Learner**:
The one person whose knowledge a tracker models.
_Avoid_: User, student, member

**General tracker**:
The learner's authoritative record of general knowledge, shared across agents and devices.
_Avoid_: Meesho tracker, local tracker, remote tracker, second tracker

### Knowledge

**Realm**:
A field of knowledge, such as system design, distributed systems, or a public example repository.
_Avoid_: Domain, category, subject

**Concept**:
One distinct thing the learner can know or not know, with its own mastery. An abstract idea and a
concrete embodiment of it are separate concepts: "idempotent consumer" and "example consumer's
redelivery handling" are two concepts, not one concept and its example.
_Avoid_: Topic, node, skill, instance

**Instantiates**:
The link from a concrete concept to the abstract concept it is an embodiment of. The learner can be
strong on one and weak on the other.
_Avoid_: Relies on, example of, implements

**Requires**:
The link saying one concept must be known at least at Mechanism before another can be taught.
_Avoid_: Prerequisite of, depends on, needs

**Deepens**:
The link from a concept to a more advanced treatment of the same subject. It implies Requires.
_Avoid_: Extends, advanced version, next level

**Relates**:
The link between neighbouring subjects that are worth knowing together, without either requiring the
other.
_Avoid_: See also, similar to, associated with

**Anchor**:
The cited evidence behind a fact the tutor teaches or grades against: a line of public or learner-owned example code at a
specific commit, or a passage in a named source. A fact without an anchor never appears in an answer
key.
_Avoid_: Citation, reference, source, proof

### Knowing

**Level**:
One of four depths at which a concept can be known: **Recall** (what it is), **Mechanism** (how it
behaves when it runs, including failures), **Purpose** (why it exists and what breaks without it), and
**Transfer** (applying or changing it in a new situation).
_Avoid_: Depth, tier, difficulty, stage

**Mastery**:
The learner's standing on one concept at one level, derived from evidence: **Unknown**, **Exposed**
(taught but never tested), **Shaky** (missed since the last good answer), **Solid** (answered well once)
or **Secure** (answered well on two different days).
_Avoid_: Proficiency, skill level, score, mastered

**Evidence**:
A recorded act of the learner that bears on mastery: an answer, a prediction, a teach-back, an inquiry,
or work they did.
_Avoid_: Event, signal, data point

**Exposure**:
A record that the learner was taught or shown something. It never raises mastery above Exposed.
_Avoid_: Coverage, viewed, seen

**Stale**:
A flag on mastery of a code-based concept whose code has changed since the learner last showed it.
Mastery is not lowered; the change is taught.
_Avoid_: Outdated, invalidated

**Fading**:
A flag on mastery whose review is well overdue. Mastery is not lowered until a review is missed.
_Avoid_: Decaying, forgotten, expired

### Wanting to know

**Aim**:
The level the learner wants to reach on a concept, owned either by a goal or by the learner.
_Avoid_: Target, desired level

**Goal**:
A piece of work or learning the learner wants to be ready for, which owns a set of aims. When a goal
closes, the learner decides for each of its aims whether to keep it, lower it, or drop it.
_Avoid_: Course, curriculum, effort, syllabus

**Urgent goal**:
A goal the learner has marked urgent. A date sharpens its urgency as the date nears, and an urgent goal
left untouched for about three weeks is put back to the learner to reconfirm.
_Avoid_: Priority goal, deadline, hot goal

**Growth**:
Every aim not owned by an urgent goal: the learner's own aims and those of goals without urgency.
_Avoid_: Curiosity, backlog, optional, exploration

**Balance**:
The learner's split of session time between urgent goals and growth.
_Avoid_: Mix, ratio, allocation

**Readiness**:
How many of a goal's aims are met, as a count out of the goal's aims.
_Avoid_: Progress, completion, percent done

**Candidate**:
A concept that has been proposed but has no aim yet. Giving it an aim accepts it.
_Avoid_: Suggestion, proposal, growth node

**Gap**:
A concept whose mastery is below its aim.
_Avoid_: Weakness, hole, missing knowledge

**Parked**:
An aim the learner has deliberately deferred: it still exists, but nothing is scheduled toward it.
_Avoid_: Snoozed, deferred, paused

**Frontier**:
The concepts with an aim whose prerequisites the learner already meets: what they are ready to learn now.
_Avoid_: Next up, ZPD, edge

### Structured reading

**Book**:
A finishable, ordered presentation of knowledge, made of chapters. A book is either **planned** (its
chapters laid out ahead, from a goal or an area) or **compiled** (its chapters edited together from the
learner's past sessions). A goal may have a book, and a book may exist without a goal.
_Avoid_: Course, journey, track, path, curriculum

**Chapter**:
One part of a book, covering a few concepts. A chapter is **read** once the learner has gone through it,
and **mastered** once every concept it covers has reached its aim.
_Avoid_: Module, unit, lesson, section

**Feed**:
An open-ended stream of cards the learner can browse at will, filtered by realm or book.
_Avoid_: Timeline, stream, scroll

**Card**:
One unit in the feed: a review item, an explanation of a single idea, a past inquiry's answer, a small
worked example or a diagram. Answering a card is evidence; reading one is exposure.
_Avoid_: Post, tile, snippet

### Learning over time

**Session**:
One sitting with the tutor, from start to exit ticket, with its inquiries, lessons and evidence.
_Avoid_: Conversation, chat, sitting

**Lesson**:
The teaching of one concept within a session.
_Avoid_: Class, module, unit, walkthrough

**Mode**:
How a lesson treats its concept, chosen from the learner's state: **bridge** (link a known abstract
concept to this concrete one), **detour** (a short lesson on a missing abstract concept first),
**check** (items only, no teaching), **counter-example** (aimed at a misconception), **delta** (what
changed in stale code) or **teach** (the full lesson).
_Avoid_: Lesson type, strategy

**Review**:
A due item on something the learner already knows, asked to keep it from fading.
_Avoid_: Revision, flashcard, refresher

**Probe**:
A quick item asked right after a miss, to tell whether the learner is missing the abstract concept or
only the concrete one that instantiates it.
_Avoid_: Follow-up question, diagnostic

**Exit ticket**:
The close of a session: the learner explains the session's main idea in their own words and names what
is still muddiest.
_Avoid_: Summary, wrap-up, recap

**Exam**:
The test that closes a goal: the learner writes their own plan for the goal's work and it is
stress-tested.
_Avoid_: Final, assessment, certification

### Asking

**Inquiry**:
A question the learner asks, in any session, about anything. It is answered first, then mapped to
concepts, and may add candidates.
_Avoid_: Question, query, learner question

**Item**:
A question the tutor asks the learner, drawn from the question bank and graded against a verified answer
key.
_Avoid_: Question, quiz question, card, exercise

**Misconception**:
A specific wrong belief the learner holds about a concept, revealed by a confidently wrong answer to an
item or by the way an inquiry is phrased.
_Avoid_: Mistake, error, confusion

**Inbox**:
The inquiries still waiting for an anchored answer, each with what would resolve it.
_Avoid_: Backlog, open questions, queue
