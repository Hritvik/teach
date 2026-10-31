# Teach conversation adapters

All supported clients use the same remote MCP service and served `teach://protocol` resource.
Read that resource after connecting; the server owns compatible protocol/rules versions and generation.
Use each client's normal remote-MCP setup only after hosted configuration and client verification are
approved. This repository does not change personal client configuration automatically.

Claude Code, Codex CLI/desktop and Claude web/mobile share the same conversational rules:

1. Start with the learner's actual inquiry, orient from saved state, and explain before proposing checks.
2. Save inquiry/exposure under a session using a stable request UUID. Goals and exit tickets are optional.
3. Use verified item snapshots; withhold keys. Record hints/reveals and optional confidence honestly.
4. Submit exact answers through `answer`; poll `attempt_status`. Pending is not wrong or saved mastery.
5. Reconcile uncertain writes with the same UUID and unchanged payload. Explain conflict or provisional state.
6. Use due review leases without hidden takeover. Let the learner steer, defer a review or end a session.

A Claude Code answer-grader role has no separate grading authority. It submits through the shared
service and explains the returned criterion feedback. It must not run a local grading prompt and post
its own verdict. The same restriction applies to every model name, specialist label and client.

Internal key verification and grading receive isolated problem/rubric/capture data. Neither receives
the authoring transcript, account identity, learner mastery, confidence/hints or a previous verdict.
Only the tracker commits evidence and replayed mastery/schedule projections.

Synthetic local fixtures test these contracts. They are not evidence that a hosted client or model
can perform reliable grading. Live inference, model-quality review and hosted cross-client journeys
remain separately gated, with the privacy and budget limits in the grading-service contract.
