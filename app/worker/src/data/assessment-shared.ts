import { MODEL_SNAPSHOT, parseModelJobRequest,modelPromptManifest,buildModelRequest, type ModelJobRequestV1 } from '../grading/model.ts';
import { canonical } from './validation.ts';
import { rows, entity } from './sql.ts';
import { DataError, invalid } from './errors.ts';
import type { Admission, Context, Row } from './types.ts';
export async function hashValue(value:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
export function held(message:string):never{throw new DataError('ITEM_HELD',message);}
export async function itemSnapshot(db:D1Database,learnerId:string,itemId:string,version:number){
 const row=await db.prepare('SELECT i.*,iv.stem,iv.context_json,iv.assessment_form,iv.key_points_json,iv.distractors_json,iv.exact_key_json,iv.content_sha256 FROM items i JOIN item_versions iv ON iv.item_id=i.id AND iv.item_version=? WHERE i.id=? AND i.learner_id=?').bind(version,itemId,learnerId).first<Row>();
 if(!row||row.current_item_version!==version||row.state==='retired')held('Item content is no longer eligible');return row;
}
export async function captureSet(db:D1Database,learnerId:string,keyPoints:readonly {anchor_ids:readonly string[]}[]){
 const ids=[...new Set(keyPoints.flatMap(point=>point.anchor_ids))].sort();if(!ids.length||keyPoints.some(point=>!point.anchor_ids.length))held('Every key point needs a trusted source capture');
 const captures:Row[]=[];
 for(const id of ids){const anchor=await db.prepare('SELECT * FROM anchors WHERE learner_id=? AND id=? AND state=\'verified\'').bind(learnerId,id).first<Row>();if(!anchor)held('A source anchor is unavailable');
  const capture=await db.prepare('SELECT * FROM source_captures WHERE learner_id=? AND anchor_id=? AND anchor_version=? AND sha256=? ORDER BY captured_at DESC,id DESC LIMIT 1').bind(learnerId,id,Number(anchor.version),String(anchor.sha256)).first<Row>();if(!capture||capture.captured_text!==anchor.quoted_text)held('A source capture changed');captures.push(capture);}
 return {captures,hash:await hashValue(captures.map(c=>({id:c.id,anchor_id:c.anchor_id,version:c.anchor_version,sha256:c.sha256})))};
}
export async function loadAssessmentJob(db:D1Database,jobId:string,actor:Admission):Promise<{request:ModelJobRequestV1;job:Row}>{
 const job=await db.prepare('SELECT * FROM grade_jobs WHERE job_id=?').bind(jobId).first<Row>();if(!job)invalid('Assessment job does not exist');
 if(job.actor_connection_id!==actor.connection_id||job.recovery_generation!==actor.generation)throw new DataError('FORBIDDEN','Assessment dispatch authority changed');
 const manifest=await modelPromptManifest(job.purpose as 'key_verify'|'grade'|'regrade');if(job.model_snapshot!==MODEL_SNAPSHOT||job.protocol_version!==1||job.rules_version!==1||job.prompt_version!==1||job.prompt_hash!==manifest.promptHash||job.schema_hash!==manifest.schemaHash)held('The pinned model prompt or policy changed');
 const scope=job.purpose==='key_verify'?'teach:organize':'teach:learn';if(!actor.scopes.includes(scope))throw new DataError('FORBIDDEN','Assessment capability is missing');
 const item=await itemSnapshot(db,actor.learner_id,String(job.item_id),Number(job.item_version));
 const points=JSON.parse(String(item.key_points_json)) as {anchor_ids:string[]}[];const sources=await captureSet(db,actor.learner_id,points);
 if(sources.hash!==job.capture_set_hash)held('Assessment sources changed after queueing');
 let answer:string|null=null;
 if(job.purpose!=='key_verify'){
  const verification=await db.prepare('SELECT * FROM item_verifications WHERE id=? AND learner_id=? AND item_id=? AND item_version=? AND state=\'supported\'').bind(String(job.verification_id),actor.learner_id,String(job.item_id),Number(job.item_version)).first<Row>();
  if(!verification||verification.capture_set_hash!==sources.hash||item.state!=='verified')held('The accepted verification is unavailable');
  const attempt=await entity({db,actor},'attempts',String(job.attempt_id));if(attempt.item_id!==job.item_id||attempt.item_version!==job.item_version||attempt.verification_id!==job.verification_id)held('Attempt snapshot changed');
  if(job.purpose==='regrade'&&attempt.state!=='disputed')held('Regrade no longer has an active dispute');
  if(job.purpose==='grade'&&attempt.state!=='pending')held('Attempt is no longer pending');
  const submitted=JSON.parse(String(attempt.answer)) as {kind:string;text?:string};if(submitted.kind!=='free_text'||typeof submitted.text!=='string')held('Exact answers do not use model grading');answer=submitted.text;
 }
 const request=parseModelJobRequest({job_id:job.job_id,dispatch_id:job.dispatch_id??'pending-dispatch',purpose:job.purpose,attempt_id:job.attempt_id,item_id:job.item_id,item_version:job.item_version,key_version:job.key_version,verification_id:job.verification_id,protocol_version:1,rules_version:1,prompt_version:1,recovery_generation:job.recovery_generation,job_revision:job.job_revision,item:{stem:item.stem,level:item.level,essential_context:JSON.parse(String(item.context_json)).essential_context??''},key_points:points,captures:sources.captures.map(c=>({anchor_id:c.anchor_id,capture_hash:c.sha256,passage:c.captured_text})),answer,exact_key:job.purpose==='key_verify'&&item.exact_key_json?JSON.parse(String(item.exact_key_json)):null});
 return {request,job};
}
export async function newJob(ctx:Context,item:Row,purpose:'key_verify'|'grade'|'regrade',attemptId:string|null,verificationId:string|null,disputeRevision=0,answer:string|null=null){
 const points=JSON.parse(String(item.key_points_json));const capture=await captureSet(ctx.db,ctx.actor.learner_id,points);
 const manifest=await modelPromptManifest(purpose);
 let pendingReason:string|null=null;
 const queuedRequest=parseModelJobRequest({job_id:'pending-job',dispatch_id:'pending-dispatch',purpose,attempt_id:attemptId,item_id:item.id,item_version:item.current_item_version,key_version:item.current_item_version,verification_id:verificationId,protocol_version:1,rules_version:1,prompt_version:1,recovery_generation:ctx.actor.generation,job_revision:1,item:{stem:item.stem,level:item.level,essential_context:JSON.parse(String(item.context_json)).essential_context??''},key_points:points,captures:capture.captures.map(c=>({anchor_id:c.anchor_id,capture_hash:c.sha256,passage:c.captured_text})),answer,exact_key:purpose==='key_verify'&&item.exact_key_json?JSON.parse(String(item.exact_key_json)):null});
 try{await buildModelRequest(queuedRequest);}catch(error){if(!(error instanceof RangeError))throw error;pendingReason='input_too_large';}
 const identity=await hashValue({purpose,prompt_hash:manifest.promptHash,schema_hash:manifest.schemaHash,item_id:item.id,item_version:item.current_item_version,content_sha256:item.content_sha256,capture_set_hash:capture.hash,prompt_version:1,attempt_id:attemptId,dispute_revision:disputeRevision});
 const existing=await ctx.db.prepare('SELECT job_id FROM grade_jobs WHERE identity_hash=?').bind(identity).first<Row>();if(existing)return {existing:String(existing.job_id),record:null};
 return {existing:null,record:{job_id:ctx.newId('job'),identity_hash:identity,purpose,attempt_id:attemptId,item_id:String(item.id),item_version:Number(item.current_item_version),key_version:Number(item.current_item_version),verification_id:verificationId,capture_set_hash:capture.hash,protocol_version:1,rules_version:1,prompt_version:1,model_snapshot:MODEL_SNAPSHOT,recovery_generation:ctx.actor.generation,job_revision:1,status:pendingReason?'pending':'queued',pending_reason:pendingReason,dispatch_id:null,lease_until:null,physical_call_count:0,result_json:null,created_at:ctx.now,updated_at:ctx.now,actor_connection_id:ctx.actor.connection_id,dispute_revision:disputeRevision,prompt_hash:manifest.promptHash,schema_hash:manifest.schemaHash} as const};
}
