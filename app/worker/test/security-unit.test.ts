import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// The state machine is additionally covered in-process for source-level V8 coverage.
// security-ledger.test.ts separately exercises the real Cloudflare base class and SQLite DO runtime.
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Cloudflare.Env;
    constructor(ctx: DurableObjectState, env: Cloudflare.Env) { this.ctx = ctx; this.env = env; }
  },
}));
import { SecurityLedger } from '../src/security/index.ts';

let db: DatabaseSync;
let ledger: SecurityLedger;
const scopes = ['teach:read', 'teach:learn', 'teach:organize'];
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  const state = {
    storage: {
      sql: {
        exec(query: string, ...args: (string | number | null)[]) {
          if (query.startsWith('CREATE TABLE')) { db.exec(query); return { toArray: () => [] }; }
          const rows = db.prepare(query).all(...args);
          return { toArray: () => rows };
        },
      },
      transactionSync<T>(fn: () => T): T {
        db.exec('BEGIN IMMEDIATE');
        try { const result = fn(); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    },
  } as unknown as DurableObjectState;
  ledger = new SecurityLedger(state, {});
});
afterEach(() => { vi.useRealTimers(); db.close(); });

describe('SecurityLedger authority decisions', () => {
  it('rejects invalid or unconfigured identities before grant creation', () => {
    expect(ledger.bootstrap('', 'g_1', scopes).ok).toBe(false);
    expect(ledger.bootstrap('l_1', 'g_1', ['teach:read', 'teach:read']).ok).toBe(false);
    expect(ledger.bootstrap('l_1', 'g_1', ['admin']).ok).toBe(false);
    expect(ledger.registerGrant('g_1', scopes).ok).toBe(false);
    expect(ledger.snapshot('g_missing').ok).toBe(false);
    expect(ledger.revoke('g_missing').ok).toBe(false);
    expect(ledger.beginMaintenance(1, 'op_1').ok).toBe(false);
    expect(ledger.finishMaintenance('op_1').ok).toBe(false);
  });
  it('does not widen scope or change configured learner through repeated setup', () => {
    expect(ledger.bootstrap('l_1', 'g_1', ['teach:read'])).toMatchObject({ok:true,generation:1});
    expect(ledger.bootstrap('l_1', 'g_1', scopes).ok).toBe(true);
    expect(ledger.bootstrap('l_2', 'g_1', scopes).ok).toBe(false);
    expect(ledger.bootstrap('l_1', 'g_2', scopes).ok).toBe(false);
    expect(ledger.admit('g_1', ['teach:learn'], 1)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    expect(ledger.registerGrant('g_1', scopes).ok).toBe(false);
    expect(ledger.registerGrant('g_1', ['teach:read']).ok).toBe(true);
    expect(ledger.registerGrant('g_2', scopes).ok).toBe(true);
    expect(ledger.admit('g_2', ['teach:learn'], 1)).toMatchObject({ok:true,admission:{learner_id:'l_1',generation:1}});
  });
  it('validates every admission and never treats an empty scope request as authorised', () => {
    ledger.bootstrap('l_1', 'g_1', scopes);
    expect(ledger.admit('', ['teach:read']).ok).toBe(false);
    expect(ledger.admit('g_missing', ['teach:read']).ok).toBe(false);
    expect(ledger.admit('g_1', []).ok).toBe(false);
    expect(ledger.admit('g_1', ['teach:admin'], 1).ok).toBe(false);
    expect(ledger.admit('g_1', ['teach:read'], -1).ok).toBe(false);
    expect(ledger.admit('g_1', ['teach:learn']).ok).toBe(false);
    expect(ledger.admit('g_1', ['teach:read']).ok).toBe(true);
    expect(ledger.snapshot('g_1')).toMatchObject({ok:true,generation:1,mode:'active'});
  });
  it('makes revocation idempotent and denies resurrection by grant re-registration', () => {
    ledger.bootstrap('l_1', 'g_1', scopes);
    ledger.registerGrant('g_2', ['teach:read']);
    expect(ledger.revoke('').ok).toBe(false);
    expect(ledger.revoke('g_1').ok).toBe(true);
    expect(ledger.revoke('g_1').ok).toBe(true);
    expect(ledger.admit('g_1', ['teach:read']).ok).toBe(false);
    expect(ledger.bootstrap('l_1', 'g_1', scopes)).toMatchObject({ok:false,error:{code:'REVOKED_GRANT'}});
    expect(ledger.registerGrant('g_1', scopes)).toMatchObject({ok:false,error:{code:'REVOKED_GRANT'}});
    expect(ledger.registerGrant('', scopes).ok).toBe(false);
    expect(ledger.admit('g_2', ['teach:read']).ok).toBe(true);
  });
  it('retains exclusive generation-fenced maintenance ownership and idempotent completion', () => {
    ledger.bootstrap('l_1', 'g_1', scopes);
    expect(ledger.beginMaintenance(0, 'op_1').ok).toBe(false);
    expect(ledger.beginMaintenance(1, '').ok).toBe(false);
    expect(ledger.beginMaintenance(2, 'op_1')).toMatchObject({ok:false,error:{code:'STALE_GENERATION'}});
    expect(ledger.beginMaintenance(1, 'op_1')).toMatchObject({ok:true,generation:2});
    expect(ledger.beginMaintenance(1, 'op_1')).toMatchObject({ok:true,generation:2});
    expect(ledger.beginMaintenance(2, 'op_2')).toMatchObject({ok:false,error:{code:'MAINTENANCE'}});
    expect(ledger.admit('g_1', ['teach:learn'], 2)).toMatchObject({ok:false,error:{code:'MAINTENANCE'}});
    expect(ledger.admit('g_1', ['teach:read']).ok).toBe(true);
    expect(ledger.finishMaintenance('').ok).toBe(false);
    expect(ledger.finishMaintenance('wrong').ok).toBe(false);
    expect(ledger.finishMaintenance('op_1')).toMatchObject({ok:true,generation:2,mode:'active'});
    expect(ledger.finishMaintenance('op_1')).toMatchObject({ok:true,generation:2});
    expect(ledger.admit('g_1', ['teach:learn'], 1).ok).toBe(false);
    expect(ledger.admit('g_1', ['teach:learn'], 2).ok).toBe(true);
  });
});


describe('Phase B trusted ledger operations', () => {
  it('keeps pending grants denied, binds identity and scopes and prevents resurrection', () => {
    ledger.bootstrap('l_1', 'g_1', scopes);
    const pending = { grantId: 'g_new', clientId: 'https://client.example/metadata', subject: 'google-owner', scopes: ['teach:read'] };
    expect(ledger.createPendingGrant(pending)).toMatchObject({ok:true});
    expect(ledger.admit('g_new', ['teach:read']).ok).toBe(false);
    expect(ledger.registerGrant('g_new', scopes).ok).toBe(false);
    expect(ledger.createPendingGrant({...pending,subject:'other'}).ok).toBe(false);
    expect(ledger.activateGrant('g_new')).toMatchObject({ok:true});
    expect(ledger.activateGrant('g_new')).toMatchObject({ok:true});
    expect(ledger.admit('g_new', ['teach:learn'], 1).ok).toBe(false);
    expect(ledger.listConnections()).toMatchObject({ok:true,connections:expect.arrayContaining([expect.objectContaining({grantId:'g_new',clientId:pending.clientId,subject:pending.subject,status:'active'})])});
    ledger.revoke('g_new');
    expect(ledger.activateGrant('g_new').ok).toBe(false);
    expect(ledger.createPendingGrant(pending).ok).toBe(false);
    ledger.createPendingGrant({...pending,grantId:'g_pending'});
    expect(ledger.revoke('g_pending').ok).toBe(true);
    expect(ledger.activateGrant('g_pending').ok).toBe(false);
  });
  it('enforces authoritative burst and sustained limits independently per grant', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));
    ledger.bootstrap('l_1', 'g_1', scopes); ledger.registerGrant('g_2', scopes);
    for(let i=0;i<10;i++) expect(ledger.rateLimit('g_1')).toEqual({ok:true});
    expect(ledger.rateLimit('g_1')).toMatchObject({ok:false,error:{code:'RATE_LIMITED'},retryAfterSeconds:1});
    expect(ledger.rateLimit('g_2')).toEqual({ok:true});
    vi.advanceTimersByTime(1000);
    expect(ledger.rateLimit('g_1')).toEqual({ok:true});
    expect(ledger.rateLimit('g_1').ok).toBe(false);
    vi.advanceTimersByTime(60000);
    for(let i=0;i<10;i++) expect(ledger.rateLimit('g_1').ok).toBe(true);
    expect(ledger.rateLimit('g_1').ok).toBe(false);
    ledger.revoke('g_2'); expect(ledger.rateLimit('g_2').ok).toBe(false);
  });
  it('binds one-use approvals to action, versions, generation, lifetime and canonical retry', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));
    ledger.bootstrap('l_1', 'g_1', scopes);
    const approval={approvalId:'ap_1',actionHash:'a'.repeat(64),targetVersions:{c_1:2,c_2:1},generation:1};
    expect(ledger.createApproval(approval)).toMatchObject({ok:true,approvalId:'ap_1'});
    const consume={...approval,requestId:'req_1'};
    expect(ledger.consumeApproval({...consume,actionHash:'b'.repeat(64)}).ok).toBe(false);
    expect(ledger.consumeApproval({...consume,targetVersions:{c_1:3,c_2:1}}).ok).toBe(false);
    expect(ledger.consumeApproval({...consume,generation:2}).ok).toBe(false);
    expect(ledger.consumeApproval({...consume,targetVersions:{c_2:1,c_1:2}})).toEqual({ok:true,replayed:false});
    expect(ledger.consumeApproval(consume)).toEqual({ok:true,replayed:true});
    expect(ledger.consumeApproval({...consume,requestId:'req_other'}).ok).toBe(false);
    expect(ledger.createApproval(approval).ok).toBe(false);
    ledger.createApproval({...approval,approvalId:'ap_expired'});
    vi.advanceTimersByTime(600001);
    expect(ledger.consumeApproval({...consume,approvalId:'ap_expired'})).toMatchObject({ok:false,error:{code:'APPROVAL_EXPIRED'}});
    ledger.createApproval({...approval,approvalId:'ap_fenced'});
    ledger.beginMaintenance(1,'maintenance_1');
    expect(ledger.consumeApproval({...consume,approvalId:'ap_fenced'}).ok).toBe(false);
  });
});


