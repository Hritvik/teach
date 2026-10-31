import {describe,it,expect} from 'vitest';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runtime,learnerId,grantId} from './runtime.ts';
import {mcpHandler} from '../app/worker/src/mcp/server.ts';
import {createAssessmentRunner} from '../app/worker/src/grading/runner.ts';
import {MODEL_SNAPSHOT,PRICE_VERSION,modelPromptManifest,type ModelJobRequestV1} from '../app/worker/src/grading/model.ts';
import {BUDGET_PRICE_POLICY} from '../app/worker/src/security/budget.ts';
const actor={learner_id:learnerId,connection_id:grantId,generation:1,scopes:['teach:read','teach:learn','teach:organize']};
const envelope=(operation:string,data:Record<string,unknown>)=>({protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation,reason:'Synthetic full MCP acceptance',expected:{},data});
function structured(value:unknown){if(!value||typeof value!=='object'||!('structuredContent'in value))throw new Error('Structured result required');const result=value.structuredContent as {ok:boolean;data:Record<string,unknown>;meta?:Record<string,unknown>};if(!result.ok)throw new Error(JSON.stringify(result));return result;}
describe('synthetic conversational assessment MCP journey',()=>{
 it('captures sources, verifies a key, grades and disputes one answer, then resumes saved progress after restart',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'teach-assessment-'));let instance=await runtime(directory);let client:Client|undefined;
  try{
   await instance.env.LEARNING_DB.prepare("UPDATE learners SET timezone='UTC' WHERE id=?").bind(learnerId).run();
   const now=new Date();const period=now.toISOString().slice(0,7);expect(await instance.ledger.configureBudgetPolicy({period,timezone:'UTC',modelSnapshot:MODEL_SNAPSHOT,pricePolicy:BUDGET_PRICE_POLICY,authorized:true,verified:true})).toMatchObject({ok:true});
   const passage='A stable request identity prevents retrying an operation as a second operation.';const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(passage))),b=>b.toString(16).padStart(2,'0')).join('');
   const connect=async()=>{
    const current=new Client({name:'teach-assessment-fixture',version:'1'});
    await current.connect(new StreamableHTTPClientTransport(new URL('http://localhost/mcp'),{fetch:async(input,init)=>mcpHandler(instance.env.LEARNING_DB,actor,{budgetStatus:async()=>instance.ledger.budgetStatus(),captureSource:async source=>({canonicalUrl:source.url,sourceVersion:'fixture-v1',locator:source.locator,passage,sourceHash:sha,passageHash:sha,capturedAt:now.toISOString(),provenance:{authority:'public-source-capture',transport:'public-only',etag:null,requestedVersion:source.sourceVersion,mime:'text/plain',redirects:0}})}).fetch(new Request(String(input),init))}));return current;
   };
   client=await connect();const call=async(name:string,data:Record<string,unknown>)=>structured(await client!.callTool({name,arguments:envelope(name,data)}));
   const session=(await call('session_start',{})).data.ids as string[];
   const concept=((await call('concept_upsert',{realm:'cs',area:'retries',slug:'stable-identity',title:'Stable identity',purpose:'Safe retries',origin:'inquiry',anchor_ids:[]})).data.ids as string[])[0]!;
   const anchor=((await call('anchor_capture',{url:'https://docs.example.com/retries.txt',locator:{kind:'lines',start:1,end:1},sourceVersion:'current'})).data.ids as string[])[0]!;
   const item=((await call('item_add',{concept_id:concept,level:1,type:'free_text',stem:'Why should a retry use the same request identity?',essential_context:'',assessment_form:'production',key_points:[{point_id:'identity',criterion:'Stable identity prevents applying the operation a second time',required:true,anchor_ids:[anchor]}],distractors:[],exact_key:null})).data.ids as string[])[0]!;
   const verification=String((await call('item_verify',{item_id:item,item_version:1})).data.job_id);
   expect(structured(await client.callTool({name:'item_status',arguments:{item_id:item}})).data.verification_job).toMatchObject({job_id:verification,status:'queued'});
   let calls=0;
   const runner=()=>createAssessmentRunner({db:instance.env.LEARNING_DB,ledger:instance.ledger,learnerId,pricePolicy:BUDGET_PRICE_POLICY,modelConfig:{enabled:true,apiKey:'synthetic-no-live-call',pricePolicy:{verified:true,modelSnapshot:MODEL_SNAPSHOT,region:'global',priceVersion:PRICE_VERSION,verifiedMonth:period,timezone:'UTC'}}},{invoke:async(request:ModelJobRequestV1)=>{calls++;return {status:'completed',...await modelPromptManifest(request.purpose),usage:{inputTokens:100,outputTokens:50},providerRequestId:'synthetic-response',result:request.purpose==='key_verify'?{points:[{point_id:'identity',verdict:'supported',anchor_ids:[anchor],reason:'The fixture explicitly supports the criterion.'}],exact_key_verdict:null,exact_key_point_ids:[],exact_key_reason:null}:{status:'graded',grade:'correct',points:[{point_id:'identity',result:'met',reason:'The answer explains duplicate prevention.'}],feedback:'A stable identity lets the service recognize a retry.',misconception_hypothesis:null,probe_warranted:false}};}});
   expect(await runner().run({jobId:verification,generation:1})).toMatchObject({status:'succeeded'});
   const offered=await call('item_next',{concept_id:concept,purpose:'lesson',session_id:session[0]});expect(JSON.stringify(offered.data)).not.toContain('key_points');
   const attempt=String(offered.data.attempt_id);
   const accepted=await call('answer',{attempt_id:attempt,item_id:item,item_version:1,answer:{kind:'free_text',text:'The server recognizes it as the same operation rather than applying it twice.'},confidence:'sure',help:{}});expect(accepted.data.state).toBe('pending');
   const job=String(accepted.data.job_id);expect(await runner().run({jobId:job,generation:1})).toMatchObject({status:'succeeded'});
   expect(structured(await client.callTool({name:'attempt_status',arguments:{attempt_id:attempt}})).data.assessment).toMatchObject({grade:'correct',provisional:false});
   const dispute=await call('dispute_answer',{attempt_id:attempt,expected_effective_revision:0,reason:'Check whether the alternative wording satisfies the criterion.'});
   expect(await runner().run({jobId:String(dispute.data.job_id),generation:1})).toMatchObject({status:'succeeded'});
   expect(calls).toBe(3);await client.close();client=undefined;await instance.mf.dispose();instance=await runtime(directory);client=await connect();
   const mastery=structured(await client.callTool({name:'mastery',arguments:{concept_id:concept,level:1}}));expect(mastery.data.rows).toEqual([expect.objectContaining({state:'Solid',provisional:0})]);
   expect(structured(await client.callTool({name:'attempt_status',arguments:{attempt_id:attempt}})).data.assessment).toMatchObject({grade:'correct',effective_revision:2});
   expect(structured(await client.callTool({name:'budget_status',arguments:{}})).data.budget).toMatchObject({ok:true,budget:{settledMicroUSD:900}});
   expect(await instance.env.LEARNING_DB.prepare('SELECT COUNT(*) AS n FROM evidence WHERE attempt_id=?').bind(attempt).first('n')).toBe(1);
   expect(await instance.env.LEARNING_DB.prepare('SELECT COUNT(*) AS n FROM review_schedules WHERE concept_id=?').bind(concept).first('n')).toBe(1);
  }finally{await client?.close();await instance.mf.dispose();await rm(directory,{recursive:true,force:true});}
 },60000);
});
