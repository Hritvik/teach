import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface Reply {
  ok: boolean;
  generation?: number;
  admission?: { learner_id: string; connection_id: string; generation: number; scopes: string[] };
  error?: { code: string; message: string };
  mode?: string;
}

let mf: Miniflare;
let stateDir: string;
const fixture = `
import { SecurityLedger } from ${JSON.stringify(resolve('app/worker/src/security/index.ts'))};
export { SecurityLedger };
export default { async fetch(request, env) {
  const {method,args} = await request.json();
  const stub = env.LEDGER.get(env.LEDGER.idFromName('test-learner'));
  let result;
  switch(method) {
    case 'createPendingGrant': result = await stub.createPendingGrant(...args); break;
    case 'activateGrant': result = await stub.activateGrant(...args); break;
    case 'listConnections': result = await stub.listConnections(...args); break;
    case 'rateLimit': result = await stub.rateLimit(...args); break;
    case 'rateControl': result = await stub.rateControl(...args); break;
    case 'rateRegistration': result = await stub.rateRegistration(...args); break;
    case 'createApproval': result = await stub.createApproval(...args); break;
    case 'consumeApproval': result = await stub.consumeApproval(...args); break;
    case 'configureBudgetPolicy': result = await stub.configureBudgetPolicy(...args); break;
    case 'reserveBudget': result = await stub.reserveBudget(...args); break;
    case 'settleBudget': result = await stub.settleBudget(...args); break;
    case 'budgetStatus': result = await stub.budgetStatus(...args); break;
    case 'bootstrap': result = await stub.bootstrap(...args); break;
    case 'admit': result = await stub.admit(...args); break;
    case 'snapshot': result = await stub.snapshot(...args); break;
    case 'revoke': result = await stub.revoke(...args); break;
    case 'registerGrant': result = await stub.registerGrant(...args); break;
    case 'beginMaintenance': result = await stub.beginMaintenance(...args); break;
    case 'finishMaintenance': result = await stub.finishMaintenance(...args); break;
    default: throw new Error('Unknown test operation');
  }
  return Response.json(result);
}};`;

async function runtime(persist: string) {
  const built = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'security-fixture.ts' },
    bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'], write: false });
  const script = built.outputFiles[0]?.text;
  if (!script) throw new Error('Fixture did not bundle');
  return new Miniflare({ ...convertV4MiniflareOptions({ name: 'security-test', modules: true, script, compatibilityDate: '2026-10-29',
    durableObjects: { LEDGER: { className: 'SecurityLedger', useSQLite: true } }, durableObjectsPersist: persist,
    telemetry: { enabled: false } }), resourcePersistencePath: persist });
}
async function call(method: string, ...args: unknown[]): Promise<Reply> {
  const response = await mf.dispatchFetch('http://localhost/test', { method: 'POST', body: JSON.stringify({method,args}) });
  return await response.json() as Reply;
}
const scopes = ['teach:read', 'teach:learn', 'teach:organize'];

beforeEach(async () => {
  stateDir = await mkdtemp(join(tmpdir(), 'teach-security-'));
  mf = await runtime(stateDir);
});
afterEach(async () => { await mf?.dispose(); await rm(stateDir, { recursive: true, force: true }); });

