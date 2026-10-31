import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runtime, learnerId, grantId } from '../../../tests/runtime.ts';
import { createAssessmentRunner } from '../src/grading/runner.ts';
let state: Awaited<ReturnType<typeof runtime>>;
const at = new Date('2026-10-29T12:00:00Z');
const itemId = 'it_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conceptId = 'c_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const jobId = 'j_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const validRequest = {
 job_id:jobId, dispatch_id:'physical', purpose:'key_verify', attempt_id:null, item_id:itemId,item_version:1,key_version:1,verification_id:null,
 protocol_version:1,rules_version:1,prompt_version:1,recovery_generation:1,job_revision:1,
 item:{stem:'What makes retry safe?',level:1,essential_context:''},key_points:[{point_id:'p',criterion:'Stable identity',required:true,anchor_ids:['a']}],
 captures:[{anchor_id:'a',capture_hash:'a'.repeat(64),passage:'Retry uses the same identity.'}],answer:null,exact_key:null,
};
const completeResult = {status:'completed',result:{points:[{point_id:'p',verdict:'supported',anchor_ids:['a'],reason:'Captured.'}],exact_key_verdict:null,exact_key_point_ids:[],exact_key_reason:null},usage:{inputTokens:100,outputTokens:20},providerRequestId:'request',promptHash:'a'.repeat(64),schemaHash:'b'.repeat(64)};
beforeEach(async()=>{
 state=await runtime();
 await state.env.LEARNING_DB.batch([
  state.env.LEARNING_DB.prepare("INSERT INTO concepts(id,learner_id,realm,area,slug,title,purpose,origin) VALUES(?,?,'cs','queues','retry','Retry','Retry','seed')").bind(conceptId,learnerId),
  state.env.LEARNING_DB.prepare("INSERT INTO items(id,learner_id,concept_id,level,type) VALUES(?,?,?,1,'free_text')").bind(itemId,learnerId,conceptId),
  state.env.LEARNING_DB.prepare("INSERT INTO item_versions VALUES(?,1,'Retry?','{}','production','[]','[]',NULL,?)").bind(itemId,'a'.repeat(64)),
  state.env.LEARNING_DB.prepare("INSERT INTO grade_jobs(job_id,identity_hash,purpose,item_id,item_version,key_version,capture_set_hash,protocol_version,rules_version,prompt_version,model_snapshot,recovery_generation,job_revision,status,physical_call_count,created_at,updated_at,actor_connection_id) VALUES(?,?,'key_verify',?,1,1,?,1,1,1,'gpt-5.4-mini-2026-03-17',1,1,'queued',0,?,?,?)").bind(jobId,'b'.repeat(64),itemId,'c'.repeat(64),at.toISOString(),at.toISOString(),grantId),
 ]);
});
afterEach(async()=>{await state?.mf.dispose();});
function fixture() {
 let clock=new Date(at);
 const reserveBudget=vi.fn(async(_input:unknown)=>({ok:true as const})); const settleBudget=vi.fn(async(_input:unknown)=>({ok:true as const}));
 const invoke=vi.fn(async()=>completeResult);
 const load=vi.fn(async(_db:unknown,_jobId:string,_actor:unknown)=>({request:validRequest,job:{}}));
 const complete=vi.fn(async(_envelope:unknown,_actor:unknown)=>{await state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET status='succeeded' WHERE job_id=?").bind(jobId).run();return {ok:true,data:{},meta:{recovery_generation:1,as_of_seq:1,projection_revision:1,rules_version:1,replayed:false}};});
 const ledger={admit:state.ledger.admit.bind(state.ledger),reserveBudget,settleBudget};
 const config={enabled:true,apiKey:'test-only',pricePolicy:{verified:true,modelSnapshot:'gpt-5.4-mini-2026-03-17',region:'global',priceVersion:'openai-global-2026-10-26',verifiedMonth:'2026-10',timezone:'Asia/Kolkata'}};
 const runner=createAssessmentRunner({db:state.env.LEARNING_DB,ledger,learnerId,modelConfig:config,pricePolicy:'openai-global-2026-10-v1'}, {now:()=>clock,invoke:invoke as never,load:load as never,complete:complete as never});
 return {runner,invoke,load,complete,reserveBudget,settleBudget,config,advance:(ms:number)=>{clock=new Date(clock.getTime()+ms);}};
}
describe('assessment job runner',()=>{
 it('claims one physical dispatch under duplicate concurrent deliveries and settles confirmed usage',async()=>{
  const f=fixture();const result=await Promise.all([f.runner.run({jobId,generation:1}),f.runner.run({jobId,generation:1})]);
  expect(f.invoke).toHaveBeenCalledTimes(1);expect(f.reserveBudget).toHaveBeenCalledTimes(1);expect(f.settleBudget).toHaveBeenCalledWith(expect.objectContaining({outcome:'confirmed',inputTokens:100,outputTokens:20}));
  expect(f.complete).toHaveBeenCalledTimes(1);expect(result.some(value=>value.status==='succeeded')).toBe(true);
 });
 it('keeps disabled or exhausted work pending without invoking a model',async()=>{
  const f=fixture();f.reserveBudget.mockResolvedValueOnce({ok:false,error:{code:'BUDGET_EXHAUSTED'}} as never);
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'BUDGET_EXHAUSTED'});expect(f.invoke).not.toHaveBeenCalled();
 });
 it('retains ambiguous cost and requires an explicit delayed retry with a new physical identity',async()=>{
  const f=fixture();f.invoke.mockResolvedValueOnce({status:'pending',reason:'provider_unavailable',ambiguousCost:true} as never);
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending'});
  expect(f.settleBudget).toHaveBeenCalledWith(expect.objectContaining({outcome:'unknown'}));
  await f.runner.run({jobId,generation:1});expect(f.invoke).toHaveBeenCalledTimes(1);
  expect(await f.runner.retry({jobId,generation:1,approved:true})).toMatchObject({status:'pending',reason:'retry_backoff'});
 });
 it('permits only one approved delayed retry with a fresh reservation and dispatch',async()=>{
  const f=fixture();f.invoke.mockResolvedValueOnce({status:'pending',reason:'provider_unavailable',ambiguousCost:true} as never);
  await f.runner.run({jobId,generation:1});f.advance(31000);
  expect(await f.runner.retry({jobId,generation:1,approved:true})).toMatchObject({status:'succeeded'});
  expect(f.invoke).toHaveBeenCalledTimes(2);expect(f.reserveBudget.mock.calls[0]![0]).not.toEqual(f.reserveBudget.mock.calls[1]![0]);
  await state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET status='pending',pending_reason='provider_unavailable' WHERE job_id=?").bind(jobId).run();
  expect(await f.runner.retry({jobId,generation:1,approved:true})).toMatchObject({status:'pending',reason:'physical_call_limit'});expect(f.invoke).toHaveBeenCalledTimes(2);
 });
 it('discards a cancelled in-flight result while settling its physical call',async()=>{
  const f=fixture();let release:(value:typeof completeResult)=>void=()=>{};
  f.invoke.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const running=f.runner.run({jobId,generation:1});await vi.waitFor(()=>expect(f.invoke).toHaveBeenCalledOnce());
  expect(await f.runner.cancel({jobId,generation:1})).toMatchObject({status:'cancelled'});release(completeResult);
  expect(await running).toMatchObject({status:'cancelled'});expect(f.complete).not.toHaveBeenCalled();expect(f.settleBudget).toHaveBeenCalledOnce();
 });
 it('keeps refused and ungradable results pending without retry loops',async()=>{
  const f=fixture();f.invoke.mockResolvedValueOnce({status:'pending',reason:'refusal',ambiguousCost:true} as never);
  await f.runner.run({jobId,generation:1});f.advance(31000);
  expect(await f.runner.retry({jobId,generation:1,approved:true})).toMatchObject({status:'pending',reason:'review_required'});expect(f.invoke).toHaveBeenCalledOnce();
 });
 it('persists a validated result and reconciles an uncommitted finalization without another model call',async()=>{
  const f=fixture();f.complete.mockResolvedValueOnce({ok:false,error:{code:'DEPENDENCY_UNAVAILABLE',message:'uncertain',retryable:true},meta:{}} as never);
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'completion_uncertain'});
  const cached=await state.env.LEARNING_DB.prepare('SELECT result_json FROM grade_jobs WHERE job_id=?').bind(jobId).first('result_json');expect(String(cached)).toContain('prompt_hash');
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'succeeded'});expect(f.invoke).toHaveBeenCalledOnce();expect(f.complete).toHaveBeenCalledTimes(2);
  expect(f.complete.mock.calls[0]![0]).toEqual(f.complete.mock.calls[1]![0]);
 });
 it('does not overwrite a committed job when finalization acknowledgement is lost',async()=>{
  const f=fixture();f.complete.mockImplementationOnce(async()=>{await state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET status='succeeded' WHERE job_id=?").bind(jobId).run();throw new Error('Lost acknowledgement');});
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'succeeded'});
  expect(await state.env.LEARNING_DB.prepare('SELECT status FROM grade_jobs WHERE job_id=?').bind(jobId).first('status')).toBe('succeeded');expect(f.invoke).toHaveBeenCalledOnce();
 });
 it('marks a cancelled pending attempt ungraded without altering an accepted grade',async()=>{
  const session='s_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const verification='iv_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const attempt='at_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await state.env.LEARNING_DB.batch([
   state.env.LEARNING_DB.prepare("INSERT INTO sessions(id,learner_id,started_at) VALUES(?,?,?)").bind(session,learnerId,at.toISOString()),
   state.env.LEARNING_DB.prepare("INSERT INTO item_verifications(id,learner_id,item_id,item_version,capture_set_hash,prompt_version,state,result_json,verifier_provenance_json,seq,result_job_id) VALUES(?,?,?,1,?,1,'supported','{}','{}',1,?)").bind(verification,learnerId,itemId,'a'.repeat(64),jobId),
   state.env.LEARNING_DB.prepare("INSERT INTO attempts(id,learner_id,session_id,item_id,item_version,answer,confidence,help_json,occurred_at,accepted_at,timezone,local_day,state,verification_id) VALUES(?,?,?,?,1,'answer','sure','{}',?,?,'Asia/Kolkata','2026-10-29','pending',?)").bind(attempt,learnerId,session,itemId,at.toISOString(),at.toISOString(),verification),
   state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET attempt_id=?,purpose='grade' WHERE job_id=?").bind(attempt,jobId),
  ]);
  const f=fixture();expect(await f.runner.cancel({jobId,generation:1})).toMatchObject({status:'cancelled'});
  expect(await state.env.LEARNING_DB.prepare('SELECT state FROM attempts WHERE id=?').bind(attempt).first('state')).toBe('ungraded');
 });
 it('holds disabled dispatch, oversized input and invalid wakeups without reserving cost',async()=>{
  const f=fixture();f.config.enabled=false;f.config.pricePolicy.timezone='UTC';
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'dispatch_disabled'});expect(f.reserveBudget).not.toHaveBeenCalled();
  expect(await f.runner.run({jobId:'',generation:0})).toMatchObject({status:'skipped',reason:'invalid_wakeup'});
  expect(await f.runner.run({jobId:'missing',generation:1})).toMatchObject({status:'skipped',reason:'unknown_job'});
  expect(await f.runner.run({jobId,generation:2})).toMatchObject({status:'superseded',reason:'stale_generation'});
  expect(await f.runner.retry({jobId,generation:1,approved:false})).toMatchObject({status:'skipped',reason:'trusted_approval_required'});
  await state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET status='queued',pending_reason=NULL WHERE job_id=?").bind(jobId).run();f.config.enabled=true;f.config.pricePolicy.timezone='Asia/Kolkata';
  f.load.mockResolvedValue({request:{...validRequest,item:{...validRequest.item,stem:'x'.repeat(16000),essential_context:'y'.repeat(16000)}},job:{}});
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'input_too_large'});expect(f.reserveBudget).not.toHaveBeenCalled();
 });
 it('holds settlement outages and provider price-policy violations for reconciliation',async()=>{
  const f=fixture();f.invoke.mockResolvedValueOnce({status:'pending',reason:'price_policy_violation',ambiguousCost:true,knownMicroUSD:5000000} as never);
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'price_policy_violation'});
  expect(f.settleBudget).toHaveBeenCalledWith(expect.objectContaining({outcome:'disputed',knownMicroUSD:5000000}));expect(f.complete).not.toHaveBeenCalled();
 });
 it('does not accept an otherwise correct result when cost settlement is unavailable',async()=>{
  const f=fixture();f.settleBudget.mockRejectedValueOnce(new Error('Ledger unavailable'));
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'cost_reconciliation_required'});expect(f.complete).not.toHaveBeenCalled();
 });
 it('keeps ungradable answers pending and discards results whose sources changed while running',async()=>{
  const f=fixture();f.invoke.mockResolvedValueOnce({...completeResult,result:{status:'ungradable',grade:null,points:[],feedback:'Cannot assess',misconception_hypothesis:null,probe_warranted:false}} as never);
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'ungradable'});expect(f.complete).not.toHaveBeenCalled();
  await state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET status='queued',pending_reason=NULL WHERE job_id=?").bind(jobId).run();
  f.invoke.mockImplementationOnce(async()=>{f.load.mockRejectedValue(new Error('Source changed'));return completeResult;});
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'superseded',reason:'source_or_item_changed'});expect(f.complete).not.toHaveBeenCalled();
 });
 it('expires an abandoned physical dispatch without silently repeating inference',async()=>{
  const f=fixture();await state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET status='running',dispatch_id=?,physical_call_count=1,lease_until=? WHERE job_id=?").bind(crypto.randomUUID(),new Date(at.getTime()-1000).toISOString(),jobId).run();
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'dispatch_outcome_unknown'});expect(f.invoke).not.toHaveBeenCalled();expect(f.reserveBudget).not.toHaveBeenCalled();
 });
 it('binds cancellation and paid retry to the exact job revision the learner reviewed',async()=>{
  const f=fixture();await state.env.LEARNING_DB.prepare('UPDATE grade_jobs SET job_revision=job_revision+1 WHERE job_id=?').bind(jobId).run();
  expect(await f.runner.cancel({jobId,generation:1,expectedJobRevision:1})).toMatchObject({status:'skipped',reason:'job_revision_changed'});
  expect(await state.env.LEARNING_DB.prepare('SELECT status FROM grade_jobs WHERE job_id=?').bind(jobId).first('status')).toBe('queued');
  await state.env.LEARNING_DB.prepare("UPDATE grade_jobs SET status='pending',pending_reason='provider_unavailable' WHERE job_id=?").bind(jobId).run();
  expect(await f.runner.retry({jobId,generation:1,approved:true,expectedJobRevision:1})).toMatchObject({status:'skipped',reason:'job_revision_changed'});expect(f.invoke).not.toHaveBeenCalled();expect(f.reserveBudget).not.toHaveBeenCalled();
 });
 it('refuses a model timezone that would admit against a different learner calendar month',async()=>{
  const f=fixture();f.advance(Date.parse('2026-10-31T23:30:00Z')-at.getTime());f.config.pricePolicy.timezone='UTC';
  // UTC remains October while the persisted Asia/Kolkata learner is already in November.
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'price_policy_unverified'});expect(f.reserveBudget).not.toHaveBeenCalled();expect(f.invoke).not.toHaveBeenCalled();
  f.config.pricePolicy.timezone='Asia/Kolkata';f.config.pricePolicy.verifiedMonth='2026-11';
  expect(await f.runner.retry({jobId,generation:1,approved:true})).toMatchObject({status:'succeeded'});expect(f.invoke).toHaveBeenCalledOnce();
 });
 it('discards stale generation completion but still reconciles known provider usage',async()=>{
  const f=fixture();f.invoke.mockImplementationOnce(async()=>{await state.ledger.beginMaintenance(1,'restore');return completeResult;});
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'superseded'});expect(f.complete).not.toHaveBeenCalled();expect(f.settleBudget).toHaveBeenCalledWith(expect.objectContaining({outcome:'confirmed'}));
 });
 it('rejects revoked grant admission before reserving cost',async()=>{
  const f=fixture();await state.ledger.revoke(grantId);
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'UNAUTHORISED'});expect(f.reserveBudget).not.toHaveBeenCalled();expect(f.invoke).not.toHaveBeenCalled();
 });
 it('holds invalid source inputs before dispatch and never turns uncertainty into wrong',async()=>{
  const f=fixture();f.load.mockRejectedValueOnce(new Error('Capture changed'));
  expect(await f.runner.run({jobId,generation:1})).toMatchObject({status:'pending',reason:'source_or_item_unavailable'});expect(f.invoke).not.toHaveBeenCalled();expect(f.complete).not.toHaveBeenCalled();
 });
});

