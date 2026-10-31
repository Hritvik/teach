import {z} from 'zod';
import type {HostedBindings,HostedConfig} from '../hosted.ts';
import {modelConfigFromBindings,type InferenceBindings} from '../grading/config.ts';
import {createAssessmentRunner} from '../grading/runner.ts';
import {BUDGET_PRICE_POLICY} from '../security/budget.ts';
import {page,actionForm,escapeHtml} from './views.ts';
export const gradingActionSchema=z.strictObject({jobId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),generation:z.number().int().positive(),jobRevision:z.number().int().positive()});
export async function assessmentOverview(env:HostedBindings,config:HostedConfig){
 const ledger=env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));
 const budget=await ledger.budgetStatus();
 const meta=await env.LEARNING_DB.prepare('SELECT generation FROM meta WHERE singleton=1').first<{generation:number}>();
 const jobs=await env.LEARNING_DB.prepare("SELECT j.job_id,j.job_revision,j.recovery_generation,j.purpose,j.status,j.pending_reason FROM grade_jobs j JOIN items i ON i.id=j.item_id WHERE i.learner_id=? AND j.status IN ('queued','running','pending') ORDER BY j.created_at,j.job_id LIMIT 100").bind(config.learnerId).all<{job_id:string;job_revision:number;recovery_generation:number;purpose:string;status:string;pending_reason:string|null}>();
 return {generation:meta?.generation??0,budget,jobs:jobs.results};
}
export function gradingPage(overview:Awaited<ReturnType<typeof assessmentOverview>>,csrf:string){
 const budget=overview.budget.ok?`Reserved ${(overview.budget.budget.reservedMicroUSD/1000000).toFixed(2)} USD; settled ${(overview.budget.budget.settledMicroUSD/1000000).toFixed(2)} USD; remaining ${(overview.budget.budget.remainingMicroUSD/1000000).toFixed(2)} USD.`:'Paid dispatch is disabled or its budget is unavailable.';
 const jobs=overview.jobs.map(job=>`<li><p>${escapeHtml(job.purpose)}: ${escapeHtml(job.status)} — ${escapeHtml(job.pending_reason??'awaiting completion')}</p>`+actionForm('/control/grading/retry',csrf,{jobId:job.job_id,generation:job.recovery_generation,jobRevision:job.job_revision},'Retry this job')+actionForm('/control/grading/cancel',csrf,{jobId:job.job_id,generation:job.recovery_generation,jobRevision:job.job_revision},'Cancel this job')+'</li>').join('');
 return page('Inference budget and pending assessments',`<h2>Inference budget</h2><p>${escapeHtml(budget)}</p><p>The application limit is 5 USD per learner-local month. Unknown charges remain reserved. A retry may incur another charge; at most two physical calls are admitted per job. These controls cannot enable inference or change the cap.</p><ul>${jobs||'<li>No pending assessments.</li>'}</ul>`);
}
export async function assessmentAction(env:HostedBindings&InferenceBindings,config:HostedConfig,action:'retry'|'cancel',input:z.infer<typeof gradingActionSchema>){
 const job=await env.LEARNING_DB.prepare('SELECT j.job_revision,j.recovery_generation FROM grade_jobs j JOIN items i ON i.id=j.item_id WHERE i.learner_id=? AND j.job_id=?').bind(config.learnerId,input.jobId).first<{job_revision:number;recovery_generation:number}>();
 if(!job||job.job_revision!==input.jobRevision||job.recovery_generation!==input.generation)return {status:'skipped' as const,jobId:input.jobId,reason:'job_changed_refresh_status'};
 const ledger=env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));
 const runner=createAssessmentRunner({db:env.LEARNING_DB,ledger,learnerId:config.learnerId,modelConfig:modelConfigFromBindings(env),pricePolicy:BUDGET_PRICE_POLICY});
 return action==='retry'?runner.retry({jobId:input.jobId,generation:input.generation,expectedJobRevision:input.jobRevision,approved:true}):runner.cancel({jobId:input.jobId,generation:input.generation,expectedJobRevision:input.jobRevision});
}
