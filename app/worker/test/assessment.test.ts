import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {Miniflare} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {createRepository,initialise,type Admission,type Success} from '../src/data/index.ts';
import {modelPromptManifest,MODEL_SNAPSHOT} from '../src/grading/model.ts';
import {loadAssessmentJob} from '../src/data/assessment.ts';
let mf:Miniflare;let db:D1Database;let repo:ReturnType<typeof createRepository>;let concept:string;let sitting:string;
const learner='l_11111111-1111-4111-8111-111111111111';
const actor:Admission={learner_id:learner,connection_id:'connection',generation:1,scopes:['teach:read','teach:learn','teach:organize']};
const now='2026-10-29T10:00:00.000Z';
const env=(operation:string,data:Record<string,unknown>,rest:Record<string,unknown>={})=>({protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation,reason:'Synthetic assessment',expected:{},data,...rest});
function success(result:Awaited<ReturnType<typeof repo.execute>>):Success{if(!result.ok)throw new Error(JSON.stringify(result));return result;}
const first=(result:Success)=>result.data.ids![0]!;
beforeEach(async()=>{
 mf=new Miniflare({workers:[{config:{name:'assessment',compatibilityDate:'2026-10-01',manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:'export default {fetch(){return new Response("test")}}'}}},env:{LEARNING_DB:{type:'d1',id:crypto.randomUUID()}}}}]});db=await mf.getD1Database('LEARNING_DB');
 for(const name of ['0001_foundation.sql','0002_assessment.sql']){const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');await db.batch(sql.split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));}
 await initialise(db,{learnerId:learner});repo=createRepository(db,{now:()=>new Date(now)});
 sitting=first(success(await repo.execute(env('session_start',{}),actor)));
 concept=first(success(await repo.execute(env('concept_upsert',{realm:'cs',area:'values',slug:'boolean',title:'Boolean',purpose:'Truth values',origin:'inquiry',anchor_ids:[]}),actor)));
});afterEach(async()=>{await mf?.dispose();});
async function draft(){return success(await repo.execute(env('item_add',{concept_id:concept,level:1,type:'free_text',stem:'What is a boolean?',essential_context:'',assessment_form:'production',key_points:[{point_id:'p1',criterion:'A true or false value',required:true,anchor_ids:[]}],distractors:[],exact_key:null}),actor));}
describe('assessment data authority',()=>{
 it('stores immutable draft content and queues verification without accepting author verdicts',async()=>{
  const item=first(await draft());
  expect(await repo.execute(env('item_verify',{item_id:item,item_version:1,verified:true}),actor)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
  expect(await repo.execute(env('item_verify',{item_id:item,item_version:1}),actor)).toMatchObject({ok:false,error:{code:'ITEM_HELD'}});
  expect(await db.prepare('SELECT COUNT(*) FROM item_versions WHERE item_id=?').bind(item).first('COUNT(*)')).toBe(1);
 });
 it('withholds draft items and refuses client-invented completion authority',async()=>{
  await draft();expect(await repo.execute(env('item_next',{concept_id:concept,level:1,purpose:'lesson',session_id:sitting}),actor)).toMatchObject({ok:false,error:{code:'ITEM_HELD'}});
  expect(await repo.execute(env('_complete_assessment',{job_id:'fake'}),actor)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
  await expect(loadAssessmentJob(db,'missing',actor)).rejects.toThrow();
 });
});
async function capturedDraft(type='free_text',exact:Record<string,unknown>|null=null){
 const passage='A boolean is either true or false.';const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(passage)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 repo=createRepository(db,{now:()=>new Date(now),captureSource:async input=>({canonicalUrl:input.url,sourceVersion:'etag-1',locator:input.locator,passage,sourceHash:sha,passageHash:sha,capturedAt:now,provenance:{authority:'public-source-capture',transport:'public-only',etag:'etag-1',requestedVersion:input.sourceVersion,mime:'text/plain',redirects:0}})});
 const anchor=first(success(await repo.execute(env('anchor_capture',{url:'https://docs.example.com/boolean',locator:{kind:'lines',start:1,end:1},sourceVersion:'current'}),actor)));
 const item=first(success(await repo.execute(env('item_add',{concept_id:concept,level:1,type,stem:'What is a boolean?',essential_context:'',assessment_form:type==='mcq_single'?'recognition':'production',key_points:[{point_id:'p1',criterion:'A true or false value',required:true,anchor_ids:[anchor]}],distractors:[],exact_key:exact}),actor)));
 return {item,anchor};
}
async function running(jobId:string){const dispatch=crypto.randomUUID();await db.batch([db.prepare("UPDATE grade_jobs SET status='running',job_revision=job_revision+1,dispatch_id=? WHERE job_id=?").bind(dispatch,jobId),db.prepare('UPDATE meta SET meta_revision=meta_revision+1')]);return {dispatch,revision:Number(await db.prepare('SELECT job_revision FROM grade_jobs WHERE job_id=?').bind(jobId).first('job_revision'))};}
async function verified(type='free_text',exact:Record<string,unknown>|null=null){
 const {item,anchor}=await capturedDraft(type,exact);
 const queued=success(await repo.execute(env('item_verify',{item_id:item,item_version:1}),actor));const jobId=String(queued.data.job_id);const {dispatch,revision}=await running(jobId);
 const result={points:[{point_id:'p1',verdict:'supported',anchor_ids:[anchor],reason:'The captured source explicitly supports this value.'}],exact_key_verdict:exact?'supported':null,exact_key_point_ids:exact?['p1']:[],exact_key_reason:exact?'The exact expected value follows from the cited passage.':null};
 success(await repo.executeInternal(env('_complete_assessment',{job_id:jobId,dispatch_id:dispatch,job_revision:revision,result,provenance:await provenance('key_verify')}),actor));return {item,anchor,jobId};
}
async function provenance(purpose:'key_verify'|'grade'|'regrade'){const manifest=await modelPromptManifest(purpose);return {prompt_hash:manifest.promptHash,schema_hash:manifest.schemaHash,model_snapshot:MODEL_SNAPSHOT};}
const grade=(value:'correct'|'partial'|'wrong')=>({status:'graded',grade:value,points:[{point_id:'p1',result:value==='correct'?'met':value==='partial'?'partial':'missed',reason:'Checked against the immutable rubric.'}],feedback:'Synthetic criterion feedback.',misconception_hypothesis:null,probe_warranted:false});
async function offer(item?:string){const issued=success(await repo.execute(env('item_next',{concept_id:concept,level:1,purpose:'lesson',session_id:sitting}),actor));expect(issued.data.item).not.toHaveProperty('exact_key');if(item)expect((issued.data.item as Record<string,unknown>).item_id).toBe(item);return issued;}
it('completes independent verification and grading once, then regrades the original evidence through corrections',async()=>{
 const {item,jobId}=await verified();
 expect(await db.prepare('SELECT COUNT(*) AS n FROM item_versions WHERE item_id=?').bind(item).first('n')).toBe(1);
 expect(await db.prepare('SELECT state FROM items WHERE id=?').bind(item).first('state')).toBe('verified');
 const repeat=success(await repo.execute(env('item_verify',{item_id:item,item_version:1}),actor));expect(repeat.data.job_id).toBe(jobId);
 const issued=await offer(item);const attempt=String(issued.data.attempt_id);const input=env('answer',{attempt_id:attempt,item_id:item,item_version:1,answer:{kind:'free_text',text:'A true or false value.'},confidence:'sure',help:{}});
 const accepted=success(await repo.execute(input,actor));const gradeId=String(accepted.data.job_id);
 expect(success(await repo.read('attempt_status',{attempt_id:attempt},actor)).data).toMatchObject({state:'pending'});
 const model=await loadAssessmentJob(db,gradeId,actor);expect(model.request.answer).toBe('A true or false value.');expect(JSON.stringify(model.request)).not.toContain('confidence');
 const claim=await running(gradeId);const completion=env('_complete_assessment',{job_id:gradeId,dispatch_id:claim.dispatch,job_revision:claim.revision,result:grade('correct'),provenance:await provenance('grade')});
 success(await repo.executeInternal(completion,actor));expect(success(await repo.executeInternal(completion,actor)).meta.replayed).toBe(true);
 expect(await db.prepare('SELECT COUNT(*) AS n FROM evidence WHERE attempt_id=?').bind(attempt).first('n')).toBe(1);
 expect(success(await repo.read('mastery',{concept_id:concept,level:1},actor)).data.rows).toEqual([expect.objectContaining({state:'Solid'})]);
 const disputed=success(await repo.execute(env('dispute_answer',{attempt_id:attempt,expected_effective_revision:0,reason:'Check a possible omission'}),actor));
 expect(success(await repo.read('mastery',{concept_id:concept,level:1},actor)).data.rows).toEqual([expect.objectContaining({provisional:1})]);
 const regradeId=String(disputed.data.job_id);const regradeClaim=await running(regradeId);success(await repo.executeInternal(env('_complete_assessment',{job_id:regradeId,dispatch_id:regradeClaim.dispatch,job_revision:regradeClaim.revision,result:grade('wrong'),provenance:await provenance('regrade')}),actor));
 expect(success(await repo.read('mastery',{concept_id:concept,level:1},actor)).data.rows).toEqual([expect.objectContaining({state:'Shaky',provisional:0})]);
 expect(await db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE id=?').bind(attempt).first('n')).toBe(1);
 expect(await db.prepare('SELECT COUNT(*) AS n FROM evidence WHERE attempt_id=?').bind(attempt).first('n')).toBe(1);
 expect(await repo.execute({...input,request_id:crypto.randomUUID(),data:{...input.data,answer:{kind:'free_text',text:'Changed answer'}}},actor)).toMatchObject({ok:false,error:{code:'IDEMPOTENCY_MISMATCH'}});
});
it('evaluates a verified exact key without exposing it before the attempt and holds changed sources',async()=>{
 const {item}=await verified('predict_scalar',{kind:'predict_scalar',expected:true});const issued=await offer(item);expect(JSON.stringify(issued)).not.toContain('expected');
 const attempt=String(issued.data.attempt_id);const result=success(await repo.execute(env('answer',{attempt_id:attempt,item_id:item,item_version:1,answer:{kind:'predict_scalar',value:true},confidence:'unknown',help:{}}),actor));expect(result.data).toMatchObject({state:'graded',grade:'correct'});
 expect(await db.prepare('SELECT COUNT(*) AS n FROM grade_jobs WHERE attempt_id=?').bind(attempt).first('n')).toBe(0);
 expect(success(await repo.read('mastery',{concept_id:concept,level:1},actor)).data.rows).toEqual([expect.objectContaining({state:'Exposed'})]);
 await db.prepare("UPDATE anchors SET state='changed' WHERE learner_id=?").bind(learner).run();
 expect(await repo.execute(env('item_next',{concept_id:concept,level:1,purpose:'lesson',session_id:sitting}),actor)).toMatchObject({ok:false,error:{code:'ITEM_HELD'}});
});
it('keeps old item content immutable, rejects stale offers and refuses a superseded completion',async()=>{
 const {item}=await verified();const offered=await offer(item);const attempt=String(offered.data.attempt_id);
 const changed=success(await repo.execute(env('item_add',{item_id:item,concept_id:concept,level:1,type:'free_text',stem:'Updated question',essential_context:'',assessment_form:'production',key_points:[{point_id:'p1',criterion:'Explain truth values',required:true,anchor_ids:[]}],distractors:[],exact_key:null},{expected:{[item]:2}}),actor));expect(changed.data.item_version).toBe(2);
 expect(await db.prepare('SELECT stem FROM item_versions WHERE item_id=? AND item_version=1').bind(item).first('stem')).toBe('What is a boolean?');
 expect(await repo.execute(env('answer',{attempt_id:attempt,item_id:item,item_version:1,answer:{kind:'free_text',text:'A value'},confidence:'think',help:{}}),actor)).toMatchObject({ok:false,error:{code:'ITEM_HELD'}});
 const second=await verified();const issued=await offer(second.item);const saved=success(await repo.execute(env('answer',{attempt_id:issued.data.attempt_id,item_id:second.item,item_version:1,answer:{kind:'free_text',text:'A true or false value.'},confidence:'sure',help:{}}),actor));const jobId=String(saved.data.job_id);const claim=await running(jobId);
 expect(await repo.executeInternal(env('_complete_assessment',{job_id:jobId,dispatch_id:'wrong-dispatch',job_revision:claim.revision,result:grade('correct'),provenance:{}}),actor)).toMatchObject({ok:false,error:{code:'VERSION_CONFLICT'}});
 expect(await db.prepare('SELECT COUNT(*) AS n FROM evidence WHERE attempt_id=?').bind(String(issued.data.attempt_id)).first('n')).toBe(0);
 expect(await repo.executeInternal(env('_complete_assessment',{job_id:jobId,dispatch_id:claim.dispatch,job_revision:claim.revision,result:{...grade('correct'),grade:'wrong'},provenance:await provenance('grade')}),actor)).toMatchObject({ok:false});
});
it('rejects forged source provenance, preserves stable captures and holds verified items on source change',async()=>{
 expect(await repo.execute(env('anchor_capture',{url:'https://docs.example.com/boolean',locator:{kind:'lines',start:1,end:1},sourceVersion:'current',sha256:'forged'}),actor)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 const {item,anchor}=await verified();const captureInput={url:'https://docs.example.com/boolean',locator:{kind:'lines',start:1,end:1},sourceVersion:'current'};
 const repeat=success(await repo.execute(env('anchor_capture',captureInput),actor));expect(repeat.data.anchor_version).toBe(1);expect(await db.prepare('SELECT COUNT(*) AS n FROM source_captures WHERE anchor_id=?').bind(anchor).first('n')).toBe(1);
 repo=createRepository(db,{now:()=>new Date(now),captureSource:async input=>({canonicalUrl:input.url,sourceVersion:'etag-2',locator:input.locator,passage:'Changed source text.',sourceHash:'a'.repeat(64),passageHash:'a'.repeat(64),capturedAt:now,provenance:{authority:'public-source-capture',transport:'public-only',etag:'etag-2',requestedVersion:input.sourceVersion,mime:'text/plain',redirects:0}})});
 expect(success(await repo.execute(env('anchor_capture',captureInput),actor)).data.anchor_version).toBe(2);
 expect(await db.prepare('SELECT state FROM items WHERE id=?').bind(item).first('state')).toBe('held');
 expect(await repo.execute(env('item_next',{concept_id:concept,purpose:'lesson',session_id:sitting}),actor)).toMatchObject({ok:false,error:{code:'ITEM_HELD'}});
});
it('pins offer generation and refuses cross-connection submissions',async()=>{
 const {item}=await verified();const issued=await offer(item);const data={attempt_id:issued.data.attempt_id,item_id:item,item_version:1,answer:{kind:'free_text',text:'true or false'},confidence:'sure',help:{}};
 const other={...actor,connection_id:'other'};success(await repo.execute(env('session_start',{resume_session_id:sitting}),other));
 expect(await repo.execute(env('answer',data),other)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 await db.prepare('UPDATE meta SET generation=2').run();expect(await repo.execute({...env('answer',data),recovery_generation:2},{...actor,generation:2})).toMatchObject({ok:false,error:{code:'STALE_GENERATION'}});
});
it('marks recognition as practice, requires immutable answer kinds and safely retires items',async()=>{
 const {item}=await verified('mcq_single',{kind:'mcq_single',options:[{option_id:'true',label:'true or false value'},{option_id:'false',label:'number only'}],correct_option_id:'true'});
 const issued=await offer(item);expect(JSON.stringify(issued.data.item)).not.toContain('correct_option_id');
 const base={attempt_id:issued.data.attempt_id,item_id:item,item_version:1,confidence:'sure',help:{}};
 expect(await repo.execute(env('answer',{...base,answer:{kind:'mcq_single',option_id:'not-a-listed-option'}}),actor)).toMatchObject({ok:false});
 const accepted=success(await repo.execute(env('answer',{...base,answer:{kind:'mcq_single',option_id:'true'}}),actor));expect(accepted.data.grade).toBe('correct');
 expect(success(await repo.read('mastery',{concept_id:concept,level:1},actor)).data.rows).toEqual([expect.objectContaining({state:'Exposed'})]);
 success(await repo.execute(env('item_retire',{item_id:item,item_version:1,reason:'Replace this exercise'},{expected:{[item]:2}}),actor));
 expect(await repo.execute(env('item_next',{concept_id:concept,purpose:'lesson',session_id:sitting}),actor)).toMatchObject({ok:false,error:{code:'ITEM_HELD'}});
});
it('selects an overdue free review rather than an earlier future or busy candidate',async()=>{
 const firstConcept=concept;await verified();
 concept=first(success(await repo.execute(env('concept_upsert',{realm:'cs',area:'values',slug:'second',title:'Second',purpose:'Second test concept',origin:'inquiry',anchor_ids:[]}),actor)));await verified();const secondConcept=concept;
 const schedule=(id:string,due:string)=>db.prepare('INSERT INTO review_schedules(learner_id,concept_id,level,scheduler_manifest_id,card_json,last_rated_seq,due_at,schedule_revision) VALUES(?,?,1,1,\'{}\',0,?,1)').bind(learner,id,due);
 await db.batch([schedule(firstConcept,'2026-12-01T10:00:00.000Z'),schedule(secondConcept,'2026-10-28T10:00:00.000Z')]);
 const other={...actor,connection_id:'other-reviewer'};const otherSession=first(success(await repo.execute(env('session_start',{}),other)));
 const leased=success(await repo.execute(env('item_next',{purpose:'review',session_id:otherSession}),other));expect((leased.data.item as Record<string,unknown>).item_id).toBeTruthy();
 concept=first(success(await repo.execute(env('concept_upsert',{realm:'cs',area:'values',slug:'third',title:'Third',purpose:'Third test concept',origin:'inquiry',anchor_ids:[]}),actor)));const third=await verified();await schedule(concept,'2026-10-28T10:00:00.000Z').run();
 const chosen=success(await repo.execute(env('item_next',{purpose:'review',session_id:sitting}),actor));expect((chosen.data.item as Record<string,unknown>).item_id).toBe(third.item);
});
it('keeps oversized model jobs pending before dispatch and rejects oversized Unicode answers',async()=>{
 const {anchor}=await capturedDraft();const item=first(success(await repo.execute(env('item_add',{concept_id:concept,level:1,type:'free_text',stem:'S'.repeat(16000),essential_context:'C'.repeat(16000),assessment_form:'production',key_points:[{point_id:'p1',criterion:'true or false',required:true,anchor_ids:[anchor]}],distractors:[],exact_key:null}),actor)));
 const queued=success(await repo.execute(env('item_verify',{item_id:item,item_version:1}),actor));expect(queued.data.pending_reason).toBe('input_too_large');
 expect(await db.prepare('SELECT status FROM grade_jobs WHERE job_id=?').bind(String(queued.data.job_id)).first('status')).toBe('pending');
 const verifiedItem=await verified();const issued=await offer(verifiedItem.item);
 expect(await repo.execute(env('answer',{attempt_id:issued.data.attempt_id,item_id:verifiedItem.item,item_version:1,answer:{kind:'free_text',text:'😀'.repeat(5000)},confidence:'sure',help:{}}),actor)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE id=?').bind(String(issued.data.attempt_id)).first('n')).toBe(0);
});
it('rejects duplicate rubric identities and rubrics without a required criterion before saving content',async()=>{
 const data={concept_id:concept,level:1,type:'free_text',stem:'Question',essential_context:'',assessment_form:'production',distractors:[],exact_key:null};
 expect(await repo.execute(env('item_add',{...data,key_points:[{point_id:'p1',criterion:'Optional',required:false,anchor_ids:[]}]}),actor)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await repo.execute(env('item_add',{...data,key_points:[{point_id:'p1',criterion:'First',required:true,anchor_ids:[]},{point_id:'p1',criterion:'Second',required:true,anchor_ids:[]}]}),actor)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
});
it('reports descriptive confidence calibration through effective disputes without duplicate regrade credit',async()=>{
 const {item}=await verified();const issued=await offer(item);const attempt=String(issued.data.attempt_id);
 const saved=success(await repo.execute(env('answer',{attempt_id:attempt,item_id:item,item_version:1,answer:{kind:'free_text',text:'A true or false value.'},confidence:'sure',help:{}}),actor));const jobId=String(saved.data.job_id);const claim=await running(jobId);
 success(await repo.executeInternal(env('_complete_assessment',{job_id:jobId,dispatch_id:claim.dispatch,job_revision:claim.revision,result:{...grade('wrong'),misconception_hypothesis:'May confuse booleans with numeric values.'},provenance:await provenance('grade')}),actor));
 expect(success(await repo.read('calibration',{concept_id:concept},actor)).data.rows).toContainEqual({confidence:'sure',assessed_count:1,correct:0,partial:0,wrong:1,provisional_count:0});
 expect(success(await repo.read('misconceptions',{concept_id:concept,level:2},actor)).data.rows).toEqual([]);
 const hypotheses=success(await repo.read('misconceptions',{concept_id:concept},actor));expect(hypotheses.data.rows).toEqual([expect.objectContaining({provenance:'grader_hypothesis',provisional:true,wording:'May confuse booleans with numeric values.'})]);
 success(await repo.execute(env('dispute_answer',{attempt_id:attempt,expected_effective_revision:0,reason:'Question the rubric interpretation'}),actor));
 expect(success(await repo.read('calibration',{concept_id:concept},actor)).data.rows).toContainEqual({confidence:'sure',assessed_count:0,correct:0,partial:0,wrong:0,provisional_count:1});
});
it('moves an owned inquiry through inbox resolution with trusted anchors and no fabricated assessment',async()=>{
 const inquiry=first(success(await repo.execute(env('log_inquiry',{text:'Why are booleans useful?',concept_ids:[concept],answer:{text:'Choose alternatives'}},{session_id:sitting}),actor)));
 expect(await repo.execute(env('submit_to_inbox',{inquiry_id:inquiry,what_would_resolve:'A verified example'},{expected:{[inquiry]:1}}),actor)).toMatchObject({ok:true});
 expect(success(await repo.read('inbox',{},actor)).data.rows).toEqual([expect.objectContaining({id:inquiry,what_would_resolve:'A verified example'})]);
 expect(await repo.execute(env('resolve_inbox_entry',{inquiry_id:inquiry,answer:'It selects between two branches',anchor_ids:['a_22222222-2222-4222-8222-222222222222']},{expected:{[inquiry]:2}}),actor)).toMatchObject({ok:false,error:{code:'ITEM_HELD'}});
 const {anchor}=await capturedDraft();
 success(await repo.execute(env('resolve_inbox_entry',{inquiry_id:inquiry,answer:'A boolean selects a true or false branch.',anchor_ids:[anchor]},{expected:{[inquiry]:2}}),actor));
 expect(success(await repo.read('inbox',{},actor)).data.rows).toEqual([]);
 expect(await db.prepare("SELECT COUNT(*) AS n FROM evidence WHERE learner_id=? AND kind='answer'").bind(learner).first('n')).toBe(0);
 const other={...actor,connection_id:'other'};
 expect(await repo.execute(env('submit_to_inbox',{inquiry_id:inquiry,what_would_resolve:'New question'},{expected:{[inquiry]:3}}),other)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
});