describe('public endpoint budgets', () => {
  it('bounds control posts and registrations in separate persisted windows', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));
    for(let i=0;i<10;i++) expect(ledger.rateControl('session_1').ok).toBe(true);
    expect(ledger.rateControl('session_1')).toMatchObject({ok:false,retryAfterSeconds:60});
    for(let i=0;i<5;i++) expect(ledger.rateRegistration('ip_hash').ok).toBe(true);
    expect(ledger.rateRegistration('ip_hash')).toMatchObject({ok:false,retryAfterSeconds:3600});
    vi.advanceTimersByTime(60000); expect(ledger.rateControl('session_1').ok).toBe(true);
    expect(ledger.rateRegistration('ip_hash').ok).toBe(false);
    vi.advanceTimersByTime(3540000); expect(ledger.rateRegistration('ip_hash').ok).toBe(true);
    expect(ledger.rateControl('').ok).toBe(false);
    expect(ledger.rateRegistration('bad key').ok).toBe(false);
  });
});


it('configures a trusted learner without granting credentials and validates new RPC boundaries', () => {
  expect(ledger.configureLearner('').ok).toBe(false);
  expect(ledger.listConnections().ok).toBe(false);
  expect(ledger.createPendingGrant({grantId:'g_1',clientId:'client',subject:'sub',scopes}).ok).toBe(false);
  expect(ledger.createApproval({approvalId:'ap_1',actionHash:'a'.repeat(64),targetVersions:{},generation:1}).ok).toBe(false);
  expect(ledger.activateGrant('g_1').ok).toBe(false);
  expect(ledger.rateLimit('g_1').ok).toBe(false);
  expect(ledger.configureLearner('l_1')).toMatchObject({ok:true,generation:1});
  expect(ledger.configureLearner('l_1').ok).toBe(true);
  expect(ledger.configureLearner('l_other').ok).toBe(false);
  expect(ledger.listConnections()).toEqual({ok:true,connections:[]});
  expect(ledger.admit('g_1',['teach:read']).ok).toBe(false);
  expect(ledger.activateGrant('').ok).toBe(false);
  expect(ledger.rateLimit('').ok).toBe(false);
  expect(ledger.createPendingGrant({grantId:'',clientId:'client',subject:'sub',scopes}).ok).toBe(false);
  expect(ledger.createApproval({approvalId:'ap_1',actionHash:'bad',targetVersions:{},generation:1}).ok).toBe(false);
  expect(ledger.createApproval({approvalId:'ap_1',actionHash:'a'.repeat(64),targetVersions:{c_1:0},generation:1}).ok).toBe(false);
  expect(ledger.consumeApproval({approvalId:'ap_1',actionHash:'bad',targetVersions:{},generation:1,requestId:''}).ok).toBe(false);
  expect(ledger.consumeApproval({approvalId:'ap_missing',actionHash:'a'.repeat(64),targetVersions:{},generation:1,requestId:'req_1'}).ok).toBe(false);
  ledger.beginMaintenance(1,'op_1');
  expect(ledger.createPendingGrant({grantId:'g_1',clientId:'client',subject:'sub',scopes}).ok).toBe(false);
  expect(ledger.createApproval({approvalId:'ap_1',actionHash:'a'.repeat(64),targetVersions:{},generation:1}).ok).toBe(false);
});

