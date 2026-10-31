import { createRepository, type Admission, type Envelope, type Result, type Row } from '../data/index.ts';
import { loadAssessmentJob } from '../data/assessment.ts';
import { buildModelRequest, canDispatchModel, invokeModelJob, type ModelDispatchConfig, type ModelInvocationResult, type ModelJobRequestV1 } from './model.ts';
interface Failure {readonly ok:false;readonly error:{readonly code:string;readonly message?:string};}
type MaybePromise<T>=T|Promise<T>;
export interface RunnerLedger {
 admit(grantId:string,scopes:readonly string[],generation?:number):MaybePromise<{readonly ok:true;readonly admission:Admission}|Failure>;
 reserveBudget(input:{dispatchId:string;jobId:string;grantId:string;generation:number;pricePolicy:string;expectedTimezone:string;purpose?:'key_verify'|'grade'|'regrade'}):MaybePromise<{readonly ok:true}|Failure>;
 settleBudget(input:{dispatchId:string;outcome:'confirmed';inputTokens:number;outputTokens:number}|{dispatchId:string;outcome:'unknown'}|{dispatchId:string;outcome:'disputed';knownMicroUSD?:number}):MaybePromise<{readonly ok:true}|Failure>;
}
export interface RunnerOptions {readonly db:D1Database;readonly ledger:RunnerLedger;readonly learnerId:string;readonly modelConfig:ModelDispatchConfig;readonly pricePolicy:string;}
export interface JobWakeup {readonly jobId:string;readonly generation:number;readonly expectedJobRevision?:number;}
export interface RunnerResult {readonly status:'succeeded'|'pending'|'superseded'|'cancelled'|'skipped';readonly reason?:string;readonly jobId:string;readonly dispatchId?:string;}
interface Loaded {readonly request:ModelJobRequestV1;readonly job:Row;}
interface RunnerDependencies {
 readonly now?:()=>Date;readonly dispatchId?:()=>string;
 readonly invoke?:(request:ModelJobRequestV1,config:ModelDispatchConfig)=>Promise<ModelInvocationResult>;
 readonly load?:(db:D1Database,jobId:string,actor:Admission)=>Promise<Loaded>;
 readonly complete?:(envelope:Envelope,actor:Admission)=>Promise<Result>;
}
const validWakeup=(value:JobWakeup)=>value&&typeof value.jobId==='string'&&value.jobId.length>0&&value.jobId.length<=128&&Number.isSafeInteger(value.generation)&&value.generation>0&&(value.expectedJobRevision===undefined||(Number.isSafeInteger(value.expectedJobRevision)&&value.expectedJobRevision>0));
const fence='EXISTS(SELECT 1 FROM meta WHERE singleton=1 AND generation=? AND write_enabled=1 AND schema_version=1 AND rules_version=1 AND protocol_version=1)';
export function createAssessmentRunner(options:RunnerOptions,deps:RunnerDependencies={}) {
 const {db,ledger,learnerId}=options;const now=deps.now??(()=>new Date());const nextDispatch=deps.dispatchId??(()=>crypto.randomUUID());
 const load=deps.load??loadAssessmentJob;const complete=deps.complete??((envelope,actor)=>createRepository(db).executeInternal(envelope,actor));
 const invoke=deps.invoke??((request,config)=>invokeModelJob(request,config,{now:()=>now().getTime()}));
 const result=(jobId:string,status:RunnerResult['status'],reason?:string,dispatchId?:string):RunnerResult=>({jobId,status,...(reason?{reason}:{}),...(dispatchId?{dispatchId}:{})});
 async function row(wakeup:JobWakeup):Promise<Row|null>{return db.prepare('SELECT j.* FROM grade_jobs j JOIN items i ON i.id=j.item_id WHERE j.job_id=? AND i.learner_id=?').bind(wakeup.jobId,learnerId).first<Row>();}
 async function update(job:Row,status:string,reason:string|null,dispatchId?:string):Promise<boolean>{
  const id=String(job.job_id);const revision=Number(job.job_revision);const generation=Number(job.recovery_generation);
  const nonce=dispatchId??(typeof job.dispatch_id==='string'?job.dispatch_id:null);
  const updated=await db.batch([
   db.prepare(`UPDATE grade_jobs SET status=?,pending_reason=?,job_revision=job_revision+1,updated_at=?,lease_until=NULL WHERE job_id=? AND job_revision=? AND dispatch_id IS ? AND ${fence}`).bind(status,reason,now().toISOString(),id,revision,nonce,generation),
   ...(status==='cancelled'||status==='superseded'?[db.prepare(`UPDATE attempts SET state='ungraded',version=version+1 WHERE learner_id=? AND state='pending' AND id=(SELECT attempt_id FROM grade_jobs WHERE job_id=? AND job_revision=? AND status=? AND dispatch_id IS ?) AND NOT EXISTS(SELECT 1 FROM evidence WHERE attempt_id=attempts.id) AND ${fence}`).bind(learnerId,id,revision+1,status,nonce,generation)]:[]),
   db.prepare('UPDATE meta SET meta_revision=meta_revision+1 WHERE singleton=1 AND generation=? AND EXISTS(SELECT 1 FROM grade_jobs WHERE job_id=? AND job_revision=? AND status=? AND dispatch_id IS ?)').bind(generation,id,revision+1,status,nonce),
  ]);return updated[0]!.meta.changes===1;
 }
 async function pending(job:Row,reason:string){await update(job,'pending',reason);return result(String(job.job_id),'pending',reason,typeof job.dispatch_id==='string'?job.dispatch_id:undefined);}
 async function learnerTimezone():Promise<string|null>{const learner=await db.prepare('SELECT timezone FROM learners WHERE id=?').bind(learnerId).first<{timezone:string}>();return learner?.timezone??null;}
 async function authorise(job:Row){return ledger.admit(String(job.actor_connection_id),['teach:read',job.purpose==='key_verify'?'teach:organize':'teach:learn'],Number(job.recovery_generation));}
 async function claim(job:Row,dispatchId:string):Promise<Row|null>{
  const revision=Number(job.job_revision);const generation=Number(job.recovery_generation);const timestamp=now();
  const changed=await db.batch([
   db.prepare(`UPDATE grade_jobs SET status='running',pending_reason=NULL,dispatch_id=?,lease_until=?,job_revision=job_revision+1,updated_at=? WHERE job_id=? AND status='queued' AND job_revision=? AND recovery_generation=? AND physical_call_count<2 AND ${fence} AND NOT EXISTS(SELECT 1 FROM grade_jobs active JOIN items item ON item.id=active.item_id WHERE item.learner_id=? AND active.status='running' AND active.recovery_generation=?)`).bind(dispatchId,new Date(timestamp.getTime()+60000).toISOString(),timestamp.toISOString(),String(job.job_id),revision,generation,generation,learnerId,generation),
   db.prepare('UPDATE meta SET meta_revision=meta_revision+1 WHERE singleton=1 AND generation=? AND EXISTS(SELECT 1 FROM grade_jobs WHERE job_id=? AND status=\'running\' AND job_revision=? AND dispatch_id=?)').bind(generation,String(job.job_id),revision+1,dispatchId),
  ]);
  return changed[0]!.meta.changes===1?row({jobId:String(job.job_id),generation}):null;
 }
 async function admittedCall(job:Row):Promise<Row|null>{
  const generation=Number(job.recovery_generation);const revision=Number(job.job_revision);
  const changed=await db.batch([
   db.prepare(`UPDATE grade_jobs SET physical_call_count=physical_call_count+1,job_revision=job_revision+1,updated_at=? WHERE job_id=? AND status='running' AND job_revision=? AND dispatch_id=? AND physical_call_count<2 AND ${fence}`).bind(now().toISOString(),String(job.job_id),revision,String(job.dispatch_id),generation),
   db.prepare('UPDATE meta SET meta_revision=meta_revision+1 WHERE singleton=1 AND generation=? AND EXISTS(SELECT 1 FROM grade_jobs WHERE job_id=? AND job_revision=? AND dispatch_id=?)').bind(generation,String(job.job_id),revision+1,String(job.dispatch_id)),
  ]);
  return changed[0]!.meta.changes===1?row({jobId:String(job.job_id),generation}):null;
 }
 async function settle(dispatchId:string,outcome:ModelInvocationResult):Promise<boolean>{
  const usage=outcome.usage;const settlement=outcome.status==='pending'&&outcome.reason==='price_policy_violation'
   ?{dispatchId,outcome:'disputed' as const,...('knownMicroUSD'in outcome&&typeof outcome.knownMicroUSD==='number'?{knownMicroUSD:outcome.knownMicroUSD}:{})}
   :usage?{dispatchId,outcome:'confirmed' as const,...usage}:{dispatchId,outcome:'unknown' as const};
  return (await ledger.settleBudget(settlement)).ok;
 }
 async function dispatch(claimed:Row,actor:Admission):Promise<RunnerResult>{
  let loaded:Loaded;
  try{loaded=await load(db,String(claimed.job_id),actor);await buildModelRequest(loaded.request);}catch(error){return pending(claimed,error instanceof RangeError?'input_too_large':'source_or_item_unavailable');}
  const timezone=await learnerTimezone();if(!timezone||timezone!==options.modelConfig.pricePolicy.timezone)return pending(claimed,'price_policy_unverified');
  const dispatchId=String(claimed.dispatch_id);const reserved=await ledger.reserveBudget({dispatchId,jobId:String(claimed.job_id),grantId:actor.connection_id,generation:actor.generation,pricePolicy:options.pricePolicy,expectedTimezone:timezone,purpose:loaded.request.purpose});
  if(!reserved.ok)return pending(claimed,reserved.error.code);
  const admitted=await admittedCall(claimed);if(!admitted)return result(String(claimed.job_id),'superseded','dispatch_fence_changed',dispatchId);
  // The reservation remains outstanding if anything becomes uncertain after admission.
  let outcome:ModelInvocationResult;
  try{loaded=await load(db,String(admitted.job_id),actor);outcome=await invoke({...loaded.request,dispatch_id:dispatchId,job_revision:Number(admitted.job_revision)},options.modelConfig);}
  catch{outcome={status:'pending',reason:'provider_unavailable',ambiguousCost:true};}
  let settlementConfirmed=false;try{settlementConfirmed=await settle(dispatchId,outcome);}catch{settlementConfirmed=false;}
  const current=await row({jobId:String(admitted.job_id),generation:actor.generation});
  if(!current||current.status!=='running'||current.dispatch_id!==dispatchId||current.job_revision!==admitted.job_revision)return result(String(admitted.job_id),current?.status==='cancelled'?'cancelled':'superseded','dispatch_fence_changed',dispatchId);
  const authority=await authorise(current);if(!authority.ok){await update(current,'superseded',authority.error.code);return result(String(current.job_id),'superseded',authority.error.code,dispatchId);}
  try{await load(db,String(current.job_id),authority.admission);}catch{await update(current,'superseded','source_or_item_changed');return result(String(current.job_id),'superseded','source_or_item_changed',dispatchId);}
  if(!settlementConfirmed)return pending(current,'cost_reconciliation_required');
  if(outcome.status==='pending')return pending(current,outcome.reason);
  if('status'in outcome.result&&outcome.result.status==='ungradable')return pending(current,'ungradable');
  const provenance={provider_request_id:outcome.providerRequestId,prompt_hash:outcome.promptHash,schema_hash:outcome.schemaHash,model_snapshot:options.modelConfig.pricePolicy.modelSnapshot,usage:outcome.usage};
  const revision=Number(current.job_revision)+1;
  const cache=JSON.stringify({result:outcome.result,provenance,completion_revision:revision});
  try{
   await db.batch([
    db.prepare(`UPDATE grade_jobs SET result_json=?,job_revision=job_revision+1,updated_at=? WHERE job_id=? AND status='running' AND dispatch_id=? AND job_revision=? AND ${fence}`).bind(cache,now().toISOString(),String(current.job_id),dispatchId,Number(current.job_revision),actor.generation),
    db.prepare('UPDATE meta SET meta_revision=meta_revision+1 WHERE singleton=1 AND generation=? AND EXISTS(SELECT 1 FROM grade_jobs WHERE job_id=? AND job_revision=? AND dispatch_id=? AND result_json=?)').bind(actor.generation,String(current.job_id),revision,dispatchId,cache),
   ]);
  }catch{/* Re-read below reconciles a lost cache acknowledgement before any finalization. */}
  const cached=await row({jobId:String(current.job_id),generation:actor.generation});
  if(!cached||cached.dispatch_id!==dispatchId||cached.result_json!==cache)return result(String(current.job_id),'pending','result_persistence_uncertain',dispatchId);
  return finishCached(cached,authority.admission);
 }
 async function completionUncertain(job:Row):Promise<RunnerResult>{
  const dispatchId=String(job.dispatch_id);const jobId=String(job.job_id);const generation=Number(job.recovery_generation);const revision=Number(job.job_revision);
  try{
   const latest=await row({jobId,generation});if(latest?.status==='succeeded')return result(jobId,'succeeded',undefined,dispatchId);
   await db.batch([
    db.prepare(`UPDATE grade_jobs SET pending_reason='completion_uncertain',lease_until=NULL WHERE job_id=? AND status='running' AND dispatch_id=? AND job_revision=? AND ${fence}`).bind(jobId,dispatchId,revision,generation),
    db.prepare("UPDATE meta SET meta_revision=meta_revision+1 WHERE singleton=1 AND generation=? AND EXISTS(SELECT 1 FROM grade_jobs WHERE job_id=? AND dispatch_id=? AND job_revision=? AND status='running' AND pending_reason='completion_uncertain')").bind(generation,jobId,dispatchId,revision),
   ]);
  }catch{/* The durable result remains available for a same-dispatch retry after storage recovery. */}
  return result(jobId,'pending','completion_uncertain',dispatchId);
 }
 async function finishCached(job:Row,actor:Admission):Promise<RunnerResult>{
  let cached:{result:unknown;provenance:unknown;completion_revision:number};
  try{cached=JSON.parse(String(job.result_json));if(!cached||cached.completion_revision!==job.job_revision||!cached.result||!cached.provenance)throw new Error('Invalid result cache');}
  catch{return pending(job,'result_review_required');}
  const dispatchId=String(job.dispatch_id);const jobId=String(job.job_id);
  const envelope:Envelope={protocol_version:1,rules_version:1,recovery_generation:actor.generation,request_id:dispatchId,operation:'_complete_assessment',reason:'Trusted independent assessment result',expected:{},data:{job_id:jobId,dispatch_id:dispatchId,job_revision:cached.completion_revision,result:cached.result,provenance:cached.provenance}};
  let completed:Result;try{completed=await complete(envelope,actor);}catch{return completionUncertain(job);}
  if(!completed.ok)return completed.error.retryable?completionUncertain(job):pending(job,completed.error.code);
  return result(jobId,'succeeded',undefined,dispatchId);
 }

 async function run(wakeup:JobWakeup):Promise<RunnerResult>{
  if(!validWakeup(wakeup))return result(wakeup?.jobId??'','skipped','invalid_wakeup');
  const job=await row(wakeup);if(!job)return result(wakeup.jobId,'skipped','unknown_job');
  if(Number(job.recovery_generation)!==wakeup.generation)return result(wakeup.jobId,'superseded','stale_generation');
  if(job.status==='running'&&job.result_json){
   const authority=await authorise(job);if(!authority.ok){await update(job,'superseded',authority.error.code);return result(wakeup.jobId,'superseded',authority.error.code);}
   try{await load(db,wakeup.jobId,authority.admission);}catch{await update(job,'superseded','source_or_item_changed');return result(wakeup.jobId,'superseded','source_or_item_changed');}
   return finishCached(job,authority.admission);
  }
  if(job.status==='running'&&typeof job.lease_until==='string'&&new Date(job.lease_until).getTime()<=now().getTime())return pending(job,'dispatch_outcome_unknown');
  if(job.status!=='queued')return result(wakeup.jobId,'skipped','job_not_queued');
  const authority=await authorise(job);if(!authority.ok)return pending(job,authority.error.code);
  if(!canDispatchModel(options.modelConfig,now().getTime()))return pending(job,'dispatch_disabled');
  const timezone=await learnerTimezone();if(!timezone||timezone!==options.modelConfig.pricePolicy.timezone)return pending(job,'price_policy_unverified');
  try{await load(db,wakeup.jobId,authority.admission);}catch{return pending(job,'source_or_item_unavailable');}
  const claimed=await claim(job,nextDispatch());if(!claimed)return result(wakeup.jobId,'skipped','claim_conflict');
  return dispatch(claimed,authority.admission);
 }
 async function retry(input:JobWakeup&{readonly approved:boolean}):Promise<RunnerResult>{
  if(!validWakeup(input)||input.approved!==true)return result(input?.jobId??'','skipped','trusted_approval_required');
  const job=await row(input);if(!job||job.status!=='pending'||Number(job.recovery_generation)!==input.generation)return result(input.jobId,'skipped','job_not_pending');
  if(input.expectedJobRevision!==undefined&&input.expectedJobRevision!==job.job_revision)return result(input.jobId,'skipped','job_revision_changed');
  if(Number(job.physical_call_count)>=2)return result(input.jobId,'pending','physical_call_limit');
  if(!['provider_unavailable','dispatch_outcome_unknown','dispatch_disabled','BUDGET_EXHAUSTED','BUDGET_DISABLED','PRICE_POLICY_UNVERIFIED','price_policy_unverified','source_or_item_unavailable'].includes(String(job.pending_reason)))return result(input.jobId,'pending','review_required');
  if(Number(job.physical_call_count)>0&&now().getTime()-new Date(String(job.updated_at)).getTime()<30000)return result(input.jobId,'pending','retry_backoff');
  const authority=await authorise(job);if(!authority.ok)return result(input.jobId,'pending',authority.error.code);
  if(!await update(job,'queued',null))return result(input.jobId,'skipped','retry_conflict');
  return run(input);
 }
 async function cancel(wakeup:JobWakeup):Promise<RunnerResult>{
  if(!validWakeup(wakeup))return result(wakeup?.jobId??'','skipped','invalid_wakeup');
  const job=await row(wakeup);if(!job||Number(job.recovery_generation)!==wakeup.generation)return result(wakeup.jobId,'skipped','unknown_job');
  if(wakeup.expectedJobRevision!==undefined&&wakeup.expectedJobRevision!==job.job_revision)return result(wakeup.jobId,'skipped','job_revision_changed');
  if(['succeeded','cancelled','superseded'].includes(String(job.status)))return result(wakeup.jobId,'skipped','terminal_job');
  const authority=await authorise(job);if(!authority.ok)return result(wakeup.jobId,'pending',authority.error.code);
  return await update(job,'cancelled','learner_cancelled')?result(wakeup.jobId,'cancelled'):result(wakeup.jobId,'skipped','cancel_conflict');
 }
 return {run,retry,cancel};
}
