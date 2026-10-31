import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {runtime,learnerId,grantId} from '../../../tests/runtime.ts';
import {createRepository,type Admission} from '../src/data/index.ts';
let instance:Awaited<ReturnType<typeof runtime>>;
const actor:Admission={learner_id:learnerId,connection_id:grantId,generation:1,scopes:['teach:read','teach:learn','teach:organize']};
const id=(prefix:string)=>prefix+'_'+crypto.randomUUID();
beforeAll(async()=>{instance=await runtime();});afterAll(async()=>{await instance?.mf.dispose();});
describe('assessment status feedback after reconnect',()=>{
 it('returns deterministic effective grade and evidence identity, and hides disputed grades without enqueueing',async()=>{
  const db=instance.env.LEARNING_DB;const concept=id('c'),session=id('s'),item=id('i'),verification=id('iv'),attempt=id('a'),evidence=id('e');
  const now='2026-10-29T00:00:00.000Z';
  await db.batch([
   db.prepare("INSERT INTO concepts(id,learner_id,realm,area,slug,title,purpose,origin) VALUES(?,?,'cs','values','boolean','Boolean','Reason','inquiry')").bind(concept,learnerId),
   db.prepare("INSERT INTO sessions(id,learner_id,started_at) VALUES(?,?,?)").bind(session,learnerId,now),
   db.prepare("INSERT INTO items(id,learner_id,concept_id,level,type,state,current_verification_id) VALUES(?,?,?,1,'predict_scalar','verified',?)").bind(item,learnerId,concept,verification),
   db.prepare("INSERT INTO item_versions VALUES(?,1,'A scalar','{}','production','[]','[]',?,?)").bind(item,JSON.stringify({kind:'predict_scalar',expected:true}),'a'.repeat(64)),
   db.prepare("INSERT INTO item_verifications(id,learner_id,item_id,item_version,capture_set_hash,prompt_version,state,result_json,verifier_provenance_json,seq,result_job_id) VALUES(?,?,?,1,?,1,'supported','{}','{}',1,'fixture')").bind(verification,learnerId,item,'b'.repeat(64)),
   db.prepare("INSERT INTO attempts(id,learner_id,session_id,item_id,item_version,answer,confidence,help_json,occurred_at,accepted_at,timezone,local_day,state,verification_id) VALUES(?,?,?,?,1,'true','sure','{}',?,?,'Asia/Kolkata','2026-10-29','graded',?)").bind(attempt,learnerId,session,item,now,now,verification),
   db.prepare("INSERT INTO evidence(id,learner_id,seq,concept_id,level,session_id,attempt_id,kind,content_grade,strength,confidence,help_json,occurred_at,accepted_at,timezone,local_day,source_json,rules_version) VALUES(?,?,2,?,1,?,?,'answer','correct','strong','sure','{}',?,?,'Asia/Kolkata','2026-10-29','{}',1)").bind(evidence,learnerId,concept,session,attempt,now,now),
  ]);
  const repo=createRepository(db);
  const read=()=>repo.read('attempt_status',{attempt_id:attempt},actor);
  expect(await read()).toMatchObject({ok:true,data:{state:'graded',assessment:{evidence_id:evidence,grade:'correct',effective_revision:0,provisional:false}}});
  await db.prepare("INSERT INTO record_corrections(id,learner_id,root_record_id,expected_effective_revision,effective_revision,action,replacement_json,reason,seq) VALUES(?,?,?,0,1,'dispute','{}','Check this grade',3)").bind(id('rc'),learnerId,evidence).run();
  await db.prepare("UPDATE attempts SET state='disputed' WHERE id=?").bind(attempt).run();
  expect(await read()).toMatchObject({ok:true,data:{state:'disputed',assessment:{evidence_id:evidence,grade:null,effective_revision:1,provisional:true}}});
  expect(await db.prepare('SELECT COUNT(*) AS n FROM grade_jobs').first('n')).toBe(0);
 });
});
