# Synthetic grading corpus

Review status: **pending human review**. No model API calls have been made for this corpus.

`grading-corpus.json` contains original invented source passages, item/rubric inputs, answers and expected
structured results. It covers supported, unsupported and ambiguous keys; unsupported exact values;
correct, partial and wrong answers; a valid alternative formulation; instruction injection; an
unassessable answer; and an independent regrade. The passage hashes bind the fixture bytes only.
They do not represent production captures or authorize publication of an item.

The automated corpus test validates closed schemas, source hashes, point coverage, aggregate rules and
verification eligibility. It exercises expected fixture results, not a model. A passing test is not
an accuracy measurement or evidence that a model can recognize the expected result.

Before the live grading release, a human reviewer must:

1. Read each passage, problem, criterion, learner answer and expected criterion result.
2. Check that each supported key follows from its sources and every unsupported or ambiguous key stays held.
3. Check valid alternate wording, required contradictions and the distinction between ungradable and wrong.
4. Record reviewer identity/date, any disagreements and their resolution in a reviewed corpus revision.
5. Approve a bounded provider evaluation separately; compare actual structured outputs with these expectations.

Keep this corpus marked pending until that review occurs. Do not add hidden reasoning, personal data,
real credentials or employer material. Any paid evaluation remains subject to explicit authorization,
the verified model/rate policy and the shared application budget.