it('runs trusted verification and grading end to end through real D1 and the authoritative budget ledger',async()=>{
 const {createRepository}=await import('../src/data/index.ts');
 const {BUDGET_PRICE_POLICY}=await import('../src/security/budget.ts');
 const now=new Date();const period=now.toISOString().slice(0,7);
 await state.env.LEARNING_DB.prepare("UPDATE learners SET timezone='UTC' WHERE id=?").bind(learnerId).run();
 expect(await state.ledger.configureBudgetPolicy({period,timezone:'UTC',modelSnapshot:'gpt-5.4-mini-2026-03-17',pricePolicy:BUDGET_PRICE_POLICY,authorized:true,verified:true})).toMatchObject({ok:true});
 const actor={learner_id:learnerId,connection_id:grantId,generation:1,scopes:['teach:read','teach:learn','teach:organize']};
 const envelope=(operation:string,data:Record<string,unknown>)=>({protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation,reason:'Synthetic runner acceptance',expected:{},data});
 const passage='A retry is safe when it uses the same identity.';const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(passage)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const repo=createRepository(state.env.LEARNING_DB,{captureSource:async input=>({canonicalUrl:input.url,sourceVersion:'v1',locator:input.locator,passage,sourceHash:hash,passageHash:hash,capturedAt:now.toISOString(),provenance:{authority:'public-source-capture',transport:'public-only',etag:null,requestedVersion:input.sourceVersion,mime:'text/plain',redirects:0}})});
 const success=(value:Awaited<ReturnType<typeof repo.execute>>)=>{if(!value.ok)throw new Error(JSON.stringify(value));return value;};
 const anchor=success(await repo.execute(envelope('anchor_capture',{url:'https://docs.example.com/retries',locator:{kind:'lines',start:1,end:1},sourceVersion:'current'}),actor)).data.ids![0]!;
 const item=success(await repo.execute(envelope('item_add',{concept_id:conceptId,level:1,type:'free_text',stem:'How does identity make a retry safe?',essential_context:'',assessment_form:'production',key_points:[{point_id:'p',criterion:'Use stable identity',required:true,anchor_ids:[anchor]}],distractors:[],exact_key:null}),actor)).data.ids![0]!;
 const verificationJob=String(success(await repo.execute(envelope('item_verify',{item_id:item,item_version:1}),actor)).data.job_id);
 const {modelPromptManifest}=await import('../src/grading/model.ts');
 const invoke=vi.fn(async(request:{purpose:'key_verify'|'grade'|'regrade'})=>({...completeResult,...await modelPromptManifest(request.purpose),result:request.purpose==='key_verify'?{...completeResult.result,points:[{point_id:'p',verdict:'supported',anchor_ids:[anchor],reason:'Explicit in the capture.'}]}:{status:'graded',grade:'correct',points:[{point_id:'p',result:'met',reason:'Stable identity was stated.'}],feedback:'Correct.',misconception_hypothesis:null,probe_warranted:false}}));
 const modelConfig={enabled:true,apiKey:'test-only',pricePolicy:{verified:true,modelSnapshot:'gpt-5.4-mini-2026-03-17',region:'global',priceVersion:'openai-global-2026-10-26',verifiedMonth:period,timezone:'UTC'}};
 const runner=createAssessmentRunner({db:state.env.LEARNING_DB,ledger:state.ledger,learnerId,modelConfig,pricePolicy:BUDGET_PRICE_POLICY},{invoke:invoke as never});
 expect(await runner.run({jobId:verificationJob,generation:1})).toMatchObject({status:'succeeded'});
 expect(await state.env.LEARNING_DB.prepare('SELECT COUNT(*) AS n FROM item_verifications WHERE item_id=?').bind(item).first('n')).toBe(1);
 const session=success(await repo.execute(envelope('session_start',{}),actor)).data.ids![0]!;
 const offer=success(await repo.execute(envelope('item_next',{concept_id:conceptId,level:1,purpose:'lesson',session_id:session}),actor));
 const attempt=String(offer.data.attempt_id);const accepted=success(await repo.execute(envelope('answer',{attempt_id:attempt,item_id:item,item_version:1,answer:{kind:'free_text',text:'Use the same identity.'},confidence:'sure',help:{}}),actor));
 const gradingJob=String(accepted.data.job_id);
 expect(await runner.run({jobId:gradingJob,generation:1})).toMatchObject({status:'succeeded'});
 expect(await runner.run({jobId:gradingJob,generation:1})).toMatchObject({status:'skipped'});
 expect(await state.env.LEARNING_DB.prepare('SELECT COUNT(*) AS n FROM evidence WHERE attempt_id=?').bind(attempt).first('n')).toBe(1);
 expect(await state.env.LEARNING_DB.prepare('SELECT state FROM attempts WHERE id=?').bind(attempt).first('state')).toBe('graded');
 expect(invoke).toHaveBeenCalledTimes(2);
});
