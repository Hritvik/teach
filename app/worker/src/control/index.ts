import {assessmentOverview,assessmentAction,gradingActionSchema,gradingPage} from './grading.ts';
import { z } from 'zod';
import type { HostedBindings, HostedConfig } from '../hosted.ts';
import { readJson } from '../hosted.ts';
import { verifyAccessIdentity, type TrustedJwks } from '../auth/identity.ts';
import { mergeReview,mergeConfirmed,mergeOutcome } from './views.ts';
import { newSession,readSession } from './session.ts';
import { proposalSchema,executionSchema,validTargets,mergePreview,actionHash,executeMerge } from './merge.ts';
interface ControlEnv extends HostedBindings { readonly CONTROL_SESSION_SECRET:string; }
interface Dependencies { readonly fetch?:typeof fetch;readonly now?:()=>number;readonly verifyIdentity?:typeof verifyAccessIdentity; }
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>`&#${char.charCodeAt(0)};`);
async function readForm(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new SyntaxError('Form required');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>65536){await reader.cancel();throw new RangeError('Body too large');}chunks.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
async function trustedKeys(fetcher:typeof fetch,url:string):Promise<TrustedJwks>{
 const response=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!response.ok||!response.body)throw new Error('Access keys unavailable');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>65536){await reader.cancel();throw new Error('Access keys too large');}chunks.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||typeof value!=='object'||!('keys'in value)||!Array.isArray(value.keys)||value.keys.length>32)throw new Error('Access keys unavailable');return value as TrustedJwks;
}
function headers(){return new Headers({'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});}
export function createControlHandler(config:HostedConfig,deps:Dependencies={},releaseMode:'capture'|'full'='full'){return {async fetch(request:Request,env:ControlEnv):Promise<Response>{
 const responseHeaders=headers();const html=(value:string,status=200)=>{responseHeaders.set('Content-Type','text/html; charset=utf-8');return new Response(value,{status,headers:responseHeaders});};const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:responseHeaders});
 const url=new URL(request.url);if(releaseMode==='capture'&&!['/control','/control/','/control/session','/control/connections','/control/revoke'].includes(url.pathname))return reply({error:'Not available in the capture release'},404);if(url.origin!==config.origin)return reply({error:'Origin denied'},403);
 const assertion=request.headers.get('Cf-Access-Jwt-Assertion');if(!assertion)return reply({error:'Access sign-in required'},401);
 let identity;const now=(deps.now??Date.now)();
 try{const jwks=await trustedKeys(deps.fetch??fetch,config.accessIssuer+'/cdn-cgi/access/certs');identity=await (deps.verifyIdentity??verifyAccessIdentity)(assertion,{jwks,issuer:config.accessIssuer,audience:config.accessAudience,email:config.ownerEmail,learnerId:config.learnerId,now:Math.floor(now/1000)});}
 catch{return reply({error:'Access sign-in required'},401);}
 if(identity.learnerId!==config.learnerId||identity.provider!=='access')return reply({error:'Access sign-in required'},401);
 const ledger=env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));
 try{
 let session=await readSession(request.headers.get('Cookie'),env.CONTROL_SESSION_SECRET,identity.subject,now);
 if(request.method==='GET'){
  if(!session){const created=await newSession(env.CONTROL_SESSION_SECRET,identity.subject,now);session=created.session;responseHeaders.set('Set-Cookie',created.cookie);}
  if(url.pathname==='/control/grading')return html(gradingPage(await assessmentOverview(env,config),session.csrf));
  if(url.pathname==='/control/grading/retry'||url.pathname==='/control/grading/cancel')return reply({error:'POST required'},405);
  if(url.pathname==='/control/session')return reply({csrf:session.csrf,expiresAt:new Date(session.exp).toISOString()});
  if(['/control/backups','/control/restore','/control/deletion'].includes(url.pathname))return reply({error:'Unavailable until recovery services are implemented'},503);
  if(url.pathname==='/control/merge'||url.pathname==='/control/merge-preview'){
   const preview=await mergePreview(env.LEARNING_DB,config,url.searchParams.get('source_id')??'',url.searchParams.get('target_id')??'');if(!preview)return reply({error:'Select two active canonical concepts'},400);return url.pathname==='/control/merge'?html(mergeReview({action:preview.action,generation:preview.generation,expected:preview.expected},preview.concepts,preview.consequences,session.csrf)):reply(preview);
  }
  if(url.pathname==='/control/revoke'||url.pathname==='/control/approve'||url.pathname==='/control/merge')return reply({error:'POST required'},405);
  if(url.pathname!=='/control'&&url.pathname!=='/control/'&&url.pathname!=='/control/connections')return reply({error:'Not found'},404);
  const result=await ledger.listConnections();if(!result.ok)return reply(result,503);
  if(url.pathname==='/control/connections')return reply(result);
  const connections=result.connections.map(connection=>`<li>${escape(connection.clientId??connection.grantId)} — ${escape(connection.status)} <form method="post" action="/control/revoke"><input type="hidden" name="csrf" value="${escape(session!.csrf)}"><input type="hidden" name="grantId" value="${escape(connection.grantId)}"><button>Revoke connection</button></form></li>`).join('');
  if(releaseMode==='capture')return html(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Teach connections</title><main><h1>Teach connections</h1><p>This release saves learning inquiries, concepts and progress. Assessment and spaced reviews are deferred.</p><ul>${connections}</ul></main></html>`);
  responseHeaders.set('Content-Type','text/html; charset=utf-8');return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Teach controls</title><main><h1>Teach controls</h1><p><a href="/control/grading">Inference budget and pending assessments</a></p><h2>Connections</h2><ul>${connections}</ul><h2>Merge concepts</h2><p>Review both concepts and their current versions before approving a merge.</p><form method="get" action="/control/merge"><p><label>Source concept ID <input name="source_id" required></label></p><p><label>Target concept ID <input name="target_id" required></label></p><button type="submit">Review merge</button></form><p>Deletion and recovery controls are not available yet.</p></main></html>`,{headers:responseHeaders});
 }
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==config.origin||!session)return reply({error:'Browser confirmation required'},403);
 if(!['/control/revoke','/control/approve','/control/merge','/control/grading/retry','/control/grading/cancel'].includes(url.pathname))return reply({error:'Not found'},404);
 let data:unknown;let browserForm=false;let csrf=request.headers.get('X-CSRF-Token');const content=request.headers.get('Content-Type')?.split(';')[0]?.trim();
 if(content==='application/json')data=await readJson(request);
 else if(content==='application/x-www-form-urlencoded'){
  const form=await readForm(request);const field=url.pathname==='/control/revoke'?'grantId':'payload';if([...form.keys()].some(key=>!['csrf',field].includes(key))||form.getAll('csrf').length!==1||form.getAll(field).length!==1)return reply({error:'Invalid form'},400);csrf=form.get('csrf');data=field==='grantId'?{grantId:form.get('grantId')}:JSON.parse(form.get('payload')!);browserForm=true;
 }else return reply({error:'JSON or form required'},415);
 if(csrf!==session.csrf)return reply({error:'Browser confirmation required'},403);
 const rate=await ledger.rateControl(session.id);if(!rate.ok){responseHeaders.set('Retry-After',String(rate.retryAfterSeconds??60));return reply({error:'Control request rate exceeded'},429);}
 if(url.pathname==='/control/grading/retry'||url.pathname==='/control/grading/cancel'){
  const parsed=gradingActionSchema.safeParse(data);if(!parsed.success)return reply({error:'Invalid assessment action'},400);
  const result=await assessmentAction(env,config,url.pathname.endsWith('/retry')?'retry':'cancel',parsed.data);
  return browserForm?html(gradingPage(await assessmentOverview(env,config),session.csrf)):reply(result);
 }
 if(url.pathname==='/control/revoke'){
  const parsed=z.strictObject({grantId:id}).safeParse(data);if(!parsed.success)return reply({error:'Invalid connection'},400);
  const result=await ledger.revoke(parsed.data.grantId);return reply(result,result.ok?200:409);
 }
 if(url.pathname==='/control/merge'){
  const parsed=executionSchema.safeParse(data);if(!parsed.success||!validTargets(parsed.data))return reply({error:'Invalid approved merge'},400);
  try{const result=await executeMerge(env,config,parsed.data);const uncertain=!result.ok&&(('retryable'in result.error&&result.error.retryable===true)||result.error.code==='DEPENDENCY_UNAVAILABLE');const status=result.ok?200:uncertain?503:409;const message=result.ok?'The merge is saved. Learning history has been retained.':uncertain?'The save could not be confirmed. Check or retry this same request.':'The merge was not saved. Review the proposal if a version or approval changed.';return browserForm?html(mergeOutcome(result.ok,session.csrf,parsed.data,message),status):reply(result,status);}
  catch{if(browserForm)return html(mergeOutcome(false,session.csrf,parsed.data,'The save could not be confirmed. Check or retry this same request.'),503);throw new Error('Merge unavailable');}
 }
 const parsed=proposalSchema.safeParse(data);if(!parsed.success||!validTargets(parsed.data))return reply({error:'Invalid action proposal'},400);
 const proposal=parsed.data;const preview=await mergePreview(env.LEARNING_DB,config,proposal.action.source_id,proposal.action.target_id);
 if(!preview||preview.generation!==proposal.generation||Object.entries(preview.expected).some(([key,value])=>proposal.expected[key]!==value))return reply({error:'Proposal versions changed; review the current records'},409);
 const hash=await actionHash(config,proposal);
 const result=await ledger.createApproval({approvalId:crypto.randomUUID(),actionHash:hash,targetVersions:proposal.expected,generation:proposal.generation});if(browserForm&&result.ok)return html(mergeConfirmed(proposal,preview.concepts,preview.consequences,session.csrf,result.approvalId));return reply(result.ok?{...result,actionHash:hash}:result,result.ok?200:409);
 }catch(error){const status=error instanceof RangeError?413:error instanceof SyntaxError?400:503;return reply({error:status===413?'Body too large':status===400?'Invalid request':'Control action unavailable'},status);}
}};}
