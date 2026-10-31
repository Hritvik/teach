> **Historical — scope changed 2026-10-26.** [ADR 0002](../../docs/adr/0002-single-general-tracker.md) removes the Meesho track. Use the root README and current design for next steps; old sync, daemon, employer-policy and repository-refresh tasks are not current prerequisites.

# teach sync spike — findings

Plan: teach/docs/superpowers/plans/2026-10-23-sync-spike.md · machine: macOS (darwin 25.6), Apple Silicon.

## Versions (exact-pinned)
- wrangler 4.152.0 · workerd 1.20261019.1 (binary reports `workerd 2026-10-19`) · typescript 7.0.2 · @cloudflare/workers-types 5.20261023.1 · node v26.12.1 · npm 11.20.0
- npm 11 withheld `workerd`'s postinstall ("install-scripts" approval); the binary ships in the platform package `@cloudflare/workerd-darwin-arm64` and runs without it. No scripts were approved.

## Q1 Local persistence
- **S6 confirmed:** `wrangler dev` does **not** apply D1 migrations. With no migrate step, a write fails `D1_ERROR: no such table: kv`. `run.sh` must run `wrangler d1 migrations apply DB --local --persist-to ./.state -c <worker>` first.
- Rows written before a graceful stop and before a `kill -9` are both present afterwards: read directly from the D1 file (copied with its `-wal`/`-shm`), `kv` holds `a|one`, `b|two`.
- Files: `.state/v3/d1/miniflare-D1DatabaseObject/<sha256>.sqlite` (+ `-wal`, `-shm`), one per D1 database; names are hashes, not database names — mapping them needs Miniflare's naming or a metadata lookup.
- **Process shape (matters for launchd):** `wrangler dev` runs as `node …/wrangler-dist/cli.js dev …` and spawns two `workerd serve` children. Killing a `workerd` child makes the node parent respawn it (observed recovery 47 s in a disordered run — to re-measure cleanly in Q7). Killing only `workerd` while the node parent lives is not a clean stop; a supervisor must signal the node parent. A first test misread respawned children as orphans because the `pkill` pattern missed the node parent.
- **Answer: yes** — local D1 persists across graceful and hard stops, provided migrations are applied before serving.

### Gotcha (Q2 setup)
- A Worker module may export **only** handlers: `export const PROTOCOL_VERSION = 2` makes the runtime refuse to start (`Incorrect type for map entry 'PROTOCOL_VERSION': … not of type 'function or ExportedHandler'`). Shared constants and helpers must live in a separate module that the entry imports. Relevant to the product: the tracker's contract constants cannot be exported from the entry file.

## Q2 Service binding and contract
- Two Workers from two `-c` configs run in one `wrangler dev` process with a working service binding (`GENERAL` → `general`). `meesho/wrangler.toml` binds only its own D1. Records forwarded through the binding land only in `general`'s database (`wrangler d1 execute --local`: meesho `[a, b]`, general `[g1, g2]`).
- Versioned contract: `general` accepts protocol 2 and 1, refuses 0 with HTTP 409.
- Degradation, all via `callGeneral` with `AbortSignal.timeout(2000)` — never hangs, never throws:
  - `general` slow (10 s sleep) → `degraded: TimeoutError`, 2002 ms
  - `general` 500 → `degraded: general returned 500`, 0 ms
  - `general` non-JSON 200 → `degraded: general returned non-JSON`, 0 ms
  - `general` not running at all → the binding answers **503** immediately (0 ms), not a connection error
  - version refused → `degraded: general returned 409` — **gap:** the refusal reason in the 409 body is dropped; the product must surface it (it is how the Meesho tracker "stops merging and says so").
- Reading D1 files directly is unreliable while the server runs (one copy failed `unable to open database file (14)`); `wrangler d1 execute --local` is the reliable inspection path.
- **Answer: yes** — two services joined only by a versioned contract run locally, with bounded degradation.