const budgetPolicy={period:'2026-10',timezone:'Asia/Kolkata',modelSnapshot:'gpt-5.4-mini-2026-03-17',pricePolicy:'openai-global-2026-10-v1',authorized:true,verified:true} as const;
function readyBudget(){vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));ledger.bootstrap('l_1','g_1',scopes);return ledger.configureBudgetPolicy(budgetPolicy);}
const reservation=(n:number,jobId=`job_${n}`)=>({dispatchId:`dispatch_${n}`,jobId,grantId:'g_1',generation:1,pricePolicy:budgetPolicy.pricePolicy,expectedTimezone:budgetPolicy.timezone});
describe('authoritative inference liability budget',()=>{
 it('is disabled without trusted current-month authorization and verified pinned policy',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));ledger.bootstrap('l_1','g_1',scopes);
  expect(ledger.reserveBudget(reservation(1))).toMatchObject({ok:false,error:{code:'BUDGET_DISABLED'}});
  expect(ledger.configureBudgetPolicy({...budgetPolicy,authorized:false})).toMatchObject({ok:false});
  expect(ledger.configureBudgetPolicy({...budgetPolicy,verified:false})).toMatchObject({ok:false});
  expect(ledger.configureBudgetPolicy({...budgetPolicy,modelSnapshot:'floating-model'})).toMatchObject({ok:false});
  expect(ledger.configureBudgetPolicy({...budgetPolicy,period:'2026-09'})).toMatchObject({ok:false});
  expect(ledger.configureBudgetPolicy({...budgetPolicy,timezone:'not/a/timezone'})).toMatchObject({ok:false});
  expect(ledger.configureBudgetPolicy(budgetPolicy)).toMatchObject({ok:true});
  expect(ledger.configureBudgetPolicy(budgetPolicy)).toMatchObject({ok:true});
  expect(ledger.configureBudgetPolicy({...budgetPolicy,timezone:'UTC'})).toMatchObject({ok:false});
 });
 it('reserves the full conservative upper bound atomically and refuses duplicate or third physical calls',()=>{
  readyBudget();
  expect(ledger.reserveBudget(reservation(1,'same_job'))).toMatchObject({ok:true,reservation:{reservedMicroUSD:309216,period:'2026-10'}});
  expect(ledger.reserveBudget(reservation(1,'same_job')).ok).toBe(false);
  expect(ledger.reserveBudget(reservation(2,'same_job')).ok).toBe(true);
  expect(ledger.reserveBudget(reservation(3,'same_job'))).toMatchObject({ok:false,error:{code:'CALL_LIMIT_EXCEEDED'}});
  for(let n=3;n<=16;n++)expect(ledger.reserveBudget(reservation(n)).ok).toBe(true);
  expect(ledger.reserveBudget(reservation(17))).toMatchObject({ok:false,error:{code:'BUDGET_EXHAUSTED'}});
  expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{limitMicroUSD:5000000,reservedMicroUSD:4947456,settledMicroUSD:0,remainingMicroUSD:52544}});
 });
 it('requires a live capable grant and current generation at reservation, but settlement survives revocation',()=>{
  readyBudget();ledger.registerGrant('g_read',['teach:read']);
  expect(ledger.reserveBudget({...reservation(1),grantId:'g_read'}).ok).toBe(false);
  expect(ledger.reserveBudget({...reservation(1),generation:2}).ok).toBe(false);
  expect(ledger.reserveBudget({...reservation(1),pricePolicy:'other'}).ok).toBe(false);
  expect(ledger.reserveBudget(reservation(1)).ok).toBe(true);ledger.revoke('g_1');
  expect(ledger.reserveBudget(reservation(2)).ok).toBe(false);
  expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:1000,outputTokens:100})).toMatchObject({ok:true});
  expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{settledMicroUSD:1200,reservedMicroUSD:0}});
 });
 it('settles trustworthy usage once and keeps ambiguous calls fully reserved across month rollover',()=>{
  readyBudget();ledger.reserveBudget(reservation(1));
  expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'unknown'})).toMatchObject({ok:true});
  expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{reservedMicroUSD:309216}});
  vi.setSystemTime(new Date('2026-10-31T18:31:00Z'));
  expect(ledger.reserveBudget(reservation(2))).toMatchObject({ok:false,error:{code:'BUDGET_DISABLED'}});
  expect(ledger.configureBudgetPolicy({...budgetPolicy,period:'2026-11'}).ok).toBe(true);
  expect(ledger.reserveBudget(reservation(2))).toMatchObject({ok:true,reservation:{period:'2026-11'}});
  expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:1001,outputTokens:1}).ok).toBe(true);
  expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:1001,outputTokens:1}).ok).toBe(true);
  expect(ledger.budgetStatus('2026-10')).toMatchObject({ok:true,budget:{settledMicroUSD:756,reservedMicroUSD:0}});
  expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{period:'2026-11',reservedMicroUSD:309216,settledMicroUSD:0}});
 });
 it('holds the higher known liability and suspends dispatch on discrepancies',()=>{
  readyBudget();ledger.reserveBudget(reservation(1));
  ledger.settleBudget({dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:10,outputTokens:1});
  expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'disputed',knownMicroUSD:400000})).toMatchObject({ok:true});
  expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{suspended:true,reservedMicroUSD:400000}});
  expect(ledger.reserveBudget(reservation(2))).toMatchObject({ok:false,error:{code:'BUDGET_SUSPENDED'}});
  expect(ledger.configureBudgetPolicy(budgetPolicy).ok).toBe(false);
  expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:0,outputTokens:0}).ok).toBe(false);
 });
 it('validates runtime payloads without releasing liability from unknown or malformed usage',()=>{
  readyBudget();ledger.reserveBudget(reservation(1));
  for(const input of [{dispatchId:'unknown',outcome:'confirmed',inputTokens:1,outputTokens:1},{dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:-1,outputTokens:0},{dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:1.1,outputTokens:0},{dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:1,outputTokens:0,extra:true}])expect(ledger.settleBudget(input).ok).toBe(false);
  expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{reservedMicroUSD:309216}});
  expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:400001,outputTokens:1})).toMatchObject({ok:false,error:{code:'BUDGET_SUSPENDED'}});
  expect(ledger.reserveBudget(reservation(2)).ok).toBe(false);
 });
});


