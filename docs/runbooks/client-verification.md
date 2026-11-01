# Hosted client verification

Use this after changing OAuth scopes, the capture tool surface or a client connector. It verifies the
owner sign-in, the write envelope, persistence from a second connection and the retraction audit trail.

## 1. Confirm the grant

Call `whoami` and check:

```json
"scopes": ["teach:read", "teach:learn", "teach:organize"]
```

If a client shows only `teach:read`, remove and re-add the connector. Refreshing the tool list does
not re-run OAuth discovery. Revoke the old connection at `/control/connections` if needed.

## 2. Read the protocol and baseline

Call `protocol`, then read `sessions`, `inbox`, `frontier` and `gaps`. Reads should return `ok: true`.
`history` is not a session list; it requires a `record_id` and returns that record's correction and
retraction history.

## 3. Write envelope

Every write needs:

```json
{
  "protocol_version": 1,
  "rules_version": 1,
  "recovery_generation": 1,
  "request_id": "<fresh UUID>",
  "reason": "Hosted client verification",
  "expected": {},
  "operation": "<tool name>",
  "data": {}
}
```

`recovery_generation` comes from `whoami`. Reuse the same `request_id` only to reconcile a lost
acknowledgement; do not invent a new id for the same payload.

## 4. Write a session

1. `session_start`: `expected: {}`, `data: {}`. Record the returned `s_…` id and version.
2. `log_inquiry`: top-level `session_id`, `expected: {}`,
   `data: {text, concept_ids: [], unresolved: true}`.
3. `session_end`: `expected: {"s_…": 1}`,
   `data: {session_id: "s_…"}`. A missing version fails with `VERSION_CONFLICT`.

Expected: `ok: true`; sequence advances; session version becomes 2 and state becomes `closed`.

## 5. Verify from a second connection

Open a new chat and call `sessions` and `inbox`. The closed session and the inquiry must appear. Call
`history` with the inquiry id; it should return no corrections yet.

## 6. Retract the test inquiry

Use `retract` with:

```json
{
  "root_record_id": "inq_…",
  "expected_effective_revision": 0,
  "reason": "Cleanup after hosted client verification"
}
```

`expected` may be `{}`. `retract` is destructive; the client may ask for confirmation. Expected:
`ok: true`, correction id `rc_…`, effective revision 1.

Then call `inbox`: the inquiry must be absent. Call `history` with the inquiry id: it must return the
retraction record. The closed session remains; capture tools cannot delete it.

## 7. Check D1

From the repository root:

```sh
node node_modules/wrangler/bin/wrangler.js d1 execute teach-capture --remote \
  --config app/worker/wrangler.capture.jsonc \
  --command "SELECT seq, operation FROM event_log ORDER BY seq; SELECT id, state FROM sessions; SELECT id, state FROM inquiries; SELECT root_record_id, action, effective_revision FROM record_corrections;"
```

Expected for one clean run:

```text
seq 1  session_start
seq 2  log_inquiry
seq 3  session_end
seq 4  retract
session  state closed
inquiry  retracted by record_corrections
```

## Known friction

- Scope changes need a full connector re-add, not a tool refresh.
- `expected` versions are required for entity mutations; the conflict response names the current
  version.
- `history` needs `record_id`.
- Destructive tools may require an explicit client confirmation.
- A retracted inquiry stays in the database and audit history but is suppressed from active reads.
