import type {Context,Plan,Row,SqlEffect} from './types.ts';
import {entity,canonicalConcept,common,insert,update,session} from './sql.ts';
import {invalid,DataError} from './errors.ts';
import {captureSet,hashValue,held,itemSnapshot,newJob} from './assessment-shared.ts';
import {parseExactKey,visibleExactKey} from '../grading/exact.ts';
import {planReviewClaim,dueReviews} from './reviews.ts';
export async function planItem(ctx:Context):Promise<Plan>{
 const data=ctx.envelope.data;
 if(ctx.envelope.operation==='item_add'){
  const points=data.key_points as {point_id:string;required:boolean;anchor_ids:string[]}[];if(!points.some(point=>point.required)||new Set(points.map(point=>point.point_id)).size!==points.length||points.some(point=>new Set(point.anchor_ids).size!==point.anchor_ids.length))invalid('Rubric points must be unique with a required criterion');
  const concept=await canonicalConcept(ctx,String(data.concept_id));if(concept.archived)invalid('An archived concept cannot receive assessment content');
  const old=data.item_id?await entity(ctx,'items',String(data.item_id),true):null;
  if(old&&(old.concept_id!==concept.id||old.state==='retired'))invalid('Item identity cannot be reassigned or retired content reopened');
  const id=old?String(old.id):ctx.newId('it');const version=old?Number(old.current_item_version)+1:1;
  const exact=data.exact_key===null?null:parseExactKey(data.exact_key);
  if(exact?.kind==='mcq_single'&&data.assessment_form!=='recognition')invalid('Multiple choice assesses recognition');
  if(exact&&exact.kind!==data.type||!exact&&data.type!=='free_text')invalid('Item type and key differ');
  const content={level:data.level,type:data.type,stem:data.stem,essential_context:data.essential_context,assessment_form:data.assessment_form,key_points:data.key_points,distractors:data.distractors,exact_key:exact};
  const versionRow={item_id:id,item_version:version,stem:String(data.stem),context_json:JSON.stringify({essential_context:data.essential_context}),assessment_form:String(data.assessment_form),key_points_json:JSON.stringify(data.key_points),distractors_json:JSON.stringify(data.distractors),exact_key_json:exact===null?null:JSON.stringify(exact),content_sha256:await hashValue(content)};
  const values={level:Number(data.level),type:String(data.type),current_item_version:version,current_verification_id:null,state:'draft'};
  return {effects:[old?update('items',id,values):insert('items',{...common(ctx,id),concept_id:String(concept.id),...values}),insert('item_versions',versionRow)],data:{ids:[id],item_version:version,versions:{[id]:old?Number(old.version)+1:1}}};
 }
 const item=await itemSnapshot(ctx.db,ctx.actor.learner_id,String(data.item_id),Number(data.item_version));
 if(ctx.envelope.operation==='item_retire'){
  await entity(ctx,'items',String(item.id),true);return {effects:[update('items',String(item.id),{state:'retired',current_verification_id:null})],data:{ids:[String(item.id)],item_version:data.item_version}};
 }
 const job=await newJob(ctx,item,'key_verify',null,null);return {effects:job.record?[insert('grade_jobs',job.record)]:[],data:{ids:[job.existing??job.record!.job_id],job_id:job.existing??job.record!.job_id,status:job.existing?'existing':'pending',...(job.record?.pending_reason?{pending_reason:job.record.pending_reason}:{}),item_id:item.id,item_version:data.item_version}};
}
export async function eligibleItem(ctx:Context,itemId:string,version:number){
 const item=await itemSnapshot(ctx.db,ctx.actor.learner_id,itemId,version);if(item.state!=='verified'||!item.current_verification_id)held('This item has no current accepted verification');
 const verification=await entity(ctx,'item_verifications',String(item.current_verification_id));
 const sources=await captureSet(ctx.db,ctx.actor.learner_id,JSON.parse(String(item.key_points_json)));
 if(verification.state!=='supported'||verification.item_version!==version||verification.capture_set_hash!==sources.hash)held('This key verification is stale');return item;
}
export async function planItemNext(ctx:Context):Promise<Plan>{
 const data=ctx.envelope.data;await session(ctx,String(data.session_id));
 const candidates=await ctx.db.prepare("SELECT i.id,i.current_item_version,i.concept_id,i.level FROM items i JOIN concepts c ON c.id=i.concept_id WHERE i.learner_id=? AND i.state='verified' AND c.archived=0 AND c.merged_into IS NULL AND (? IS NULL OR i.concept_id=?) AND (? IS NULL OR i.level=?) ORDER BY i.created_seq,i.id").bind(ctx.actor.learner_id,data.concept_id??null,data.concept_id??null,data.level??null,data.level??null).all<Row>();
 const due=data.purpose==='review'?await dueReviews(ctx.db,ctx.actor,ctx.now,String(data.session_id)):null;
 let item:Row|undefined;let chosenClaim:Awaited<ReturnType<typeof planReviewClaim>>|undefined;let reviewConflict:DataError|undefined;
 for(const candidate of candidates.results){
  if(due&&!due.some(schedule=>schedule.concept_id===candidate.concept_id&&schedule.level===candidate.level))continue;
  try{const possible=await eligibleItem(ctx,String(candidate.id),Number(candidate.current_item_version));
   const repeat=await ctx.db.prepare('SELECT a.item_id FROM review_schedules s JOIN review_occurrences o ON o.concept_id=s.concept_id AND o.level=s.level AND o.state=\'consumed\' JOIN attempts a ON a.id=o.consumed_attempt_id WHERE s.learner_id=? AND s.concept_id=? AND s.level=? AND s.suppressed_session_id IS NOT NULL ORDER BY o.updated_seq DESC LIMIT 1').bind(ctx.actor.learner_id,String(possible.concept_id),Number(possible.level)).first<Row>();
   if(data.purpose==='review'&&repeat?.item_id===possible.id)continue;
   if(data.purpose==='review')chosenClaim=await planReviewClaim(ctx,{concept_id:String(possible.concept_id),level:Number(possible.level),session_id:String(data.session_id),...(data.takeover===true?{takeover:true}:{})});item=possible;break;
  }catch(error){if(!(error instanceof DataError)||!['ITEM_HELD','REVIEW_LEASE_CONFLICT'].includes(error.code))throw error;if(error.code==='REVIEW_LEASE_CONFLICT')reviewConflict=error;}
 }
 if(!item){if(reviewConflict)throw reviewConflict;held('No verified eligible item is available');}
 const offerId=ctx.newId('at');let lease:unknown=null;let effects:readonly SqlEffect[]=[];
 if(data.purpose==='review'){
  effects=chosenClaim!.effects;lease=chosenClaim!.lease;
 }
 const exact=item.exact_key_json?parseExactKey(JSON.parse(String(item.exact_key_json))):null;
 return {effects:[...effects,insert('item_offers',{id:offerId,learner_id:ctx.actor.learner_id,item_id:String(item.id),item_version:Number(item.current_item_version),verification_id:String(item.current_verification_id),session_id:String(data.session_id),connection_id:ctx.actor.connection_id,recovery_generation:ctx.actor.generation,purpose:String(data.purpose),review_lease_json:lease?JSON.stringify(lease):null,state:'offered',created_at:ctx.now})],data:{ids:[offerId],attempt_id:offerId,item:{item_id:item.id,item_version:item.current_item_version,stem:item.stem,essential_context:JSON.parse(String(item.context_json)).essential_context,level:item.level,type:item.type,assessment_form:item.assessment_form,...(exact?{answer_format:visibleExactKey(exact)}:{answer_format:{kind:'free_text'}})},...(lease?{review_lease:lease}:{})}};
}