it('reserves verification with organize authority and grading with learn authority only',()=>{
 readyBudget();ledger.registerGrant('g_author',['teach:read','teach:organize']);ledger.registerGrant('g_grader',['teach:read','teach:learn']);
 expect(ledger.reserveBudget({...reservation(1),grantId:'g_author',purpose:'key_verify'})).toMatchObject({ok:true});
 expect(ledger.reserveBudget({...reservation(2),grantId:'g_author',purpose:'grade'})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(ledger.reserveBudget({...reservation(3),grantId:'g_grader',purpose:'key_verify'})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(ledger.reserveBudget({...reservation(4),grantId:'g_grader',purpose:'regrade'})).toMatchObject({ok:true});
});

it('globally suspends an already enabled new month when an earlier month is disputed',()=>{
 readyBudget();ledger.reserveBudget(reservation(1));
 vi.setSystemTime(new Date('2026-10-31T18:31:00Z'));
 expect(ledger.configureBudgetPolicy({...budgetPolicy,period:'2026-11'}).ok).toBe(true);
 expect(ledger.reserveBudget(reservation(2)).ok).toBe(true);
 expect(ledger.settleBudget({dispatchId:'dispatch_1',outcome:'disputed',knownMicroUSD:400000}).ok).toBe(true);
 expect(ledger.reserveBudget(reservation(3))).toMatchObject({ok:false,error:{code:'BUDGET_SUSPENDED'}});
 expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{period:'2026-11',suspended:true,enabled:false}});
 expect(ledger.configureBudgetPolicy({...budgetPolicy,period:'2026-11'})).toMatchObject({ok:false,error:{code:'BUDGET_SUSPENDED'}});
});

