> **Historical — scope changed 2026-10-26.** [ADR 0002](../../adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# Sync spike — two Worker trackers under local workerd — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** reviewed — revision 2, after a three-lens plan review (log at the end); awaiting the learner's read.

**Goal:** Answer assumption A16 with evidence — can the teach trackers run as two Cloudflare Worker services under a local `workerd`, persisting D1 to disk, served as an authenticated localhost MCP, kept alive by launchd **through upgrades**, reachable from Claude Code and Codex, with forward-only versions — and record the answers in `SPIKE.md` for the sync-contract LLD.

**Architecture:** A throwaway TypeScript project outside every product repository. Two Workers — `meesho` (MCP-facing) and `general` — each with its own D1 database, joined only by a service binding, run by one local process with state persisted to a directory. Versioning is built before the always-on service so the launchd soak runs the real start path, including migrations and an in-place upgrade. Nothing here is product code; what survives is `SPIKE.md`.

**Tech Stack:** Node v26.12.1 / npm 11.20.0 (installed), `wrangler` (local `workerd` + Miniflare; not installed globally — installed per-project), TypeScript, Cloudflare D1, MCP Streamable HTTP, launchd, `sqlite3`. Clients: Claude Code 2.1.309 (`claude mcp add --transport http … --header`), Codex CLI 0.144.6 (`codex mcp add --url … --bearer-token-env-var`).

**Spec:** `teach/docs/superpowers/specs/2026-10-23-teach-design.md` (revision 7) — §5.1 (provisional sync layer), assumption A16; ADR 0001.

## Global Constraints

- Location: `~/IdeaProjects/teach-spike`, its own git repository. Never inside `meesho-open-m-skills` or `user-returns-service`.
- Synthetic data only. No Meesho names, code, paths or text anywhere (the `meesho` Worker is named for its role).
- Exact-pinned dependencies (`npm install --save-exact`), `package-lock.json` committed; every resolved version recorded in `SPIKE.md`.
- Bind to `127.0.0.1` only; `meesho` on port `8787`; `general` reachable only through the service binding.
- No remote deploy in this plan except Task 8, which needs the learner's explicit go-ahead (spec §14.1 rule 8 gates the hosted tracker).
- Each task ends by appending its results — commands, outputs, timings, surprises — to `SPIKE.md` under its question, and committing.
- Leave nothing running or installed afterwards: no LaunchAgent plist in `~/Library/LaunchAgents`, no MCP client entries.

## Review Focus

1. **A crash mid-write** (kill during a batch): all-or-nothing, and a retried request with the same idempotency key records once. Task 7 Step 4.
2. **Sleep, logout/login, and an in-place upgrade under launchd**: the service comes back on the right version without manual action. Task 7 Steps 3, 5.
3. **Two MCP clients at once**: writes never break the version sequence. Task 5 Step 3.
4. **`general` absent, slow, failing or answering garbage**: `meesho` degrades within a stated bound, never hangs. Task 2 Step 4.
5. **A valid token with a foreign `Host` or `Origin`** (DNS rebinding): refused — on whichever runtime the service ends up using. Task 4 Step 3, re-run in Task 7 Step 6.

## Assumptions & Unverified Claims

| # | Assumption | Status | Where it is checked |
|---|---|---|---|
| S1 | `wrangler dev` runs two Workers from two `-c` configs in one process with a working service binding | Documented, untried here | Task 2 |
| S2 | D1 under `--persist-to` is an on-disk SQLite file (with `-wal`/`-shm`) that survives restarts | Documented for development; crash durability untested | Tasks 1, 7 |
| S3 | An MCP server library runs inside a Worker in stateless Streamable HTTP mode | Unknown which; three fall-backs listed | Task 4 Step 1 |
| S4 | Codex reaches an HTTP MCP with a bearer token via `codex mcp add --url … --bearer-token-env-var` | Flags exist on 0.144.6; behaviour untested | Task 5 Step 2 |
| S5 | `wrangler dev` is acceptable as an always-on process (it is built for development) | The core question; fallback `npx workerd serve` with a generated config | Task 7 — run both if `wrangler dev` misbehaves |
| S6 | Migrations are not applied automatically by `wrangler dev` | Believed true | Task 1 Step 1, Task 6 |
| S7 | A D1 batch can make a later statement depend on an earlier one's effect | Unknown. Try in order: (a) `UPDATE kv … WHERE id=? AND version=?` then `INSERT INTO write_log SELECT … WHERE changes() = 1`; (b) an `AFTER UPDATE` trigger on `kv` that writes the log row; (c) `INSERT … ON CONFLICT … DO UPDATE … WHERE version = ? RETURNING version` plus the trigger | Task 3 Step 1 |
| S8 | The Worker sees the client's original `Host` and `Origin` headers through `wrangler dev`'s local proxy (and through plain `workerd`) | Unknown; if the proxy rewrites `Host`, the check is a no-op or blocks everyone | Task 4 Step 3; re-run in Task 7 Step 6 on the final runtime |

---

### Task 1: Scaffold and persistence — does local D1 survive restarts?

**Files:** Create `~/IdeaProjects/teach-spike/{package.json, tsconfig.json, .gitignore, meesho/wrangler.toml, meesho/src/index.ts, meesho/migrations/0001_init.sql, general/wrangler.toml, general/src/index.ts, general/migrations/0001_init.sql, SPIKE.md, run.sh}`

**Interfaces:**
- Produces: `run.sh` — applies pending local migrations for both Workers (`npx wrangler d1 migrations apply DB --local --persist-to ./.state -c <worker>/wrangler.toml`), then starts both: `npx wrangler dev -c meesho/wrangler.toml -c general/wrangler.toml --ip 127.0.0.1 --port 8787 --persist-to ./.state`. Each Worker has D1 binding `DB` and table `kv(id TEXT PRIMARY KEY, value TEXT, version INTEGER NOT NULL)`. `meesho` serves `GET /health` → `{"ok":true}`.

- [ ] **Step 1: Scaffold** — `git init`; `npm init -y`; `npm install --save-exact --save-dev wrangler typescript @cloudflare/workers-types`. Write the Workers and migrations. `.gitignore`: `.state/`, `.dev.vars`, `node_modules/`, `logs/`. Record whether `wrangler dev` applies migrations by itself (S6).
- [ ] **Step 2: Start** — `./run.sh`; `curl -s 127.0.0.1:8787/health` → `{"ok":true}`.
- [ ] **Step 3: Persistence** — `POST /debug/put` a row on `meesho`; Ctrl-C; restart; `GET /debug/get` returns it. Repeat with `kill -9`. Record the paths of the SQLite files under `.state` (including `-wal`/`-shm`) and that `sqlite3 -readonly` opens a copy of all three together.
- [ ] **Step 4: Record and commit** — `SPIKE.md` "Q1 Local persistence".

---

### Task 2: Two services joined only by a service binding

**Files:** Modify `meesho/wrangler.toml` (service binding `GENERAL` → `general`), `meesho/src/index.ts`, `general/src/index.ts`.

**Interfaces:**
- Produces: `general` serves `POST /contract/v1/record` and `GET /contract/v1/derived?concept=<id>`; every request and response carries `protocol_version`. `meesho` reaches `general` only through `env.GENERAL.fetch(...)`, always with `AbortSignal.timeout(2000)`, and maps timeout, non-2xx and non-JSON replies to `{"degraded": "<reason>"}`. `general` also serves `/debug/sleep?ms=` , `/debug/fail` (500) and `/debug/garbage` (non-JSON 200).

- [ ] **Step 1: Wire the binding** and `meesho`'s `POST /debug/forward`.
- [ ] **Step 2: Isolation** — `meesho/wrangler.toml` binds only its own D1; a forwarded record lands in `general`'s database and not `meesho`'s.
- [ ] **Step 3: Version refusal** — `general` refuses a `protocol_version` older than current−1 with 409 and a JSON reason; current and current−1 succeed.
- [ ] **Step 4: Degradation** — each returns `{"degraded": …}` to the caller within 2.5 s: `general` not running (`-c meesho/wrangler.toml` only); `/debug/sleep?ms=10000`; `/debug/fail`; `/debug/garbage`. Record each reason string and measured time.
- [ ] **Step 5: Record and commit** — "Q2 Service binding and contract".

---

### Task 3: Versioned, idempotent writes as D1 batches

**Files:** Create `general/migrations/0002_write_log.sql` (`write_log(seq INTEGER PRIMARY KEY, id TEXT, version INTEGER, request_id TEXT UNIQUE, at TEXT)`); modify `general/src/index.ts`.

**Interfaces:**
- Produces: `recordVersioned(db, requestId: string, id: string, expected: number, value: string): Promise<{ok: boolean, version: number, replayed: boolean}>` — one `db.batch([...])`, no read-then-write transaction. A `requestId` already in `write_log` returns that write's original result with `replayed: true` and changes nothing. `POST /contract/v1/record` takes `{protocol_version, request_id, id, expected, value}`.

- [ ] **Step 1: Find a batch shape D1 accepts (S7)** — try (a), then (b), then (c); keep the first that passes Steps 2–4 and record why the others failed, with the exact SQL.
- [ ] **Step 2: Sequential** — expected 0, 1, 2 succeed; expected 1 again → `ok:false` with the current version.
- [ ] **Step 3: Concurrent** — 20 parallel requests (distinct `request_id`s, same `expected`) via `xargs -P 20 curl …`: exactly one `ok:true`; exactly one new `write_log` row; final version `expected+1`; `kv.version` equals the latest `write_log.version`.
- [ ] **Step 4: Idempotency** — the same `request_id` sent twice: one `write_log` row; both responses identical, the second with `replayed: true`.
- [ ] **Step 5: Record and commit** — "Q3 Batch-only versioned writes".

---

### Task 4: MCP on localhost with a token, Host and Origin checks

**Files:** Create `meesho/src/mcp.ts`; modify `meesho/src/index.ts`; `.dev.vars` holds `TEACH_TOKEN`.

**Interfaces:**
- Produces: `POST /mcp` (MCP Streamable HTTP) with tools `ping() -> "pong"`, `record(request_id, id, expected, value)` (forwards to `general`), `query(sql)` (`SELECT` only). Every request requires `Authorization: Bearer <TEACH_TOKEN>`, a `Host` of `127.0.0.1:8787` or `localhost:8787`, and an `Origin` that is absent or local.

- [ ] **Step 1: Choose the library** — try Cloudflare's `agents` package (`createMcpHandler`, stateless); then `@modelcontextprotocol/sdk` Streamable HTTP; then hand-rolled JSON-RPC (`initialize`, `tools/list`, `tools/call`). Record which worked and why the others did not; pin it exactly.
- [ ] **Step 2: Protocol** — `initialize` with the token returns a valid `InitializeResult`; `tools/list` lists the three tools.
- [ ] **Step 3: Refusals (S8)** — first log the `Host` and `Origin` the Worker actually receives for a plain `curl`. Then: no token → 401; wrong token → 401; right token with `Host: evil.example` → 403; right token with `Origin: https://evil.example` → 403; `query("DELETE …")` → tool error; `lsof -nP -iTCP:8787 -sTCP:LISTEN` shows only `127.0.0.1`. If the proxy rewrites `Host`, record it and move the check to a header the proxy preserves (or to the listener), and say so.
- [ ] **Step 4: Record and commit** — "Q4 Authenticated localhost MCP".

---

### Task 5: Claude Code and Codex connect

- [ ] **Step 1: Claude Code** — `claude mcp add --transport http teach-spike http://127.0.0.1:8787/mcp --header "Authorization: Bearer $TEACH_TOKEN"`; in a new session call `ping` and `record`. Expected: `pong`; the record appears in `general`.
- [ ] **Step 2: Codex** — `codex mcp add teach-spike --url http://127.0.0.1:8787/mcp --bearer-token-env-var TEACH_TOKEN`; call `ping` from a Codex session. If HTTP fails, try a pinned stdio bridge (`mcp-remote`) and record it.
- [ ] **Step 3: Both at once** — both call `record` on the same id with the same `expected` and distinct `request_id`s: exactly one succeeds.
- [ ] **Step 4: Remove client entries** — `claude mcp remove teach-spike`; `codex mcp remove teach-spike`. Record and commit — "Q5 Clients".

---

### Task 6: Forward-only versions, shipped in the right order

**Files:** Both Workers; `meesho/migrations/0002_meta.sql` and `general/migrations/0003_meta.sql` (`meta(key TEXT PRIMARY KEY, value TEXT)` with `schema_version`); later `meesho/migrations/0003_add_column.sql`.

**Interfaces:**
- Produces: a compiled-in `CODE_SCHEMA_VERSION` per Worker. On the first request after start, a Worker reads `meta.schema_version`; if it is greater than `CODE_SCHEMA_VERSION`, every route except `/health` returns 503 `{"error":"database newer than code","db":N,"code":M}`. MCP tool `handshake(client_version)` refuses a client older than the Worker, naming both versions.

- [ ] **Step 1: Release v1 — the guard first** — add `meta` (schema_version = 1), the guard and `handshake`; tag the commit `spike-v1`. Nothing else changes.
- [ ] **Step 2: Release v2 — the first migration that can outrun v1** — add `0003_add_column.sql` (schema_version = 2) and code that uses the column; tag `spike-v2`.
- [ ] **Step 3: Upgrade** — run v1, write data; stop; run v2 (`run.sh` applies the migration first); v1's data reads correctly.
- [ ] **Step 4: Refuse a newer database** — `git checkout spike-v1` against the v2-migrated `.state`: every route except `/health` returns the 503. Return to `spike-v2`.
- [ ] **Step 5: Refuse an older client** — `handshake("v1")` against v2 is refused; `handshake("v2")` succeeds.
- [ ] **Step 6: Record and commit** — "Q6 Forward-only versions".

---

### Task 7: launchd keeps it alive — through crashes, sleep and upgrades

**Files:** Create `launchd/com.hritvik.teach-spike.plist` (copied to `~/Library/LaunchAgents/` to load); `run.sh` uses absolute paths (record `which node` → expected `/opt/homebrew/bin/node`) and logs to `logs/`.

**Interfaces:**
- Produces: a LaunchAgent with `RunAtLoad`, `KeepAlive`, `WorkingDirectory` = the spike directory, stdout/stderr in `logs/`, running `run.sh` (migrations, then serve).

- [ ] **Step 1: Load at `spike-v1`** — record `node -v` and `which node`; `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hritvik.teach-spike.plist`; health ok.
- [ ] **Step 2: Crash recovery** — `kill -9` the `workerd` child (`pgrep -f workerd`), then separately the parent: health returns within 15 s each time (record times); no orphaned `workerd` holds the port.
- [ ] **Step 3: Upgrade under launchd** — while loaded on v1, `git checkout spike-v2` in the working directory and kill the process: launchd restarts it, `run.sh` migrates, health ok on v2. Record whether `wrangler dev`'s file watcher reloaded *before* the kill (and whether a half-checked-out tree was ever served). Then `git checkout spike-v1` and kill: the restarted v1 serves only `/health` and the 503 — no crash loop (check restart count in `logs/`).
- [ ] **Step 4: Kill during writes** — back on v2. A loop of 200 `record` calls, each with its own `request_id`; `kill -9` mid-loop; after restart the loop **re-sends the in-flight request with the same `request_id`** and continues. Then: `write_log` has exactly 200 rows, no duplicate `request_id`s; for every id, `kv.version` equals its latest `write_log.version`; copy the database with its `-wal` and `-shm` files together and `PRAGMA integrity_check` returns `ok`.
- [ ] **Step 5: Sleep and login** — sleep ≥ 10 minutes and wake; log out and back in; health after each.
- [ ] **Step 6: Re-check the rebinding defence on the final runtime** — repeat Task 4 Step 3 against the launchd-run service. If `wrangler dev` was replaced by `workerd serve` (S5), repeat it there too.
- [ ] **Step 7: Soak** — 3 days of normal use; record restarts (from logs), resident memory (`ps -o rss`), and `node -v`/`which node` again at the end (a Homebrew upgrade by `com.hritvik.brew-autoupgrade` is a different cause of restarts than the runtime itself).
- [ ] **Step 8: Remove** — `launchctl bootout gui/$(id -u)/com.hritvik.teach-spike`; `rm ~/Library/LaunchAgents/com.hritvik.teach-spike.plist`. Record and commit — "Q7 Always-on service and upgrades".

---

### Task 8 (optional — only with the learner's explicit go-ahead): remote parity

Deploying to Cloudflare is outward-facing, and the hosted General tracker is gated on the data-policy answer. If the learner approves a **synthetic-data-only** test: `wrangler deploy` `general` alone to their account, run Task 3 Steps 2–4 against it, compare with local, `wrangler delete`. Record "Q8 Remote parity", or "not run".

---

### Task 9: Write up for the sync LLD

**Files:** `~/IdeaProjects/teach-spike/SPIKE.md`; a copy at `teach/docs/superpowers/specs/2026-10-23-sync-spike-findings.md` on the feature branch that holds the teach docs.

- [ ] **Step 1: Answer A16** — one line per question Q1–Q8 (and a Q9 summary: "survives upgrades under launchd"): **yes / no / yes-with-conditions**, each with the evidence line from its task.
- [ ] **Step 2: Consequences for the spec** — each provisional §5.1 bullet marked "confirmed", "change to …" or "still open"; every resolved dependency version.
- [ ] **Step 3: Recommendation** — go / no-go for "one Worker codebase on D1, run locally under workerd", and if no-go, which spec §18 alternative the evidence points to.

---

## Adversarial Review

Reviewed 2026-10-23 · lenses: ground-truth, completeness, decomposition · grounding: `docs/design-review/grounding.md` (mostly generic checks: the spike is outside the repo).

| # | Lens | Sev | Finding | Disposition |
|---|------|-----|---------|-------------|
| 1 | decomposition | IMPORTANT | The "v1" checked out in the refusal test had no guard to fire. | **Accepted** — guard ships as `spike-v1` before the first outrunning migration (`spike-v2`), Task 6. |
| 2 | decomposition, completeness | IMPORTANT | Upgrades never exercised under launchd; soak ended before migrations existed. | **Accepted** — versioning moved before launchd; Task 7 Step 3 upgrades and downgrades while loaded. |
| 3 | completeness | IMPORTANT | Batch-conditional SQL undeclared, no fallback. | **Accepted** — S7 with three ordered mechanisms. |
| 4 | completeness | IMPORTANT | Rebinding defence assumes `Host`/`Origin` pass through the proxy. | **Accepted** — S8; observed in Task 4, re-run on the final runtime in Task 7. |
| 5 | completeness | IMPORTANT | Kill-during-writes check could not detect a failure. | **Accepted** — retry with the same key, kv/write-log agreement, WAL files copied. |
| 6 | decomposition, ground-truth | MINOR | `general` migration and request id missing from Task 3. | **Accepted** — `0002_write_log.sql`; `requestId` in signatures and the MCP tool. |
| 7 | completeness | MINOR | Degraded path tested only with `general` absent. | **Accepted** — slow, 500 and garbage routes; 2 s timeout. |
| 8 | ground-truth | MINOR | Plist never removed; Homebrew auto-upgrade could change node mid-soak. | **Accepted** — Step 8 removes it; node version recorded at start and end. |