## Q3 Batch-only versioned writes
- **S7 resolved with mechanism (a), first try:** one `db.batch` of five statements — `INSERT OR IGNORE` the row at version 0; `UPDATE … WHERE version = ? AND NOT EXISTS (write_log.request_id = ?)`; `INSERT INTO write_log … SELECT … WHERE changes() = 1`; then two reads. `changes()` sees the previous statement's effect inside the batch. No trigger needed. Code: `general/src/record.ts`.
- Sequential: expected 0, 1, 2 → versions 1, 2, 3. Stale expected 1 → `ok:false, version:3`.
- Idempotency: request `r2` re-sent → `ok:true, version:2, replayed:true` (the original result), nothing written.
- Concurrency: 20 parallel writers, distinct request ids, same expected 0 → exactly 1 `ok:true`, 19 `ok:false` reporting version 1; `write_log` has exactly 1 row for the id; `kv.version` (1) equals the last logged version (1). Same invariant holds for the sequential id (3 = 3).
- Caveat: locally all requests hit one SQLite connection, so concurrency is serialised by the runtime; the remote D1 behaviour is Q8's to confirm. A refused write (`ok:false`) is not logged, so a retried refusal is re-evaluated rather than replayed — acceptable, since a refusal changes nothing.
- **Answer: yes** — versioned, idempotent writes work as a single batch with no read-then-write transaction.

## Q4 Authenticated localhost MCP
- **Library:** `@modelcontextprotocol/server` **2.3.1** (MCP SDK v2) `createMcpHandler(factory)` — stateless per request, runs in a Worker unchanged; `McpServer.registerTool` with `zod` 4.6.7 schemas. Cloudflare `agents` 0.30.0 also works but only wraps the same SDK v2 for stateless use (its stateless path *requires* `@modelcontextprotocol/server` as a peer), so it was removed; the v1 SDK (`@modelcontextprotocol/sdk` 1.32.1) is only `agents`' legacy sessionful path — removed too.
- Protocol: `initialize` (2025-06-18) returns a valid `InitializeResult` over SSE framing; `tools/list` → `ping`, `record`, `query`; `ping` → `pong`; `record` → forwarded to `general`, version 1; `query("DELETE …")` → tool error.
- Refusals: no token 401 · wrong token 401 · right token + `Host: evil.example` 403 · right token + `Origin: https://evil.example` 403 · local `Origin` accepted. Listening on `127.0.0.1:8787` only.
- **S8 resolved:** under `wrangler dev` the Worker sees the client's original `Host` and `Origin` unchanged (logged `host=evil.example`), so a Host check in the Worker is meaningful. To re-check under launchd and under plain `workerd` if used (Q7).
- **Gotcha:** `.dev.vars` is read from beside each Worker's `wrangler.toml` (`meesho/.dev.vars`), not the project root; with it misplaced the secret is silently empty and every request is 401. The product's install step must write the token where the runtime reads it, and fail loudly when it is empty.
- SDK v2 also exports `validateHostHeader`, `validateOriginHeader`, `localhostAllowedHostnames`, `requireBearerAuth` — the product can use those instead of hand-rolled checks.
- **Answer: yes.**

## Q5 Clients
- **Claude Code 2.1.309:** `claude mcp add -s local --transport http teach-spike http://127.0.0.1:8787/mcp --header "Authorization: Bearer …"` → `✔ Connected`. A headless session (`claude -p … --allowedTools mcp__teach-spike__ping,mcp__teach-spike__record`) called `ping` → `pong` and `record` → version 1; the row is in `general` (`cc-rec`, `from-claude-code`). **Works.**
- **Codex CLI 0.144.6:** `codex mcp add teach-spike --url http://127.0.0.1:8787/mcp --bearer-token-env-var TEACH_TOKEN` (streamable HTTP, token from an env var — no bridge needed). On `codex exec` it completed the MCP handshake against the server (`POST /mcp` 200 and 202 in the server log, past the token guard). **Tool calls not verified:** this machine's Codex is not logged in (`codex login status` → "Not logged in"; model calls 401), so no model turn ran. Re-run after `codex login`.
- Step 3 (both clients writing the same id at once) **not run** — needs a logged-in Codex. The server-side guarantee it would exercise is already shown under concurrency in Q3 (20 writers, one success).
- Note: `codex mcp add` writes the **global** `~/.codex/config.toml`; Claude Code supports project-local scope (`-s local`). The product's installer should prefer local scope where the client has one.
- Client entries removed after the test (both clients).
- **Answer: yes for Claude Code; Codex connects and authenticates, tool calls pending a Codex login.**

