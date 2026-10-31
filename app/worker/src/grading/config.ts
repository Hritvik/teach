import {z} from 'zod';
import {readHostedConfig,type HostedBindings} from '../hosted.ts';
import {createAssessmentRunner,type RunnerResult} from './runner.ts';
import {MODEL_SNAPSHOT,PRICE_VERSION,type ModelDispatchConfig} from './model.ts';
import {BUDGET_PRICE_POLICY} from '../security/budget.ts';
export interface InferenceBindings {readonly TEACH_INFERENCE_ENABLED?:string;readonly OPENAI_API_KEY?:string;readonly TEACH_MODEL_PRICE_POLICY?:string;}
const price=z.strictObject({verified:z.literal(true),modelSnapshot:z.literal(MODEL_SNAPSHOT),region:z.literal('global'),priceVersion:z.literal(PRICE_VERSION),verifiedMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),timezone:z.string().min(1).max(128)});
export function modelConfigFromBindings(env:InferenceBindings):ModelDispatchConfig{
 try{const policy=price.parse(JSON.parse(env.TEACH_MODEL_PRICE_POLICY??''));new Intl.DateTimeFormat('en',{timeZone:policy.timezone});return {enabled:env.TEACH_INFERENCE_ENABLED==='true'&&!!env.OPENAI_API_KEY,apiKey:env.OPENAI_API_KEY??'',pricePolicy:policy};}
 catch{return {enabled:false,apiKey:'',pricePolicy:{verified:false,modelSnapshot:MODEL_SNAPSHOT,region:'global',priceVersion:PRICE_VERSION,verifiedMonth:'',timezone:'UTC'}};}
}
export async function runScheduledAssessment(bindings:unknown):Promise<RunnerResult|{status:'disabled'|'idle'|'unavailable';reason?:string}>{
 let config;try{config=readHostedConfig(bindings);}catch{return {status:'disabled',reason:'hosted_configuration_required'};}
 const env=bindings as HostedBindings&InferenceBindings;
 try{
  const job=await env.LEARNING_DB.prepare("SELECT j.job_id,j.recovery_generation FROM grade_jobs j JOIN items i ON i.id=j.item_id WHERE i.learner_id=? AND j.recovery_generation=(SELECT generation FROM meta WHERE singleton=1) AND (j.status='queued' OR (j.status='running' AND (j.result_json IS NOT NULL OR j.lease_until<=?))) ORDER BY CASE WHEN j.status='running' THEN 0 ELSE 1 END,j.created_at,j.job_id LIMIT 1").bind(config.learnerId,new Date().toISOString()).first<{job_id:string;recovery_generation:number}>();
  if(!job)return {status:'idle'};
  const ledger=env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));
  return await createAssessmentRunner({db:env.LEARNING_DB,ledger,learnerId:config.learnerId,modelConfig:modelConfigFromBindings(env),pricePolicy:BUDGET_PRICE_POLICY}).run({jobId:job.job_id,generation:job.recovery_generation});
 }catch{return {status:'unavailable',reason:'assessment_runner_unavailable'};}
}