describe('SecurityLedger SQLite admission', () => {
  it('fails closed before bootstrap and for unknown grants', async () => {
    expect((await call('admit', 'g_missing', ['teach:read'], 1)).error?.code).toBe('UNAUTHORISED');
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    expect((await call('snapshot', 'g_missing')).error?.code).toBe('UNAUTHORISED');
  });
  it('bootstraps once and derives the learner, connection and scopes', async () => {
    expect(await call('bootstrap', 'l_synthetic', 'g_first', scopes)).toMatchObject({ok:true,generation:1});
    expect(await call('admit', 'g_first', ['teach:learn'], 1)).toEqual({ok:true,admission:{
      learner_id:'l_synthetic',connection_id:'g_first',generation:1,scopes}});
    expect((await call('bootstrap', 'l_other', 'g_first', scopes)).error?.code).toBe('ALREADY_INITIALISED');
  });
  it('does not expand a grant on an idempotent bootstrap', async () => {
    await call('bootstrap', 'l_synthetic', 'g_first', ['teach:read']);
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    expect((await call('admit', 'g_first', ['teach:learn'], 1)).error?.code).toBe('FORBIDDEN');
  });
  it('requires the current generation for mutations and never upgrades stale requests', async () => {
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    expect((await call('admit', 'g_first', ['teach:learn'])).error?.code).toBe('STALE_GENERATION');
    expect((await call('admit', 'g_first', ['teach:learn'], 0)).error?.code).toBe('STALE_GENERATION');
    expect((await call('admit', 'g_first', ['teach:read'])).ok).toBe(true);
  });
  it('denies unsupported scopes and validates bootstrap input', async () => {
    expect((await call('bootstrap', '', 'g_first', scopes)).error?.code).toBe('INVALID_INPUT');
    expect((await call('bootstrap', 'l_synthetic', 'g_first', ['admin'])).error?.code).toBe('INVALID_INPUT');
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    expect((await call('admit', 'g_first', ['teach:delete'], 1)).error?.code).toBe('FORBIDDEN');
    expect((await call('admit', 'g_first', [], 1)).error?.code).toBe('INVALID_INPUT');
  });
  it('revokes one grant before acknowledgement without affecting another grant', async () => {
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    await call('registerGrant', 'g_second', ['teach:read']);
    expect((await call('revoke', 'g_first')).ok).toBe(true);
    expect((await call('admit', 'g_first', ['teach:read'], 1)).error?.code).toBe('UNAUTHORISED');
    expect((await call('admit', 'g_second', ['teach:read'], 1)).ok).toBe(true);
    expect((await call('bootstrap', 'l_synthetic', 'g_first', scopes)).error?.code).toBe('REVOKED_GRANT');
    expect((await call('registerGrant', 'g_first', scopes)).error?.code).toBe('REVOKED_GRANT');
  });
  it('persists grants and revocation across runtime restarts', async () => {
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    await call('registerGrant', 'g_second', ['teach:read']);
    await call('revoke', 'g_first');
    await mf.dispose(); mf = await runtime(stateDir);
    expect((await call('admit', 'g_first', ['teach:read'], 1)).error?.code).toBe('UNAUTHORISED');
    expect((await call('snapshot', 'g_second')).generation).toBe(1);
  });
  it('fences maintenance and requires matching ownership to resume', async () => {
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    expect(await call('beginMaintenance', 1, 'maint_1')).toMatchObject({ok:true,generation:2,mode:'maintenance'});
    expect((await call('admit', 'g_first', ['teach:learn'], 2)).error?.code).toBe('MAINTENANCE');
    expect((await call('beginMaintenance', 2, 'maint_2')).error?.code).toBe('MAINTENANCE');
    expect((await call('finishMaintenance', 'wrong')).error?.code).toBe('MAINTENANCE_CONFLICT');
    expect((await call('finishMaintenance', 'maint_1')).ok).toBe(true);
    expect((await call('admit', 'g_first', ['teach:learn'], 1)).error?.code).toBe('STALE_GENERATION');
    expect((await call('admit', 'g_first', ['teach:learn'], 2)).ok).toBe(true);
  });
  it('linearises competing maintenance operations and admits no old-generation winner', async () => {
    await call('bootstrap', 'l_synthetic', 'g_first', scopes);
    const results = await Promise.all(Array.from({length:8}, (_,i) => call('beginMaintenance', 1, `maint_${i}`)));
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect((await call('admit', 'g_first', ['teach:learn'], 1)).ok).toBe(false);
  });
});


