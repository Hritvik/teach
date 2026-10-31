import { DurableObject } from 'cloudflare:workers';
import type { Admission } from '../data/types.ts';
import { BudgetLedger, BUDGET_SCHEMA } from './budget.ts';

export interface LedgerFailure {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string };
}
export type AdmissionResult = { readonly ok: true; readonly admission: Admission } | LedgerFailure;
export type LedgerStateResult = { readonly ok: true; readonly generation: number; readonly mode: string } | LedgerFailure;
export interface PendingGrantInput { readonly grantId: string; readonly clientId: string; readonly subject: string; readonly scopes: readonly string[]; }
export interface ApprovalInput { readonly approvalId: string; readonly actionHash: string; readonly targetVersions: Readonly<Record<string, number>>; readonly generation: number; }
export interface ConsumeApprovalInput extends ApprovalInput { readonly requestId: string; }
export type RateLimitResult = { readonly ok: true } | (LedgerFailure & { readonly retryAfterSeconds?: number });
export interface Connection { readonly grantId: string; readonly clientId: string | null; readonly subject: string | null; readonly scopes: readonly string[]; readonly status: string; readonly createdAt: string | null; readonly revokedAt: string | null; }
export type ConnectionsResult = { readonly ok: true; readonly connections: readonly Connection[] } | LedgerFailure;
export type ApprovalResult = { readonly ok: true; readonly approvalId: string; readonly expiresAt: string } | LedgerFailure;
export type ConsumeApprovalResult = { readonly ok: true; readonly replayed: boolean } | LedgerFailure;
interface PendingRow { [key: string]: SqlStorageValue; grant_id: string; client_id: string; subject: string; scopes_json: string; created_at: string; }
interface ApprovalRow { [key: string]: SqlStorageValue; action_hash: string; versions_json: string; generation: number; expires_at: number; consumed_request_id: string | null; }
interface RateRow { [key: string]: SqlStorageValue; tokens: number; updated_at: number; }
interface ControlRow { [key: string]: SqlStorageValue; learner_id: string; generation: number; mode: string; maintenance_id: string | null; completed_id: string | null; }
interface GrantRow { [key: string]: SqlStorageValue; grant_id: string; scopes_json: string; status: string; }
const scopesAllowed = new Set(['teach:read', 'teach:learn', 'teach:organize']);
const failure = (code: string, message: string): LedgerFailure => ({ ok: false, error: { code, message } });
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validGeneration = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const validScopes = (values: unknown): values is readonly string[] => Array.isArray(values) && values.length > 0
  && values.length <= scopesAllowed.size && values.every(value => typeof value === 'string' && scopesAllowed.has(value))
  && new Set(values).size === values.length;

function versionsJson(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const entries = Object.entries(input);
  if (entries.length > 100 || !entries.every(([key,value]) => validId(key) && validGeneration(value))) return undefined;
  return JSON.stringify(Object.fromEntries(entries.sort(([a],[b]) => a.localeCompare(b))));
}
function validApproval(input: ApprovalInput): string | undefined {
  if (!input || !validId(input.approvalId) || !/^[a-f0-9]{64}$/.test(input.actionHash) || !validGeneration(input.generation)) return undefined;
  return versionsJson(input.targetVersions);
}

