import {runScheduledAssessment} from './grading/config.ts';
import { readHostedConfig, hostedMcp } from './hosted.ts';
import type { HostedOAuthEnv } from './auth/oauth.ts';
import type { HostedBindings } from './hosted.ts';
interface ProductionEnv extends HostedOAuthEnv, HostedBindings { readonly CONTROL_SESSION_SECRET:string; }
/** Missing private configuration fails closed; the development identity is never imported here. */
export function createProductionHandler(releaseMode:'capture'|'full'='full'){return { async fetch(request:Request,bindings:unknown,ctx?:ExecutionContext):Promise<Response>{
 let config;try{config=readHostedConfig(bindings);}catch{return Response.json({error:'Hosted access is not configured'},{status:503});}
 const env=bindings as ProductionEnv; const url=new URL(request.url);
 if(url.origin!==config.origin)return new Response('Origin denied',{status:403});
 if(url.pathname==='/health')return Response.json({status:'ok'});
 try{
 if(url.pathname==='/control'||url.pathname.startsWith('/control/')){
  if(releaseMode==='capture'&&!['/control','/control/','/control/session','/control/connections','/control/revoke'].includes(url.pathname))return new Response('Not available in the capture release',{status:404});
  const {createControlHandler}=await import('./control/index.ts');return await createControlHandler(config,{},releaseMode).fetch(request,env);
 }
 if(url.pathname==='/register'&&request.method==='POST'){
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return new Response('Registration unavailable',{status:503});
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
  const ipHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  const ledger=env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));const rate=await ledger.rateRegistration(ipHash);
  if(!rate.ok)return Response.json({error:'Registration rate exceeded'},{status:429,headers:{'Retry-After':String('retryAfterSeconds' in rate?rate.retryAfterSeconds:3600)}});
 }
 const {createHostedOAuth}=await import('./auth/oauth.ts');
 const provider=createHostedOAuth(config,hostedMcp(config,releaseMode),{onFailureStage:stage=>console.warn('Teach authorization refused: '+stage),onVerifiedOwner:async ownerEnv=>{
  const authority=ownerEnv.SECURITY_LEDGER.get(ownerEnv.SECURITY_LEDGER.idFromName(config.learnerId));
  const configured=await authority.configureLearner(config.learnerId);if(!configured.ok)throw new Error('Learner authority unavailable');
 }});
 if(!ctx)return new Response('Execution context unavailable',{status:503});
 return await provider.fetch(request,env,ctx);
 }catch{return Response.json({error:'Hosted access unavailable'},{status:503});}
}, async scheduled(_controller:ScheduledController,bindings:unknown,ctx:ExecutionContext):Promise<void>{
 if(releaseMode==='full')ctx.waitUntil(runScheduledAssessment(bindings));
} };}
export default createProductionHandler();