describe('Phase B real SQLite authority and restart', () => {
  it('persists pending denial, activated connection, rate consumption and one-use approval across restart', async () => {
    await call('bootstrap','l_synthetic','g_first',scopes);
    await call('createPendingGrant',{grantId:'g_pending',clientId:'client_1',subject:'owner_sub',scopes:['teach:read']});
    expect((await call('admit','g_pending',['teach:read'])).ok).toBe(false);
    const approval={approvalId:'ap_1',actionHash:'a'.repeat(64),targetVersions:{c_1:1},generation:1};
    expect((await call('createApproval',approval)).ok).toBe(true);
    expect(await call('consumeApproval',{...approval,requestId:'req_1'})).toMatchObject({ok:true,replayed:false});
    for(let i=0;i<10;i++) expect((await call('rateControl','session_1')).ok).toBe(true);
    await mf.dispose(); mf=await runtime(stateDir);
    expect((await call('admit','g_pending',['teach:read'])).ok).toBe(false);
    expect((await call('activateGrant','g_pending')).ok).toBe(true);
    expect((await call('admit','g_pending',['teach:read'])).ok).toBe(true);
    expect(await call('listConnections')).toMatchObject({ok:true,connections:expect.arrayContaining([expect.objectContaining({grantId:'g_pending',status:'active',clientId:'client_1'})])});
    expect(await call('consumeApproval',{...approval,requestId:'req_1'})).toMatchObject({ok:true,replayed:true});
    expect((await call('consumeApproval',{...approval,requestId:'req_other'})).ok).toBe(false);
    expect(await call('rateControl','session_1')).toMatchObject({ok:false,error:{code:'RATE_LIMITED'}});
    await call('revoke','g_pending');
    expect((await call('activateGrant','g_pending')).ok).toBe(false);
  });
  it('allows only one canonical consumer under competing requests', async () => {
    await call('bootstrap','l_synthetic','g_first',scopes);
    const approval={approvalId:'ap_race',actionHash:'b'.repeat(64),targetVersions:{c_1:2},generation:1};
    await call('createApproval',approval);
    const results=await Promise.all(['req_1','req_2'].map(requestId=>call('consumeApproval',{...approval,requestId})));
    expect(results.filter(result=>result.ok)).toHaveLength(1);
    expect(results.filter(result=>!result.ok)).toHaveLength(1);
  });
});


describe('inference budget real SQLite concurrency and persistence',()=>{
  const policy=()=>({period:new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit'}).format(new Date()),timezone:'UTC',modelSnapshot:'gpt-5.4-mini-2026-03-17',pricePolicy:'openai-global-2026-10-v1',authorized:true,verified:true});
  const reserve=(n:number)=>({dispatchId:`dispatch_${n}`,jobId:`job_${n}`,grantId:'g_first',generation:1,pricePolicy:'openai-global-2026-10-v1',expectedTimezone:'UTC'});
  it('serializes simultaneous admissions against the cap and retains reservations across restart and generation fences',async()=>{
    await call('bootstrap','l_synthetic','g_first',scopes);
    expect((await call('configureBudgetPolicy',policy())).ok).toBe(true);
    const results=await Promise.all(Array.from({length:20},(_,index)=>call('reserveBudget',reserve(index))));
    expect(results.filter(result=>result.ok)).toHaveLength(16);
    expect(results.filter(result=>result.error?.code==='BUDGET_EXHAUSTED')).toHaveLength(4);
    await mf.dispose();mf=await runtime(stateDir);
    expect(await call('budgetStatus')).toMatchObject({ok:true,budget:{reservedMicroUSD:4947456,remainingMicroUSD:52544}});
    await call('beginMaintenance',1,'restore_fence');await call('finishMaintenance','restore_fence');
    expect((await call('reserveBudget',{...reserve(21),generation:2})).error?.code).toBe('BUDGET_EXHAUSTED');
    expect((await call('reserveBudget',reserve(21))).error?.code).toBe('STALE_GENERATION');
  });
  it('denies duplicate physical-call identities and releases only confirmed usage after revocation',async()=>{
    await call('bootstrap','l_synthetic','g_first',scopes);await call('configureBudgetPolicy',policy());
    const results=await Promise.all([call('reserveBudget',reserve(1)),call('reserveBudget',reserve(1))]);
    expect(results.filter(result=>result.ok)).toHaveLength(1);
    expect(results.filter(result=>result.error?.code==='DISPATCH_ALREADY_RESERVED')).toHaveLength(1);
    await call('settleBudget',{dispatchId:'dispatch_1',outcome:'unknown'});await call('revoke','g_first');
    await mf.dispose();mf=await runtime(stateDir);
    expect(await call('budgetStatus')).toMatchObject({ok:true,budget:{reservedMicroUSD:309216}});
    expect((await call('settleBudget',{dispatchId:'dispatch_1',outcome:'confirmed',inputTokens:200,outputTokens:20})).ok).toBe(true);
    expect(await call('budgetStatus')).toMatchObject({ok:true,budget:{settledMicroUSD:240,reservedMicroUSD:0}});
  });
});