/** Internal binding RPC only. No method is routed directly from public HTTP/MCP. */
export class SecurityLedger extends DurableObject {
  private readonly budget: BudgetLedger;
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS ledger_control (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1), learner_id TEXT NOT NULL,
      generation INTEGER NOT NULL CHECK(generation>0), mode TEXT NOT NULL CHECK(mode IN ('active','maintenance')),
      maintenance_id TEXT, completed_id TEXT
    ); CREATE TABLE IF NOT EXISTS ledger_grants (
      grant_id TEXT PRIMARY KEY, scopes_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active','revoked')), revoked_at TEXT
    ); CREATE TABLE IF NOT EXISTS ledger_connections (
      grant_id TEXT PRIMARY KEY, client_id TEXT NOT NULL, subject TEXT NOT NULL,
      scopes_json TEXT NOT NULL, created_at TEXT NOT NULL
    ); CREATE TABLE IF NOT EXISTS ledger_rate_limits (
      grant_id TEXT PRIMARY KEY, tokens REAL NOT NULL, updated_at INTEGER NOT NULL
    ); CREATE TABLE IF NOT EXISTS ledger_endpoint_rates (
      rate_key TEXT PRIMARY KEY, used INTEGER NOT NULL, started_at INTEGER NOT NULL
    ); CREATE TABLE IF NOT EXISTS ledger_approvals (
      approval_id TEXT PRIMARY KEY, action_hash TEXT NOT NULL, versions_json TEXT NOT NULL,
      generation INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_request_id TEXT
    );`);
    ctx.storage.sql.exec(BUDGET_SCHEMA);
    this.budget = new BudgetLedger(ctx.storage);
  }

  configureBudgetPolicy(input: unknown) { return this.budget.configureBudgetPolicy(input); }
  reserveBudget(input: unknown) { return this.budget.reserveBudget(input); }
  settleBudget(input: unknown) { return this.budget.settleBudget(input); }
  budgetStatus(period?: string) { return this.budget.budgetStatus(period); }

  private control(): ControlRow | undefined {
    return this.ctx.storage.sql.exec<ControlRow>('SELECT * FROM ledger_control WHERE singleton=1').toArray()[0];
  }
  private grant(grantId: string): GrantRow | undefined {
    return this.ctx.storage.sql.exec<GrantRow>('SELECT grant_id,scopes_json,status FROM ledger_grants WHERE grant_id=?', grantId).toArray()[0];
  }
  private state(control: ControlRow): LedgerStateResult {
    return { ok: true, generation: control.generation, mode: control.mode };
  }

  /** Trusted deployment/OAuth coordinator setup; creates no connection or credential. */
  configureLearner(learnerId: string): LedgerStateResult {
    if (!validId(learnerId)) return failure('INVALID_INPUT', 'Invalid learner.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (control) return control.learner_id === learnerId ? this.state(control) : failure('ALREADY_INITIALISED', 'The learner is already configured.');
      const prior = this.ctx.storage.sql.exec(`SELECT 1 AS present WHERE
        EXISTS(SELECT 1 FROM ledger_grants) OR EXISTS(SELECT 1 FROM ledger_connections) OR
        EXISTS(SELECT 1 FROM ledger_approvals) OR EXISTS(SELECT 1 FROM ledger_budget_config) OR
        EXISTS(SELECT 1 FROM ledger_budget_months) OR EXISTS(SELECT 1 FROM ledger_budget_reservations)`).toArray()[0];
      if (prior) return failure('RECOVERY_REQUIRED', 'Security authority requires trusted recovery; initialization is refused.');
      this.ctx.storage.sql.exec('INSERT INTO ledger_control VALUES(1,?,1,\'active\',NULL,NULL)',learnerId);
      return {ok:true,generation:1,mode:'active'};
    });
  }

  /** Caller must already be trusted bootstrap code; an existing revoked grant cannot be resurrected. */
  bootstrap(learnerId: string, grantId: string, scopes: readonly string[]): LedgerStateResult {
    if (!validId(learnerId) || !validId(grantId) || !validScopes(scopes)) return failure('INVALID_INPUT', 'Invalid bootstrap identity or scopes.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (control) {
        if (control.learner_id !== learnerId) return failure('ALREADY_INITIALISED', 'The learner is already configured.');
        const grant = this.grant(grantId);
        if (!grant) return failure('ALREADY_INITIALISED', 'Use trusted grant registration for another connection.');
        if (grant.status !== 'active') return failure('REVOKED_GRANT', 'This connection has been revoked.');
        return this.state(control);
      }
      this.ctx.storage.sql.exec('INSERT INTO ledger_control VALUES(1,?,1,\'active\',NULL,NULL)', learnerId);
      this.ctx.storage.sql.exec('INSERT INTO ledger_grants VALUES(?,?,\'active\',NULL)', grantId, JSON.stringify(scopes));
      return { ok: true, generation: 1, mode: 'active' };
    });
  }

  /** For the future trusted OAuth issuance path, not exposed to ordinary learning clients. */
  registerGrant(grantId: string, scopes: readonly string[]): LedgerStateResult {
    if (!validId(grantId) || !validScopes(scopes)) return failure('INVALID_INPUT', 'Invalid connection or scopes.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (!control) return failure('UNAUTHORISED', 'The learner is not configured.');
      const pending = this.ctx.storage.sql.exec('SELECT grant_id FROM ledger_connections WHERE grant_id=?', grantId).toArray()[0];
      const existing = this.grant(grantId);
      if (pending && !existing) return failure('FORBIDDEN', 'Pending connections require trusted activation.');
      if (existing?.status === 'revoked') return failure('REVOKED_GRANT', 'This connection has been revoked.');
      if (existing) {
        if (existing.scopes_json !== JSON.stringify(scopes)) return failure('VERSION_CONFLICT', 'Connection scopes cannot be silently changed.');
        return this.state(control);
      }
      this.ctx.storage.sql.exec('INSERT INTO ledger_grants VALUES(?,?,\'active\',NULL)', grantId, JSON.stringify(scopes));
      return this.state(control);
    });
  }

  /** Omitted generation is restricted to read admission so clients can orient after a fence. */
  admit(grantId: string, requiredScopes: readonly string[], generation?: number): AdmissionResult {
    if (!validId(grantId)) return failure('UNAUTHORISED', 'Unknown connection.');
    if (!Array.isArray(requiredScopes) || requiredScopes.length === 0 || !requiredScopes.every(scope => typeof scope === 'string')) {
      return failure('INVALID_INPUT', 'At least one required scope must be provided.');
    }
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      const grant = this.grant(grantId);
      if (!control || grant?.status !== 'active') return failure('UNAUTHORISED', 'Unknown or revoked connection.');
      const scopes = JSON.parse(grant.scopes_json) as string[];
      if (!requiredScopes.every(scope => scopes.includes(scope))) return failure('FORBIDDEN', 'The connection lacks the required scope.');
      const writes = requiredScopes.some(scope => scope !== 'teach:read');
      if (writes && control.mode !== 'active') return failure('MAINTENANCE', 'Learning writes are temporarily paused.');
      if ((generation !== undefined || writes) && (!validGeneration(generation) || generation !== control.generation)) {
        return failure('STALE_GENERATION', 'Refresh current learning state before submitting this operation.');
      }
      return { ok: true, admission: { learner_id: control.learner_id, connection_id: grantId,
        generation: control.generation, scopes } };
    });
  }

  snapshot(grantId: string): LedgerStateResult {
    const admitted = this.admit(grantId, ['teach:read']);
    if (!admitted.ok) return admitted;
    const control = this.control();
    if (!control) return failure('UNAUTHORISED', 'The learner is not configured.');
    return this.state(control);
  }

  revoke(grantId: string): LedgerStateResult {
    if (!validId(grantId)) return failure('INVALID_INPUT', 'Invalid connection.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      const grant = this.grant(grantId);
      const pending = this.ctx.storage.sql.exec<PendingRow>('SELECT * FROM ledger_connections WHERE grant_id=?', grantId).toArray()[0];
      if (!control || (!grant && !pending)) return failure('UNAUTHORISED', 'Unknown connection.');
      if (!grant && pending) this.ctx.storage.sql.exec('INSERT INTO ledger_grants VALUES(?,?,\'revoked\',?)', grantId, pending.scopes_json, new Date().toISOString());
      if (grant?.status === 'active') this.ctx.storage.sql.exec(
        'UPDATE ledger_grants SET status=\'revoked\', revoked_at=? WHERE grant_id=?', new Date().toISOString(), grantId);
      return this.state(control);
    });
  }

  /** Called only after verified owner identity and consent, before OAuth completion. */
  createPendingGrant(input: PendingGrantInput): LedgerStateResult {
    if (!input || !validId(input.grantId) || typeof input.clientId !== 'string' || !input.clientId || input.clientId.length > 2048
      || typeof input.subject !== 'string' || !input.subject || input.subject.length > 512 || !validScopes(input.scopes)) return failure('INVALID_INPUT', 'Invalid pending connection.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (!control) return failure('UNAUTHORISED', 'The learner is not configured.');
      if (control.mode !== 'active') return failure('MAINTENANCE', 'Connection issuance is paused.');
      if (this.grant(input.grantId)) return failure('VERSION_CONFLICT', 'Connection identity is already used.');
      const old = this.ctx.storage.sql.exec<PendingRow>('SELECT * FROM ledger_connections WHERE grant_id=?', input.grantId).toArray()[0];
      const scopes = JSON.stringify(input.scopes);
      if (old && (old.client_id !== input.clientId || old.subject !== input.subject || old.scopes_json !== scopes)) return failure('VERSION_CONFLICT', 'Pending connection binding changed.');
      if (!old) this.ctx.storage.sql.exec('INSERT INTO ledger_connections VALUES(?,?,?,?,?)', input.grantId, input.clientId, input.subject, scopes, new Date().toISOString());
      return this.state(control);
    });
  }

  /** Call only after library authorization completed with this exact connection id. */
  activateGrant(grantId: string): LedgerStateResult {
    if (!validId(grantId)) return failure('INVALID_INPUT', 'Invalid connection.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      const pending = this.ctx.storage.sql.exec<PendingRow>('SELECT * FROM ledger_connections WHERE grant_id=?', grantId).toArray()[0];
      if (!control || !pending) return failure('UNAUTHORISED', 'Unknown pending connection.');
      if (control.mode !== 'active') return failure('MAINTENANCE', 'Connection issuance is paused.');
      const old = this.grant(grantId);
      if (old?.status === 'revoked') return failure('REVOKED_GRANT', 'This connection has been revoked.');
      if (!old) this.ctx.storage.sql.exec('INSERT INTO ledger_grants VALUES(?,?,\'active\',NULL)', grantId, pending.scopes_json);
      return this.state(control);
    });
  }

  /** Trusted browser control RPC; never exposed to MCP tokens. */
  listConnections(): ConnectionsResult {
    return this.ctx.storage.transactionSync(() => {
      if (!this.control()) return failure('UNAUTHORISED', 'The learner is not configured.');
      const all = this.ctx.storage.sql.exec<Record<string, SqlStorageValue>>(`
        SELECT g.grant_id,g.scopes_json,g.status,g.revoked_at,c.client_id,c.subject,c.created_at FROM ledger_grants g
        LEFT JOIN ledger_connections c ON c.grant_id=g.grant_id
        UNION ALL SELECT c.grant_id,c.scopes_json,'pending',NULL,c.client_id,c.subject,c.created_at FROM ledger_connections c
        WHERE NOT EXISTS(SELECT 1 FROM ledger_grants g WHERE g.grant_id=c.grant_id) ORDER BY grant_id`).toArray();
      return {ok:true, connections:all.map(row => ({grantId:String(row.grant_id),clientId:row.client_id === null ? null : String(row.client_id),
        subject:row.subject === null ? null : String(row.subject),scopes:JSON.parse(String(row.scopes_json)) as string[],status:String(row.status),
        createdAt:row.created_at === null ? null : String(row.created_at),revokedAt:row.revoked_at === null ? null : String(row.revoked_at)}))};
    });
  }

  /** One call per authenticated request; refill one token/second, capacity ten. */
  rateLimit(grantId: string): RateLimitResult {
    if (!validId(grantId)) return failure('UNAUTHORISED', 'Unknown connection.');
    return this.ctx.storage.transactionSync(() => {
      if (!this.control() || this.grant(grantId)?.status !== 'active') return failure('UNAUTHORISED', 'Unknown or revoked connection.');
      const now = Date.now();
      const old = this.ctx.storage.sql.exec<RateRow>('SELECT tokens,updated_at FROM ledger_rate_limits WHERE grant_id=?', grantId).toArray()[0];
      const tokens = old ? Math.min(10, old.tokens + Math.max(0, now - old.updated_at) / 1000) : 10;
      if (tokens < 1) return {...failure('RATE_LIMITED', 'Connection request limit exceeded.'),retryAfterSeconds:Math.max(1,Math.ceil(1-tokens))};
      this.ctx.storage.sql.exec('INSERT INTO ledger_rate_limits VALUES(?,?,?) ON CONFLICT(grant_id) DO UPDATE SET tokens=excluded.tokens,updated_at=excluded.updated_at', grantId,tokens-1,Math.max(now,old?.updated_at ?? now));
      return {ok:true};
    });
  }

  rateControl(sessionId: string): RateLimitResult { return this.endpointRate('control', sessionId, 10, 60000); }
  rateRegistration(ipHash: string): RateLimitResult { return this.endpointRate('registration', ipHash, 5, 3600000); }

  private endpointRate(kind: string, id: string, capacity: number, windowMs: number): RateLimitResult {
    if (!validId(id)) return failure('INVALID_INPUT', 'Invalid rate-limit identity.');
    return this.ctx.storage.transactionSync(() => {
      const key = `${kind}:${id}`; const now = Date.now();
      const old = this.ctx.storage.sql.exec<{[key:string]:SqlStorageValue;used:number;started_at:number}>('SELECT used,started_at FROM ledger_endpoint_rates WHERE rate_key=?',key).toArray()[0];
      const expired = !old || now >= old.started_at + windowMs;
      const used = expired ? 0 : old.used; const started = expired ? now : old.started_at;
      if (used >= capacity) return {...failure('RATE_LIMITED','Endpoint request limit exceeded.'),retryAfterSeconds:Math.max(1,Math.ceil((started+windowMs-now)/1000))};
      this.ctx.storage.sql.exec('INSERT INTO ledger_endpoint_rates VALUES(?,?,?) ON CONFLICT(rate_key) DO UPDATE SET used=excluded.used,started_at=excluded.started_at',key,used+1,started);
      return {ok:true};
    });
  }

  createApproval(input: ApprovalInput): ApprovalResult {
    const versions = validApproval(input);
    if (!versions) return failure('INVALID_INPUT', 'Invalid action approval.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (!control) return failure('UNAUTHORISED', 'The learner is not configured.');
      if (control.mode !== 'active' || input.generation !== control.generation) return failure('STALE_GENERATION', 'Action approval requires the active generation.');
      if (this.ctx.storage.sql.exec('SELECT approval_id FROM ledger_approvals WHERE approval_id=?',input.approvalId).toArray()[0]) return failure('VERSION_CONFLICT', 'Approval identity is already used.');
      const expires = Date.now()+600000;
      this.ctx.storage.sql.exec('INSERT INTO ledger_approvals VALUES(?,?,?,?,?,NULL)',input.approvalId,input.actionHash,versions,input.generation,expires);
      return {ok:true,approvalId:input.approvalId,expiresAt:new Date(expires).toISOString()};
    });
  }

  consumeApproval(input: ConsumeApprovalInput): ConsumeApprovalResult {
    const versions = validApproval(input);
    if (!versions || !validId(input.requestId)) return failure('INVALID_INPUT', 'Invalid approval consumption.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (!control || control.mode !== 'active' || input.generation !== control.generation) return failure('STALE_GENERATION', 'Action approval requires the active generation.');
      const approval = this.ctx.storage.sql.exec<ApprovalRow>('SELECT * FROM ledger_approvals WHERE approval_id=?',input.approvalId).toArray()[0];
      if (!approval || approval.action_hash !== input.actionHash || approval.versions_json !== versions || approval.generation !== input.generation) return failure('FORBIDDEN', 'Approval does not match this action.');
      if (approval.consumed_request_id !== null) return approval.consumed_request_id === input.requestId ? {ok:true,replayed:true} : failure('APPROVAL_USED', 'Approval was already consumed.');
      if (Date.now() >= approval.expires_at) return failure('APPROVAL_EXPIRED', 'Confirm the action again.');
      this.ctx.storage.sql.exec('UPDATE ledger_approvals SET consumed_request_id=? WHERE approval_id=?',input.requestId,input.approvalId);
      return {ok:true,replayed:false};
    });
  }

  /** Private maintenance interface only; caller must fence D1 before resuming. */
  beginMaintenance(expectedGeneration: number, operationId: string): LedgerStateResult {
    if (!validGeneration(expectedGeneration) || !validId(operationId)) return failure('INVALID_INPUT', 'Invalid maintenance identity or generation.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (!control) return failure('UNAUTHORISED', 'The learner is not configured.');
      if (control.mode !== 'active') {
        if (control.maintenance_id === operationId && control.generation === expectedGeneration + 1) return this.state(control);
        return failure('MAINTENANCE', 'Another maintenance operation owns the fence.');
      }
      if (expectedGeneration !== control.generation) return failure('STALE_GENERATION', 'The maintenance generation changed.');
      this.ctx.storage.sql.exec('UPDATE ledger_control SET generation=generation+1,mode=\'maintenance\',maintenance_id=? WHERE singleton=1', operationId);
      return { ok: true, generation: control.generation + 1, mode: 'maintenance' };
    });
  }

  /** Future recovery coordinator is responsible for a confirmed matching D1 fence/phase. */
  finishMaintenance(operationId: string): LedgerStateResult {
    if (!validId(operationId)) return failure('INVALID_INPUT', 'Invalid maintenance identity.');
    return this.ctx.storage.transactionSync(() => {
      const control = this.control();
      if (!control) return failure('UNAUTHORISED', 'The learner is not configured.');
      if (control.mode === 'active' && control.completed_id === operationId) return this.state(control);
      if (control.mode !== 'maintenance' || control.maintenance_id !== operationId) {
        return failure('MAINTENANCE_CONFLICT', 'The operation does not own the maintenance fence.');
      }
      this.ctx.storage.sql.exec('UPDATE ledger_control SET mode=\'active\',completed_id=?,maintenance_id=NULL WHERE singleton=1', operationId);
      return { ok: true, generation: control.generation, mode: 'active' };
    });
  }
}
