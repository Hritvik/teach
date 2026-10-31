import {evidenceStrength,type Evidence} from '@teach/domain';
import type {Context,Plan,Row,SqlEffect} from './types.ts';
import {insert,common,entity,session,update,localDay,SEQ} from './sql.ts';
import {DataError,invalid} from './errors.ts';
import {held,newJob} from './assessment-shared.ts';
import {eligibleItem} from './assessment-items.ts';
import {evaluateExactAnswer} from '../grading/exact.ts';
import {projectionEffects} from './projections.ts';
import {planReviewPending,planReviewConsume,type ReviewLease} from './reviews.ts';
import {canonical} from './validation.ts';
export function assessmentEvidence(ctx:Context,item:Row,attempt:Row,grade:'correct'|'partial'|'wrong',schedulingEligible=true):Row{
 const help=JSON.parse(String(attempt.help_json));const form=item.assessment_form as 'production'|'recognition';
 const domain:Evidence={id:ctx.newId('e'),seq:ctx.nextSeq,conceptId:String(item.concept_id),level:Number(item.level) as Evidence['level'],kind:'answer',contentGrade:grade,confidence:attempt.confidence as Evidence['confidence'],occurredAt:String(attempt.occurred_at),acceptedAt:String(attempt.accepted_at),localDay:String(attempt.local_day),contentHint:help.content_hint===true,answerRevealed:help.answer_revealed===true,assessmentForm:form,schedulingEligible};
 return {...common(ctx,domain.id),seq:ctx.nextSeq,concept_id:domain.conceptId,level:domain.level,session_id:String(attempt.session_id),attempt_id:String(attempt.id),kind:'answer',content_grade:grade,strength:evidenceStrength(domain),confidence:String(attempt.confidence),help_json:String(attempt.help_json),occurred_at:domain.occurredAt,accepted_at:domain.acceptedAt!,timezone:String(attempt.timezone),local_day:domain.localDay,source_json:JSON.stringify({item_id:item.id,item_version:attempt.item_version,verification_id:attempt.verification_id}),content:String(attempt.answer),rules_version:1,assessment_form:form,scheduling_eligible:schedulingEligible?1:0};
}
export function evidenceInsert(record:Row){const {assessment_form,...persisted}=record;return insert('evidence',{...persisted as Record<string,string|number|null>,seq:SEQ,created_seq:SEQ,updated_seq:SEQ});}
export async function planAnswer(ctx:Context):Promise<Plan>{
 const data=ctx.envelope.data;const offer=await entity(ctx,'item_offers',String(data.attempt_id));
 await session(ctx,String(offer.session_id));
 if(offer.recovery_generation!==ctx.actor.generation)throw new DataError('STALE_GENERATION','Request a fresh item after recovery');
 if(offer.connection_id!==ctx.actor.connection_id||offer.item_id!==data.item_id||offer.item_version!==data.item_version)throw new DataError('FORBIDDEN','Answer must match the issued item and connection');
 if(offer.review_lease_json&&canonical(JSON.parse(String(offer.review_lease_json)))!==canonical(data.review_lease))invalid('The original review lease is required');
 const submitted=JSON.stringify(data.answer);const help=JSON.stringify(data.help);
 if(offer.state==='answered'){
  const old=await entity(ctx,'attempts',String(offer.id));if(old.answer!==submitted||old.confidence!==data.confidence||old.help_json!==help)throw new DataError('IDEMPOTENCY_MISMATCH','An accepted answer cannot be rewritten');
  const job=await ctx.db.prepare('SELECT job_id FROM grade_jobs WHERE attempt_id=? AND purpose=\'grade\'').bind(String(offer.id)).first<Row>();return {effects:[],data:{ids:[String(offer.id)],attempt_id:offer.id,state:old.state,...(job?{job_id:job.job_id}:{})}};
 }
 const item=await eligibleItem(ctx,String(offer.item_id),Number(offer.item_version));if(item.current_verification_id!==offer.verification_id)held('The issued verification changed; request a fresh item');
 const exact=item.exact_key_json?JSON.parse(String(item.exact_key_json)):null;
 if(exact===null&&(data.answer as Row).kind!=='free_text')invalid('This item expects a free-text answer');
 const grade=exact===null?null:evaluateExactAnswer(exact,data.answer);
 const learner=await ctx.db.prepare('SELECT timezone FROM learners WHERE id=?').bind(ctx.actor.learner_id).first<Row>();if(!learner)invalid('Learner is not configured');
 const attempt={...common(ctx,String(offer.id)),session_id:String(offer.session_id),item_id:String(offer.item_id),item_version:Number(offer.item_version),answer:submitted,confidence:String(data.confidence),help_json:help,occurred_at:ctx.now,accepted_at:ctx.now,timezone:String(learner.timezone),local_day:localDay(ctx.now,String(learner.timezone)),state:grade?'graded':'pending',review_occurrence_id:offer.review_lease_json?(JSON.parse(String(offer.review_lease_json)) as ReviewLease).occurrence_id:null,verification_id:String(offer.verification_id),review_lease_json:offer.review_lease_json?String(offer.review_lease_json):null};
 const effects:SqlEffect[]=[insert('attempts',attempt),{sql:'UPDATE item_offers SET state=\'answered\' WHERE id=? AND __GUARD__',args:[String(offer.id)]}];
 const lease=offer.review_lease_json?JSON.parse(String(offer.review_lease_json)) as ReviewLease:null;
 if(grade){const consumed=lease?await planReviewConsume(ctx,lease,String(offer.id),{unknownConfidence:data.confidence==='unknown',session_id:String(offer.session_id)}):{schedulingEligible:true,effects:[]};const evidence=assessmentEvidence(ctx,item,attempt,grade,consumed.schedulingEligible);
  effects.push(evidenceInsert(evidence),...await projectionEffects(ctx,[evidence]),...consumed.effects);return {effects,data:{ids:[String(offer.id)],attempt_id:offer.id,state:'graded',grade},projectionChanged:true};}
 const job=await newJob(ctx,item,'grade',String(offer.id),String(offer.verification_id),0,(data.answer as {text:string}).text);if(!job.record)invalid('An unanswered offer cannot already have a grading job');
 effects.push(insert('grade_jobs',job.record));if(lease)effects.push(...(await planReviewPending(ctx,lease,String(offer.id),String(offer.session_id))).effects);
 return {effects,data:{ids:[String(offer.id)],attempt_id:offer.id,job_id:job.record.job_id,state:'pending',...(job.record.pending_reason?{pending_reason:job.record.pending_reason}:{})}};
}
export async function planDispute(ctx:Context):Promise<Plan>{
 const data=ctx.envelope.data;const attempt=await entity(ctx,'attempts',String(data.attempt_id));await session(ctx,String(attempt.session_id),true,true);
 if(attempt.state!=='graded')invalid('Only a graded attempt can be disputed');
 const evidence=await ctx.db.prepare('SELECT * FROM evidence WHERE learner_id=? AND attempt_id=?').bind(ctx.actor.learner_id,String(attempt.id)).first<Row>();if(!evidence)invalid('There is no assessed evidence to dispute');
 const revision=Number(await ctx.db.prepare('SELECT COALESCE(MAX(effective_revision),0) AS n FROM record_corrections WHERE root_record_id=?').bind(String(evidence.id)).first('n'));
 if(revision!==data.expected_effective_revision)throw new DataError('VERSION_CONFLICT','Dispute revision changed',{[String(attempt.id)]:revision});
 const correction={...common(ctx,ctx.newId('rc')),root_record_id:String(evidence.id),expected_effective_revision:revision,effective_revision:revision+1,action:'dispute',replacement_json:'{}',reason:String(data.reason),seq:ctx.nextSeq};
 const effects:SqlEffect[]=[insert('record_corrections',{...correction,seq:SEQ}),update('attempts',String(attempt.id),{state:'disputed'}),...await projectionEffects(ctx,[],[correction])];
 const previous=await ctx.db.prepare('SELECT job_id FROM grade_jobs WHERE attempt_id=? AND purpose=\'regrade\'').bind(String(attempt.id)).first<Row>();
 if(previous)return {effects,data:{ids:[String(attempt.id)],state:'disputed',pending_reason:'human_review_required'},projectionChanged:true};
 const item=await eligibleItem(ctx,String(attempt.item_id),Number(attempt.item_version));
 if(item.exact_key_json)return {effects,data:{ids:[String(attempt.id)],state:'disputed',pending_reason:'source_review_required'},projectionChanged:true};
 const job=await newJob(ctx,item,'regrade',String(attempt.id),String(attempt.verification_id),revision+1,(JSON.parse(String(attempt.answer)) as {text:string}).text);if(job.record)effects.push(insert('grade_jobs',job.record));
 return {effects,data:{ids:[String(attempt.id)],job_id:job.existing??job.record!.job_id,state:'disputed'},projectionChanged:true};
}