## Q6 Forward-only versions
- Released in the right order: `spike-v1` added the `meta(schema_version)` table, the database-newer-than-code guard and the MCP `handshake` tool **before** any migration could outrun it; `spike-v2` then added `kv.note` (schema 2) and code 0.2.0.
- **Upgrade:** v1 wrote `v1-row`; v2 started, `run.sh` applied the migration first, and the v1 row reads under v2 (`note: null`); v2 writes the new column.
- **Refuse a newer database:** v1 code against the v2-migrated database answers every route except `/health` with 503 `{"error":"database newer than code","db":2,"code":1}` — `/debug/*`, the contract forward and `/mcp` alike; `/health` 200.
- **Refuse an older client:** `handshake("0.1.0")` against tracker 0.2.0 → `isError: true` ("client 0.1.0 is older than tracker 0.2.0; update the plugin"); `handshake("0.2.0")` → ok.
- **Gotcha (Workers runtime):** the first guard cached a `Response` across requests; the first refusal worked and every later one failed 500 with *"Cannot perform I/O on behalf of a different request"* — even with `.clone()`. Module-level caches in a Worker may hold **data, never Response/stream objects**. Fixed in `spike-v1b` / `spike-v2b` (the downgrade test above ran on v1b; three repeated requests all 503).
- **Answer: yes** — forward-only works when the guard ships one release before the first migration it must police.

## Q7 Always-on service and upgrades (interim — soak and sleep/login pending)
- LaunchAgent `com.hritvik.teach-spike` (RunAtLoad, KeepAlive, ThrottleInterval 5, explicit `PATH=/opt/homebrew/bin:/usr/bin:/bin`) runs `run.sh` (migrate, then `wrangler dev`). Healthy **4 s** after load. Node at start: v26.12.1, `/opt/homebrew/Cellar/node/26.12.1/bin/node`.
- **Crash recovery — the core finding:**
  - `kill -9` of the job's main process → launchd restarts it, healthy in **1.9 s**, data intact.
  - `kill -9` of only the `workerd` children → `wrangler dev` (the node parent) does **not** bring them back reliably: still unhealthy after a 180 s wait (an earlier messy run recovered in 47 s). launchd never notices, because its child is still alive.
  - So the always-on runner must make a `workerd` death a process death — run `workerd serve` directly under launchd (S5), or wrap `wrangler dev` in a supervisor that exits when `workerd` does. As run, **`wrangler dev` is not acceptable as the always-on process.**
- **Upgrade under launchd (v1b → v2b, in place):** `git checkout spike-v2b` while loaded made `wrangler dev`'s **file watcher hot-reload the new code immediately — before any migration ran** ("Reloading local server…"), so v2 code briefly served a v1 database. Reads happened to work; a v2-only write would have failed. After a kill, launchd restarted, `run.sh` migrated, and v1 data read under v2 with the new column working. **Finding:** the product must not run a file-watching dev server; upgrades must be stop → migrate → start, which `workerd serve` (or `wrangler dev` with no watcher, if one exists) gives.
- **Downgrade under launchd (v2b database, v1b code):** health 200, everything else 503 "database newer than code"; launchd run count unchanged over 30 s — **no crash loop**. Return to v2b clean.
- **Kill during writes:** 200 chained versioned writes on one id, `kill -9` of the job at write 100, in-flight request retried with the **same** request id until accepted: 1 retry, 0 replays (the in-flight write had not committed), final `kv.version` 200 = 200 `write_log` rows = 200 distinct request ids = last logged 200, 0 duplicate versions. `PRAGMA integrity_check` = `ok` on both databases (copied with `-wal`/`-shm`, opened read-write: the macOS `sqlite3` 3.51 CLI cannot open a copied WAL database `-readonly` — error 14 — which is not corruption).
- **Rebinding defence under launchd:** token ok 200 · no token 401 · evil Host 403 · evil Origin 403 · loopback only.
- **Soak (2026-10-23 16:11 → 2026-10-26 14:27, ~3 days):** still `state = running`, launchd `runs = 5` unchanged since the last deliberate kill (no unplanned restarts), health 200, zero lines in either error log, resident memory 535 MB → 219 MB.
- **Sleep/wake:** the machine slept and woke during the soak (`pmset -g log` wakes on 2026-10-26); the service answered immediately afterwards with no restart.
- **Homebrew changed node under the service:** `node` resolved to `/opt/homebrew/Cellar/node/26.12.1/bin/node` at load and `…/26.12.1_1/bin/node` at the end (`com.hritvik.brew-autoupgrade`). The running process was unaffected; the next restart picks up the new binary through `/opt/homebrew/bin`. The product must either pin the runtime it launches or accept a runtime change on every restart, and its version handshake should record the runtime version it started with.
- **Pending:** log out and back in (needs the learner); removal of the LaunchAgent.
