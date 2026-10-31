import { afterEach,beforeEach,describe,it,expect } from 'vitest';
import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { initialise,createRepository,type Admission,type Context,type SqlEffect,type Row } from '../src/data/index.ts';
import { projectionEffects,evidenceFromRow } from '../src/data/projections.ts';
import { planReviewClaim,planReviewPending,planReviewConsume,validateReviewLease,dueReviews } from '../src/data/reviews.ts';
let mf:Miniflare;let db:D1Database;let conceptId:string;let sessionId:string;let otherSession:string;let seq=10;
const learner='l_11111111-1111-4111-8111-111111111111';const actor:Admission={learner_id:learner,connection_id:'reviews',generation:1,scopes:['teach:read','teach:learn','teach:organize']};
const accepted='2026-10-28T10:00:00.000Z';const now='2026-11-29T10:00:00.000Z';
async function context(time=now):Promise<Context>{return {db,actor,now:time,newId:prefix=>`${prefix}_${crypto.randomUUID()}`,nextSeq:++seq,meta:await db.prepare('SELECT * FROM meta').first() as Context['meta'],envelope:{protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation:'test',reason:'review fixture',expected:{},data:{},session_id:sessionId}};}
async function apply(ctx:Context,effects:readonly SqlEffect[]){const statements=effects.map(effect=>{let index=0;const bound:(string|number|null)[]=[];const sql=effect.sql.replace(/__GUARD__|__SEQ__|\?/g,token=>{if(token==='__GUARD__'){bound.push(ctx.actor.generation,ctx.meta.meta_revision);return 'EXISTS(SELECT 1 FROM meta WHERE generation=? AND meta_revision=?)';}if(token==='__SEQ__')return String(ctx.nextSeq);bound.push(effect.args[index++]!);return '?';});return db.prepare(sql).bind(...bound);});statements.push(db.prepare('UPDATE meta SET meta_revision=meta_revision+1 WHERE generation=? AND meta_revision=?').bind(ctx.actor.generation,ctx.meta.meta_revision));await db.batch(statements);}
function evidence(overrides:Row={}):Row{return {id:'e_11111111-1111-4111-8111-111111111112',seq:5,concept_id:conceptId,level:1,kind:'answer',content_grade:'correct',confidence:'sure',occurred_at:accepted,accepted_at:accepted,local_day:'2026-10-28',help_json:'{}',assessment_form:'production',attempt_id:'at_11111111-1111-4111-8111-111111111113',...overrides};}
async function seedSchedule(){const ctx=await context();await apply(ctx,await projectionEffects(ctx,[evidence()]));}
async function seedAttempt(attemptId:string){
 const item='it_11111111-1111-4111-8111-111111111111';const verification='iv_11111111-1111-4111-8111-111111111111';
 await db.prepare("INSERT OR IGNORE INTO items(id,learner_id,concept_id,level,type,state) VALUES(?,?,?,1,'prose','verified')").bind(item,learner,conceptId).run();
 await db.prepare("INSERT OR IGNORE INTO item_versions VALUES(?,1,'Stem','{}','production','[]','[]',NULL,'hash')").bind(item).run();
 await db.prepare("INSERT OR IGNORE INTO item_verifications(id,learner_id,item_id,item_version,capture_set_hash,prompt_version,state,result_json,verifier_provenance_json,seq,result_job_id) VALUES(?,?,?,1,'hash',1,'supported','{}','{}',1,'job')").bind(verification,learner,item).run();
 await db.prepare("INSERT INTO attempts(id,learner_id,session_id,item_id,item_version,answer,confidence,help_json,occurred_at,accepted_at,timezone,local_day,state,verification_id) VALUES(?,?,?,?,1,'Answer','unknown','{}',?,?,'UTC','2026-11-29','pending',?)").bind(attemptId,learner,sessionId,item,now,now,verification).run();
}
beforeEach(async()=>{
 mf=new Miniflare({workers:[{config:{name:'reviews',compatibilityDate:'2026-10-01',manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:'export default {fetch(){return new Response("test")}}'}}},env:{DB:{type:'d1',id:crypto.randomUUID()}}}}]});db=await mf.getD1Database('DB');
 const schema=await readFile(new URL('../migrations/0001_foundation.sql',import.meta.url),'utf8');await db.batch(schema.split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));await initialise(db,{learnerId:learner});
 const repo=createRepository(db);const execute=async(operation:string,data:Row)=>{const r=await repo.execute({protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation,reason:'test',expected:{},data},actor);if(!r.ok)throw Error(JSON.stringify(r));return r.data.ids![0]!;};
 conceptId=await execute('concept_upsert',{realm:'cs',area:'reviews',slug:'review',title:'Review',purpose:'Remember',origin:'inquiry',anchor_ids:[]});sessionId=await execute('session_start',{});otherSession=await execute('session_start',{});
});afterEach(async()=>{await mf.dispose();});
describe('persisted scheduling and stable review leases',()=>{
 it('persists FSRS state from server acceptance time without rating exposure or unknown confidence',async()=>{
  const ctx=await context();await apply(ctx,await projectionEffects(ctx,[evidence({confidence:'unknown'})]));expect(await db.prepare('SELECT COUNT(*) AS n FROM review_schedules').first('n')).toBe(0);
  await seedSchedule();const schedule=await db.prepare('SELECT * FROM review_schedules').first<Row>();expect(schedule).toMatchObject({concept_id:conceptId,level:1,schedule_revision:1,last_rated_seq:5});expect(String(schedule!.card_json)).toContain(accepted);expect((await dueReviews(db,actor,now)).length).toBe(1);
 });
 it('keeps one stable occurrence and fences takeover while allowing stale evidence to remain non-scheduling',async()=>{
  await seedSchedule();const firstCtx=await context();const first=await planReviewClaim(firstCtx,{concept_id:conceptId,level:1,session_id:sessionId});await apply(firstCtx,first.effects);
  const same=await planReviewClaim(await context(),{concept_id:conceptId,level:1,session_id:sessionId});expect(same.lease).toEqual(first.lease);
  await expect(planReviewClaim(await context(),{concept_id:conceptId,level:1,session_id:otherSession})).rejects.toMatchObject({code:'REVIEW_LEASE_CONFLICT'});
  const takeoverCtx=await context();const takeover=await planReviewClaim(takeoverCtx,{concept_id:conceptId,level:1,session_id:otherSession,takeover:true});await apply(takeoverCtx,takeover.effects);expect(takeover.lease.occurrence_id).toBe(first.lease.occurrence_id);expect(takeover.lease.lease_generation).toBe(first.lease.lease_generation+1);
  expect(await validateReviewLease(await context(),first.lease,sessionId)).toMatchObject({schedulingEligible:false});expect(await db.prepare("SELECT COUNT(*) AS n FROM review_occurrences WHERE state IN ('open','reserved')").first('n')).toBe(1);
  expect(evidenceFromRow(evidence({scheduling_eligible:0})).schedulingEligible).toBe(false);
 });
 it('allows only one contender to install a lease from the same guarded snapshot',async()=>{
  await seedSchedule();const [a,b]=await Promise.all([context(),context()]);const [first,second]=await Promise.all([planReviewClaim(a,{concept_id:conceptId,level:1,session_id:sessionId}),planReviewClaim(b,{concept_id:conceptId,level:1,session_id:otherSession})]);
  await apply(a,first.effects);await apply(b,second.effects);expect(await db.prepare("SELECT COUNT(*) AS n FROM review_occurrences WHERE state='reserved'").first('n')).toBe(1);expect(await db.prepare("SELECT lease_session_id FROM review_occurrences WHERE state='reserved'").first('lease_session_id')).toBe(sessionId);
 });
 it('invalidates old leases when replay removes the only strong demonstration',async()=>{
  await seedSchedule();const ctx=await context();const claimed=await planReviewClaim(ctx,{concept_id:conceptId,level:1,session_id:sessionId});await apply(ctx,claimed.effects);
  const changed=await context();await apply(changed,await projectionEffects(changed,[evidence({confidence:'unknown'})]));expect(await db.prepare('SELECT COUNT(*) AS n FROM review_schedules').first('n')).toBe(0);expect(await db.prepare('SELECT state FROM review_occurrences').first('state')).toBe('superseded');
 });
 it('does not grant a second independent day from a stale reissued review',async()=>{
  const ctx=await context();await apply(ctx,await projectionEffects(ctx,[evidence(),evidence({id:'e_22222222-2222-4222-8222-222222222222',seq:6,occurred_at:now,accepted_at:now,local_day:'2026-11-29',scheduling_eligible:0})],[{root_record_id:'e_22222222-2222-4222-8222-222222222222',expected_effective_revision:0,effective_revision:1,action:'amend',replacement_json:JSON.stringify({confidence:'sure'}),seq:9}]));expect(await db.prepare('SELECT state FROM mastery_projection WHERE concept_id=? AND level=1').bind(conceptId).first('state')).toBe('Solid');expect(await db.prepare('SELECT last_rated_seq FROM review_schedules').first('last_rated_seq')).toBe(5);
 });
 it('keeps an accepted pending attempt eligible after lease expiry and consumes an unknown result without rating',async()=>{
  await seedSchedule();const ctx=await context();const claimed=await planReviewClaim(ctx,{concept_id:conceptId,level:1,session_id:sessionId});await apply(ctx,claimed.effects);
  const attempt='at_33333333-3333-4333-8333-333333333333';await seedAttempt(attempt);const pendingCtx=await context();const pending=await planReviewPending(pendingCtx,claimed.lease,attempt);expect(pending.schedulingEligible).toBe(true);await apply(pendingCtx,pending.effects);
  const later=await context('2026-11-29T11:00:00.000Z');expect(await validateReviewLease(later,claimed.lease,sessionId,attempt)).toEqual({schedulingEligible:true});
  const before=await db.prepare('SELECT card_json FROM review_schedules').first('card_json');const consumed=await planReviewConsume(later,claimed.lease,attempt,{unknownConfidence:true});expect(consumed.schedulingEligible).toBe(true);await apply(later,consumed.effects);
  expect(await db.prepare('SELECT state FROM review_occurrences').first('state')).toBe('consumed');expect(await db.prepare('SELECT card_json FROM review_schedules').first('card_json')).toBe(before);expect(await db.prepare('SELECT schedule_revision FROM review_schedules').first('schedule_revision')).toBe(2);
  expect(await dueReviews(db,actor,now,sessionId)).toEqual([]);expect(await dueReviews(db,actor,now,otherSession)).toHaveLength(1);
  expect((await planReviewConsume(await context(),claimed.lease,attempt,{unknownConfidence:true})).schedulingEligible).toBe(false);
 });
 it('does not consume an expired unsubmitted lease or a lease from a different session',async()=>{
  await seedSchedule();const ctx=await context();const claimed=await planReviewClaim(ctx,{concept_id:conceptId,level:1,session_id:sessionId});await apply(ctx,claimed.effects);
  expect(await validateReviewLease(await context('2026-11-29T11:00:00.000Z'),claimed.lease,sessionId)).toEqual({schedulingEligible:false});
  expect((await planReviewPending(await context(),claimed.lease,'missing',otherSession)).schedulingEligible).toBe(false);
  const renewedCtx=await context('2026-11-29T11:00:00.000Z');const renewed=await planReviewClaim(renewedCtx,{concept_id:conceptId,level:1,session_id:otherSession});await apply(renewedCtx,renewed.effects);expect(renewed.lease.lease_generation).toBe(2);
 });
 it('rejects requests before due and malformed leases without creating occurrences',async()=>{
  await seedSchedule();await db.prepare('UPDATE review_schedules SET due_at=?').bind('2027-01-01T00:00:00.000Z').run();await expect(planReviewClaim(await context(),{concept_id:conceptId,level:1,session_id:sessionId})).rejects.toMatchObject({code:'REVIEW_LEASE_CONFLICT'});expect(await validateReviewLease(await context(),{occurrence_id:'missing',lease_generation:1,schedule_revision:1},sessionId)).toMatchObject({schedulingEligible:false});
 });
});
