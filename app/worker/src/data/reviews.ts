import type { Admission,Context,Row,SqlEffect } from './types';
import { DataError } from './errors';
import { insert,common,rows,session,update } from './sql';
export interface ReviewLease { readonly occurrence_id:string;readonly lease_generation:number;readonly schedule_revision:number; }
interface ClaimInput { readonly concept_id:string;readonly level:number;readonly session_id:string;readonly takeover?:boolean; }
const conflict=()=>new DataError('REVIEW_LEASE_CONFLICT','This review is not due or another session owns its current lease');
export async function dueReviews(db:D1Database,actor:Admission,now:string,sessionId?:string):Promise<Row[]>{
 return rows(db,'SELECT * FROM review_schedules WHERE learner_id=? AND due_at<=? AND (? IS NULL OR suppressed_session_id IS NULL OR suppressed_session_id<>?) ORDER BY due_at,concept_id,level',[actor.learner_id,now,sessionId??null,sessionId??null]);
}
export async function planReviewClaim(ctx:Context,input:ClaimInput){
 await session(ctx,input.session_id);
 const schedule=await ctx.db.prepare('SELECT * FROM review_schedules WHERE learner_id=? AND concept_id=? AND level=?').bind(ctx.actor.learner_id,input.concept_id,input.level).first<Row>();
 if(!schedule||String(schedule.due_at)>ctx.now||schedule.suppressed_session_id===input.session_id)throw conflict();
 const active=await ctx.db.prepare("SELECT * FROM review_occurrences WHERE learner_id=? AND concept_id=? AND level=? AND state IN ('open','reserved')").bind(ctx.actor.learner_id,input.concept_id,input.level).first<Row>();
 const current=active&&Number(active.schedule_revision)===Number(schedule.schedule_revision)?active:null;
 const effects:SqlEffect[]=active&&!current?[update('review_occurrences',String(active.id),{state:'superseded'})]:[];
 if(current?.state==='reserved'&&String(current.lease_until)>ctx.now&&!input.takeover){
  if(current.lease_session_id!==input.session_id||current.consumed_attempt_id)throw conflict();
  return {effects,occurrence:current,lease:{occurrence_id:String(current.id),lease_generation:Number(current.lease_generation),schedule_revision:Number(schedule.schedule_revision)}};
 }
 const occurrenceId=current?String(current.id):ctx.newId('ro');const generation=current?Number(current.lease_generation)+1:1;
 const values={state:'reserved',lease_generation:generation,lease_session_id:input.session_id,lease_until:new Date(Date.parse(ctx.now)+600_000).toISOString(),consumed_attempt_id:null};
 const occurrence={...values,id:occurrenceId,concept_id:input.concept_id,level:input.level,schedule_revision:Number(schedule.schedule_revision)};
 effects.push(current?update('review_occurrences',occurrenceId,values):insert('review_occurrences',{...common(ctx,occurrenceId),...occurrence}));
 return {effects,occurrence,lease:{occurrence_id:occurrenceId,lease_generation:generation,schedule_revision:Number(schedule.schedule_revision)}};
}
async function matching(ctx:Context,lease:ReviewLease,sessionId:string,attemptId?:string){
 if(!lease||typeof lease.occurrence_id!=='string'||!Number.isSafeInteger(lease.lease_generation)||!Number.isSafeInteger(lease.schedule_revision))return null;
 const occurrence=await ctx.db.prepare("SELECT o.*,s.schedule_revision AS current_revision FROM review_occurrences o JOIN review_schedules s ON s.learner_id=o.learner_id AND s.concept_id=o.concept_id AND s.level=o.level WHERE o.id=? AND o.learner_id=? AND o.state='reserved'").bind(lease.occurrence_id,ctx.actor.learner_id).first<Row>();
 if(!occurrence||occurrence.lease_session_id!==sessionId||Number(occurrence.lease_generation)!==lease.lease_generation||Number(occurrence.schedule_revision)!==lease.schedule_revision||Number(occurrence.current_revision)!==lease.schedule_revision)return null;
 if(occurrence.consumed_attempt_id)return occurrence.consumed_attempt_id===attemptId?occurrence:null;
 return String(occurrence.lease_until)>ctx.now?occurrence:null;
}
export async function validateReviewLease(ctx:Context,lease:ReviewLease,sessionId:string,attemptId?:string){
 return {schedulingEligible:!!await matching(ctx,lease,sessionId,attemptId)};
}
export async function planReviewPending(ctx:Context,lease:ReviewLease,attemptId:string,sessionId=ctx.envelope.session_id){
 if(!sessionId)return {effects:[] as readonly SqlEffect[],schedulingEligible:false};
 const occurrence=await matching(ctx,lease,sessionId,attemptId);
 return {effects:occurrence?[update('review_occurrences',lease.occurrence_id,{consumed_attempt_id:attemptId})]:[],schedulingEligible:!!occurrence};
}
export async function planReviewConsume(ctx:Context,lease:ReviewLease,attemptId:string,options:{readonly unknownConfidence?:boolean;readonly session_id?:string}={}){
 const sessionId=options.session_id??ctx.envelope.session_id;
 const occurrence=sessionId?await matching(ctx,lease,sessionId,attemptId):null;
 if(!occurrence)return {effects:[] as readonly SqlEffect[],schedulingEligible:false};
 const effects:SqlEffect[]=[update('review_occurrences',lease.occurrence_id,{state:'consumed',consumed_attempt_id:attemptId})];
 if(options.unknownConfidence)effects.push({sql:'UPDATE review_schedules SET schedule_revision=schedule_revision+1,suppressed_session_id=?,version=version+1,updated_seq=__SEQ__ WHERE learner_id=? AND concept_id=? AND level=? AND schedule_revision=? AND __GUARD__',args:[sessionId!,ctx.actor.learner_id,String(occurrence.concept_id),Number(occurrence.level),lease.schedule_revision]});
 return {effects,schedulingEligible:true};
}
