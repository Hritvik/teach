import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {Miniflare} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {createRepository,initialise,type Admission,type Row,type Success} from '../src/data/index.ts';
let mf:Miniflare;let db:D1Database;let repo:ReturnType<typeof createRepository>;let concept:string;let sitting:string;
const learner='l_11111111-1111-4111-8111-111111111111';const accepted='2026-10-28T10:00:00.000Z';const current='2026-11-03T10:00:00.000Z';
const actor:Admission={learner_id:learner,connection_id:'correction-owner',generation:1,scopes:['teach:read','teach:learn','teach:organize']};
const evidenceId='e_22222222-2222-4222-8222-222222222222';const attemptId='at_22222222-2222-4222-8222-222222222222';const itemId='it_22222222-2222-4222-8222-222222222222';const verificationId='iv_22222222-2222-4222-8222-222222222222';
const envelope=(operation:string,data:Row,rest:Row={})=>({protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation,reason:'Correction contract test',expected:{},data,...rest});
const success=(result:Awaited<ReturnType<typeof repo.execute>>):Success=>{if(!result.ok)throw Error(JSON.stringify(result));return result;};
beforeEach(async()=>{
 mf=new Miniflare({workers:[{config:{name:'assessment-corrections',compatibilityDate:'2026-10-01',manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:'export default {fetch(){return new Response("test")}}'}}},env:{DB:{type:'d1',id:crypto.randomUUID()}}}}]});db=await mf.getD1Database('DB');
 for(const name of ['0001_foundation.sql','0002_assessment.sql']){const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');await db.batch(sql.split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));}
 await initialise(db,{learnerId:learner});repo=createRepository(db,{now:()=>new Date(current)});
 sitting=success(await repo.execute(envelope('session_start',{}),actor)).data.ids![0]!;
 concept=success(await repo.execute(envelope('concept_upsert',{realm:'cs',area:'metadata',slug:'metadata',title:'Metadata',purpose:'Correct observations',origin:'inquiry',anchor_ids:[]}),actor)).data.ids![0]!;
 await db.batch([
  db.prepare("INSERT INTO items(id,learner_id,concept_id,level,type,state,current_verification_id) VALUES(?,?,?,1,'free_text','verified',?)").bind(itemId,learner,concept,verificationId),
  db.prepare("INSERT INTO item_versions VALUES(?,1,'Question','{}','production','[]','[]',NULL,'content-hash')").bind(itemId),
  db.prepare("INSERT INTO item_verifications(id,learner_id,item_id,item_version,capture_set_hash,prompt_version,state,result_json,verifier_provenance_json,seq,result_job_id) VALUES(?,?,?,1,'capture',1,'supported','{}','{}',2,'job')").bind(verificationId,learner,itemId),
  db.prepare("INSERT INTO attempts(id,learner_id,session_id,item_id,item_version,answer,confidence,help_json,occurred_at,accepted_at,timezone,local_day,state,verification_id) VALUES(?,?,?,?,1,'Accepted answer','unknown','{}',?,?,'UTC','2026-10-28','graded',?)").bind(attemptId,learner,sitting,itemId,accepted,accepted,verificationId),
  db.prepare("INSERT INTO evidence(id,learner_id,seq,concept_id,level,session_id,attempt_id,kind,content_grade,strength,confidence,help_json,occurred_at,accepted_at,timezone,local_day,source_json,content,rules_version,scheduling_eligible) VALUES(?,?,2,?,1,?,?,'answer','correct','unresolved','unknown','{}',?,?,'UTC','2026-10-28','{}','Accepted answer',1,1)").bind(evidenceId,learner,concept,sitting,attemptId,accepted,accepted),
 ]);
});afterEach(async()=>{await mf?.dispose();});
const amend=(replacement:Row,revision=0)=>envelope('amend',{root_record_id:evidenceId,expected_effective_revision:revision,replacement,reason:'Correct caller-reported metadata'});
describe('accepted assessment metadata corrections',()=>{
 it('allows confidence and help amendments while replaying the original accepted observation only once',async()=>{
  const before=await db.prepare('SELECT * FROM attempts WHERE id=?').bind(attemptId).first();
  success(await repo.execute(envelope('session_end',{session_id:sitting},{expected:{[sitting]:1}}),actor));
  const request=amend({confidence:'sure'});success(await repo.execute(request,actor));
  expect(await db.prepare('SELECT state FROM mastery_projection WHERE concept_id=? AND level=1').bind(concept).first('state')).toBe('Solid');
  const schedule=await db.prepare('SELECT card_json,schedule_revision FROM review_schedules WHERE concept_id=? AND level=1').bind(concept).first<Row>();expect(String(schedule!.card_json)).toContain(accepted);expect(String(schedule!.card_json)).not.toContain(current);
  expect(success(await repo.execute(request,actor)).meta.replayed).toBe(true);expect(await db.prepare('SELECT COUNT(*) AS n FROM attempts').first('n')).toBe(1);expect(await db.prepare('SELECT * FROM attempts WHERE id=?').bind(attemptId).first()).toEqual(before);
  success(await repo.execute(amend({help:{content_hint:true}},1),actor));expect(await db.prepare('SELECT state FROM mastery_projection WHERE concept_id=? AND level=1').bind(concept).first('state')).toBe('Exposed');expect(await db.prepare('SELECT COUNT(*) AS n FROM review_schedules').first('n')).toBe(0);
  success(await repo.execute(amend({help:{content_hint:false}},2),actor));expect(await db.prepare('SELECT state FROM mastery_projection WHERE concept_id=? AND level=1').bind(concept).first('state')).toBe('Solid');expect(await db.prepare('SELECT COUNT(*) AS n FROM evidence').first('n')).toBe(1);
 });
 it('rejects rewriting accepted answer content, grade, provenance, time, scheduling or withdrawal',async()=>{
  for(const replacement of [{content:'Changed answer'},{answer:'Changed answer'},{content_grade:'correct'},{item_id:'other'},{occurred_at:current},{scheduling_eligible:1},{help:{content_hint:'false'}},{help:{scheduling_eligible:true}},{help:{answer_revealed:false,unknown:false}}])expect(await repo.execute(amend(replacement),actor)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
  expect(await repo.execute(envelope('retract',{root_record_id:evidenceId,expected_effective_revision:0,reason:'Withdraw graded answer'}),actor)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
  expect(await db.prepare('SELECT COUNT(*) AS n FROM record_corrections').first('n')).toBe(0);
 });
 it('requires session ownership, compatible generation and current effective revision',async()=>{
  expect(await repo.execute(amend({confidence:'sure'}),{...actor,connection_id:'other-connection'})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
  expect(await repo.execute({...amend({confidence:'sure'}),recovery_generation:2},actor)).toMatchObject({ok:false,error:{code:'STALE_GENERATION'}});
  success(await repo.execute(amend({confidence:'think'}),actor));expect(await repo.execute(amend({confidence:'sure'}),actor)).toMatchObject({ok:false,error:{code:'VERSION_CONFLICT'}});
 });
 it('cannot turn an old reissued lease into scheduling or a new independent day through metadata',async()=>{
  await db.prepare('UPDATE evidence SET scheduling_eligible=0 WHERE id=?').bind(evidenceId).run();success(await repo.execute(amend({confidence:'sure',help:{content_hint:false,answer_revealed:false}}),actor));
  expect(await db.prepare('SELECT state FROM mastery_projection WHERE concept_id=? AND level=1').bind(concept).first('state')).toBe('Exposed');expect(await db.prepare('SELECT COUNT(*) AS n FROM review_schedules').first('n')).toBe(0);expect(await db.prepare('SELECT scheduling_eligible FROM evidence').first('scheduling_eligible')).toBe(0);
 });
});
