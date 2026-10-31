import {effectiveEvidence,evidenceStrength} from '@teach/domain';
import {evidenceFromRow,correctionFromRow} from './projections.ts';
import type {Context,Plan,Row,SqlEffect,Admission} from './types.ts';
import {insert,update,common,entity,SEQ} from './sql.ts';
import {DataError,invalid} from './errors.ts';
import {loadAssessmentJob,held} from './assessment-shared.ts';
import {validateKeyVerification,verificationAccepted,validateContentGrade} from '../grading/model.ts';
import {assessmentEvidence,evidenceInsert} from './assessment-answers.ts';
import {projectionEffects} from './projections.ts';
import {planReviewConsume,type ReviewLease} from './reviews.ts';
export {loadAssessmentJob} from './assessment-shared.ts';
export {planItem,planItemNext} from './assessment-items.ts';
export {planAnswer,planDispute} from './assessment-answers.ts';
export async function planAssessmentCompletion(ctx:Context):Promise<Plan>{
 const data=ctx.envelope.data;const {request,job}=await loadAssessmentJob(ctx.db,String(data.job_id),ctx.actor);
 if(job.status!=='running'||job.dispatch_id!==data.dispatch_id||job.job_revision!==data.job_revision)throw new DataError('VERSION_CONFLICT','Assessment dispatch was superseded');
 const provenance=data.provenance as Row;if(provenance.prompt_hash!==job.prompt_hash||provenance.schema_hash!==job.schema_hash||provenance.model_snapshot!==job.model_snapshot)held('Result provenance does not match the pinned model contract');
 const result=request.purpose==='key_verify'?validateKeyVerification(request,data.result):validateContentGrade(request,data.result);
 const effects:SqlEffect[]=[];let evidenceId:string|null=null;
 if(request.purpose==='key_verify'){
  const accepted=verificationAccepted(request,result as ReturnType<typeof validateKeyVerification>);const verificationId=ctx.newId('iv');
  effects.push(insert('item_verifications',{...common(ctx,verificationId),item_id:request.item_id,item_version:request.item_version,capture_set_hash:String(job.capture_set_hash),prompt_version:1,state:accepted?'supported':'unsupported',result_json:JSON.stringify(result),verifier_provenance_json:JSON.stringify(data.provenance),seq:SEQ,result_job_id:String(job.job_id),supersedes_verification_id:null}),update('items',request.item_id,{state:accepted?'verified':'held',current_verification_id:accepted?verificationId:null}));
 }else{
  const grade=validateContentGrade(request,result);if(grade.status!=='graded'||grade.grade===null)held('Ungradable output must remain pending');
  const attempt=await entity(ctx,'attempts',request.attempt_id!);const item=await ctx.db.prepare('SELECT i.*,iv.assessment_form FROM items i JOIN item_versions iv ON iv.item_id=i.id AND iv.item_version=? WHERE i.id=? AND i.learner_id=?').bind(request.item_version,request.item_id,ctx.actor.learner_id).first<Row>();if(!item)held('The immutable item is unavailable');
  const lease=attempt.review_lease_json?JSON.parse(String(attempt.review_lease_json)) as ReviewLease:null;
  const consumed=lease?await planReviewConsume(ctx,lease,String(attempt.id),{unknownConfidence:attempt.confidence==='unknown',session_id:String(attempt.session_id)}):{schedulingEligible:true,effects:[]};
  if(request.purpose==='regrade'){
   const root=await ctx.db.prepare('SELECT * FROM evidence WHERE learner_id=? AND attempt_id=?').bind(ctx.actor.learner_id,String(attempt.id)).first<Row>();if(!root)invalid('Disputed evidence is missing');evidenceId=String(root.id);
   const revision=Number(await ctx.db.prepare('SELECT COALESCE(MAX(effective_revision),0) AS n FROM record_corrections WHERE root_record_id=?').bind(String(root.id)).first('n'));
   if(revision!==job.dispute_revision)throw new DataError('VERSION_CONFLICT','The dispute changed during regrading');
   const correction={...common(ctx,ctx.newId('rc')),root_record_id:String(root.id),expected_effective_revision:revision,effective_revision:revision+1,action:'resolve',replacement_json:JSON.stringify({content_grade:grade.grade}),reason:'Independent regrade resolved the disputed content grade',seq:ctx.nextSeq};
   effects.push(insert('record_corrections',{...correction,seq:SEQ}),...await projectionEffects(ctx,[],[correction]));
  }else{const evidence=assessmentEvidence(ctx,item,attempt,grade.grade,consumed.schedulingEligible);evidenceId=String(evidence.id);effects.push(evidenceInsert(evidence),...await projectionEffects(ctx,[evidence]),...consumed.effects);}
  effects.push(update('attempts',String(attempt.id),{state:'graded'}));
  if(grade.misconception_hypothesis)effects.push(insert('misconceptions',{...common(ctx,ctx.newId('mc')),concept_id:String(item.concept_id),wording:grade.misconception_hypothesis,state:'open',created_from_record_id:evidenceId!,closing_attempts_json:'[]'}));
 }
 effects.push({sql:"UPDATE grade_jobs SET status='succeeded',pending_reason=NULL,result_json=?,updated_at=?,lease_until=NULL WHERE job_id=? AND job_revision=? AND dispatch_id=? AND status='running' AND __GUARD__",args:[JSON.stringify({result,provenance:data.provenance}),ctx.now,String(job.job_id),Number(job.job_revision),String(job.dispatch_id)]});
 return {effects,precondition:{sql:"EXISTS(SELECT 1 FROM grade_jobs WHERE job_id=? AND status='running' AND dispatch_id=? AND job_revision=? AND recovery_generation=?)",args:[String(job.job_id),String(job.dispatch_id),Number(job.job_revision),ctx.actor.generation]},data:{ids:[String(job.job_id)],job_id:job.job_id,status:'succeeded',...(request.attempt_id?{attempt_id:request.attempt_id,state:'graded'}:{item_id:request.item_id})},projectionChanged:request.purpose!=='key_verify'};
}
export async function assessmentRead(db:D1Database,operation:string,data:Row,actor:Admission):Promise<Row>{
 if(operation==='item_status'){
  const item=await entity({db,actor},'items',String(data.item_id));
  const job=await db.prepare("SELECT job_id,status,pending_reason FROM grade_jobs WHERE item_id=? AND item_version=? AND purpose='key_verify' ORDER BY created_at DESC,job_id DESC LIMIT 1").bind(String(item.id),Number(item.current_item_version)).first<Row>();
  return {item_id:item.id,item_version:item.current_item_version,state:item.state,verification_id:item.current_verification_id,verification_job:job};
 }
 const attempt=await entity({db,actor},'attempts',String(data.attempt_id));
 const jobs=await db.prepare('SELECT job_id,purpose,status,pending_reason,result_json FROM grade_jobs WHERE attempt_id=? ORDER BY created_at,job_id').bind(String(attempt.id)).all<Row>();
 const records=await db.prepare('SELECT e.*,iv.assessment_form FROM evidence e JOIN item_versions iv ON iv.item_id=? AND iv.item_version=? WHERE e.learner_id=? AND e.attempt_id=? ORDER BY e.seq,e.id').bind(String(attempt.item_id),Number(attempt.item_version),actor.learner_id,String(attempt.id)).all<Row>();
 const corrections=await db.prepare('SELECT c.* FROM record_corrections c JOIN evidence e ON e.id=c.root_record_id WHERE c.learner_id=? AND e.attempt_id=? ORDER BY c.seq,c.effective_revision').bind(actor.learner_id,String(attempt.id)).all<Row>();
 const effective=effectiveEvidence(records.results.map(evidenceFromRow),corrections.results.map(correctionFromRow));
 const active=effective.records[0];const root=records.results[0];const provisional=effective.disputed.length>0;
 const assessment=root?{evidence_id:root.id,grade:active?.contentGrade??null,confidence:active?.confidence??null,strength:active?evidenceStrength(active):null,effective_revision:Math.max(0,...corrections.results.map(c=>Number(c.effective_revision))),provisional,feedback:active?(active.contentGrade==='correct'?'Correct.':active.contentGrade==='partial'?'Partly correct.':'Incorrect.'):null}:null;
 return {attempt_id:attempt.id,state:attempt.state,item_id:attempt.item_id,item_version:attempt.item_version,assessment,jobs:jobs.results.map(job=>({job_id:job.job_id,purpose:job.purpose,status:job.status,pending_reason:job.pending_reason,...(job.status==='succeeded'&&job.result_json?{result:JSON.parse(String(job.result_json))}: {})}))};
}
