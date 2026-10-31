import {describe,it,expect} from 'vitest';
import {modelConfigFromBindings,runScheduledAssessment} from '../src/grading/config.ts';
import {runtime,learnerId,grantId} from '../../../tests/runtime.ts';
import {assessmentOverview,assessmentAction} from '../src/control/grading.ts';
import {createRepository} from '../src/data/index.ts';
import {MODEL_SNAPSHOT,PRICE_VERSION} from '../src/grading/model.ts';
const authorized={TEACH_INFERENCE_ENABLED:'true',OPENAI_API_KEY:'private-test-only',TEACH_MODEL_PRICE_POLICY:JSON.stringify({verified:true,modelSnapshot:MODEL_SNAPSHOT,region:'global',priceVersion:PRICE_VERSION,verifiedMonth:'2026-10',timezone:'Asia/Kolkata'})};
describe('production inference configuration',()=>{
 it('defaults to no paid dispatch and requires separately verified private policy',()=>{
  expect(modelConfigFromBindings({}).enabled).toBe(false);
  expect(modelConfigFromBindings({...authorized,TEACH_INFERENCE_ENABLED:'false'}).enabled).toBe(false);
  expect(modelConfigFromBindings({...authorized,TEACH_MODEL_PRICE_POLICY:'bad'}).enabled).toBe(false);
  expect(modelConfigFromBindings(authorized).enabled).toBe(true);
 });
 it('does not touch a database without a complete hosted identity',async()=>{
  expect(await runScheduledAssessment({})).toEqual({status:'disabled',reason:'hosted_configuration_required'});
 });
 it('skips old-generation jobs so restored work cannot starve current assessments',async()=>{
  const instance=await runtime();try{
   const db=instance.env.LEARNING_DB;const repo=createRepository(db);const actor={learner_id:learnerId,connection_id:grantId,generation:1,scopes:['teach:read','teach:organize']};
   const envelope=(operation:string,data:Record<string,unknown>)=>({protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation,reason:'Synthetic scheduler fixture',expected:{},data});
   const concept=await repo.execute(envelope('concept_upsert',{realm:'cs',area:'test',slug:'test',title:'Test',purpose:'Test',origin:'inquiry',anchor_ids:[]}),actor);if(!concept.ok)throw new Error(JSON.stringify(concept));
   const item=await repo.execute(envelope('item_add',{concept_id:concept.data.ids![0],level:1,type:'free_text',stem:'Question',essential_context:'',assessment_form:'production',key_points:[{point_id:'p',criterion:'Criterion',required:true,anchor_ids:[]}],distractors:[],exact_key:null}),actor);if(!item.ok)throw new Error(JSON.stringify(item));
   for(const [job,generation,status] of [['old',1,'running'],['current',2,'queued']] as const)await db.prepare("INSERT INTO grade_jobs(job_id,identity_hash,purpose,item_id,item_version,key_version,capture_set_hash,protocol_version,rules_version,prompt_version,model_snapshot,recovery_generation,job_revision,status,created_at,updated_at,actor_connection_id,result_json) VALUES(?,?,'key_verify',?,1,1,?,1,1,1,?,?,1,?,'2026-10-29T00:00:00Z','2026-10-29T00:00:00Z',?,?)").bind(job,job,item.data.ids![0], 'a'.repeat(64),MODEL_SNAPSHOT,generation,status,grantId,job==='old'?'{}':null).run();
   await instance.ledger.beginMaintenance(1,'generation-two');await instance.ledger.finishMaintenance('generation-two');await db.prepare('UPDATE meta SET generation=2').run();
   const env={LEARNING_DB:db,SECURITY_LEDGER:instance.env.SECURITY_LEDGER,TEACH_ORIGIN:'https://teach.example.com',TEACH_LEARNER_ID:learnerId,GOOGLE_SUBJECT:'owner',OWNER_EMAIL:'owner@example.com',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',ACCESS_ISSUER:'https://team.cloudflareaccess.com',ACCESS_AUDIENCE:'access',CONTROL_SESSION_SECRET:'x'.repeat(64)};
   expect(await runScheduledAssessment(env)).toMatchObject({jobId:'current',status:'pending',reason:'dispatch_disabled'});
   const overview=await assessmentOverview(env,{origin:env.TEACH_ORIGIN,learnerId,googleSubject:'owner',ownerEmail:env.OWNER_EMAIL,googleClientId:'client',googleIssuer:'https://accounts.google.com',accessIssuer:env.ACCESS_ISSUER,accessAudience:'access'});
   expect(overview.jobs).toContainEqual(expect.objectContaining({job_id:'current',status:'pending'}));
   const config={origin:env.TEACH_ORIGIN,learnerId,googleSubject:'owner',ownerEmail:env.OWNER_EMAIL,googleClientId:'client',googleIssuer:'https://accounts.google.com' as const,accessIssuer:env.ACCESS_ISSUER,accessAudience:'access'};
   expect(await assessmentAction(env,config,'cancel',{jobId:'current',generation:2,jobRevision:1})).toMatchObject({status:'skipped',reason:'job_changed_refresh_status'});
   expect(await assessmentAction(env,config,'cancel',{jobId:'current',generation:2,jobRevision:2})).toMatchObject({status:'cancelled'});
   expect(await runScheduledAssessment(env)).toEqual({status:'idle'});
   expect(await runScheduledAssessment({...env,LEARNING_DB:undefined})).toEqual({status:'unavailable',reason:'assessment_runner_unavailable'});
  }finally{await instance.mf.dispose();}
 });

});