it('rejects a dispatch timezone mismatch at the learner-local month boundary before reserving liability',()=>{
 readyBudget();vi.setSystemTime(new Date('2026-10-31T18:31:00Z'));
 expect(ledger.reserveBudget({...reservation(1),expectedTimezone:'UTC'})).toMatchObject({ok:false,error:{code:'PRICE_POLICY_UNVERIFIED'}});
 expect(ledger.configureBudgetPolicy({...budgetPolicy,period:'2026-11'}).ok).toBe(true);
 expect(ledger.reserveBudget({...reservation(1),expectedTimezone:'Asia/Kolkata'})).toMatchObject({ok:true,reservation:{period:'2026-11'}});
 expect(ledger.budgetStatus()).toMatchObject({ok:true,budget:{timezone:'Asia/Kolkata',period:'2026-11',reservedMicroUSD:309216}});
 expect(ledger.budgetStatus('2026-10')).toMatchObject({ok:true,budget:{reservedMicroUSD:0}});
});

describe('learner initialization after partial authority loss',()=>{
 it('refuses to recreate authority when existing grants survive control loss',()=>{
  ledger.bootstrap('l_1','g_active',scopes);ledger.registerGrant('g_revoked',scopes);ledger.revoke('g_revoked');
  db.exec('DELETE FROM ledger_control');
  expect(ledger.configureLearner('l_1')).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
  expect(ledger.admit('g_active',['teach:read']).ok).toBe(false);
  expect(ledger.admit('g_revoked',['teach:read']).ok).toBe(false);
  expect(db.prepare('SELECT COUNT(*) AS n FROM ledger_control').get()).toMatchObject({n:0});
 });
 it.each([
  "INSERT INTO ledger_grants VALUES('g','[]','revoked',NULL)",
  "INSERT INTO ledger_connections VALUES('g','client','sub','[]','2026-10-29')",
  "INSERT INTO ledger_approvals VALUES('ap','hash','{}',1,0,NULL)",
  "INSERT INTO ledger_budget_config VALUES(1,'UTC')",
  "INSERT INTO ledger_budget_months VALUES('2026-10','policy','model',5000000,0)",
  "PRAGMA foreign_keys=OFF; INSERT INTO ledger_budget_reservations VALUES('dispatch','job','2026-10',309216,309216,'unknown',NULL,NULL,0)",
 ])('fails closed if any prior authority state exists: %s',sql=>{
  db.exec(sql);
  expect(ledger.configureLearner('l_1')).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
  expect(db.prepare('SELECT COUNT(*) AS n FROM ledger_control').get()).toMatchObject({n:0});
 });
 it('allows genuinely fresh initialization after public registration rate accounting',()=>{
  expect(ledger.rateRegistration('a'.repeat(64)).ok).toBe(true);
  expect(ledger.configureLearner('l_1')).toMatchObject({ok:true,generation:1});
  expect(ledger.listConnections()).toEqual({ok:true,connections:[]});
 });
});
