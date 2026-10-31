import { z } from 'zod';
import {parseSourceOrigins,workerSourceCapture} from './grading/source.ts';
import { mcpHandler, writeTools } from './mcp/server.ts';
import type { SecurityLedger } from './security/index.ts';
export interface HostedConfig {
 readonly origin:string; readonly learnerId:string; readonly googleSubject:string; readonly ownerEmail:string;
 readonly googleClientId:string; readonly googleIssuer:'https://accounts.google.com'; readonly accessIssuer:string; readonly accessAudience:string;
}
export interface HostedBindings { readonly LEARNING_DB:D1Database; readonly SECURITY_LEDGER:DurableObjectNamespace<SecurityLedger>; readonly TEACH_SOURCE_ORIGINS?:string; }
export interface HostedContext { readonly props:{readonly learnerId?:string;readonly connectionId?:string}; readonly auth:{readonly audience:string;readonly scope:readonly string[]}; }
const settings=z.object({TEACH_ORIGIN:z.url(),TEACH_LEARNER_ID:z.string().regex(/^l_[0-9a-f-]{36}$/i),GOOGLE_SUBJECT:z.string().min(1).max(255),OWNER_EMAIL:z.email(),GOOGLE_CLIENT_ID:z.string().min(1).max(512),GOOGLE_CLIENT_SECRET:z.string().min(1),ACCESS_ISSUER:z.url(),ACCESS_AUDIENCE:z.string().min(1),CONTROL_SESSION_SECRET:z.string().min(64)});
export function readHostedConfig(env:unknown):HostedConfig {
 if(!env||typeof env!=='object'||Object.keys(env).some(key=>key.startsWith(['TEACH','DEV',''].join('_')))) throw new Error('Hosted configuration required');
 const value=settings.parse(env); const origin=new URL(value.TEACH_ORIGIN);const access=new URL(value.ACCESS_ISSUER);
 if(origin.protocol!=='https:'||origin.origin!==value.TEACH_ORIGIN||['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||access.protocol!=='https:'||access.origin!==value.ACCESS_ISSUER||!access.hostname.endsWith('.cloudflareaccess.com'))throw new Error('Invalid hosted origin');
 return {origin:origin.origin,learnerId:value.TEACH_LEARNER_ID,googleSubject:value.GOOGLE_SUBJECT,ownerEmail:value.OWNER_EMAIL,googleClientId:value.GOOGLE_CLIENT_ID,googleIssuer:'https://accounts.google.com',accessIssuer:access.origin,accessAudience:value.ACCESS_AUDIENCE};
}
export async function readJson(request:Request):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new SyntaxError('JSON required');
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>65536){await reader.cancel();throw new RangeError('Body too large');}chunks.push(next.value);}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
 }finally{reader.releaseLock();}
}
function callInfo(body:unknown){
 const call=z.object({method:z.literal('tools/call'),params:z.object({name:z.string(),arguments:z.record(z.string(),z.unknown()).optional()})}).safeParse(body);
 if(!call.success||!writeTools.includes(call.data.params.name as typeof writeTools[number]))return {scopes:['teach:read'],generation:undefined};
 const learn=['session_start','session_end','log_inquiry','record','amend','retract','item_next','answer','dispute_answer','submit_to_inbox','resolve_inbox_entry'].includes(call.data.params.name);
 const generation=call.data.params.arguments?.recovery_generation;
 return {scopes:['teach:read',learn?'teach:learn':'teach:organize'],generation:typeof generation==='number'?generation:undefined};
}
export function hostedMcp(config:HostedConfig,releaseMode:'capture'|'full'='full'){return {async fetch(request:Request,env:HostedBindings,ctx:HostedContext):Promise<Response>{
 const url=new URL(request.url);if(url.origin!==config.origin||url.pathname!=='/mcp')return new Response('Not found',{status:404});
 if(!ctx.props?.connectionId||ctx.props.learnerId!==config.learnerId||ctx.auth?.audience!==config.origin+'/mcp'||!ctx.auth.scope.includes('teach:read'))return new Response('Unauthorised',{status:401});
 if(!['POST','GET','DELETE'].includes(request.method))return new Response('Method not allowed',{status:405});
 const origin=request.headers.get('Origin');if(origin&&origin!==config.origin)return new Response('Origin denied',{status:403});
 if(request.method==='POST'&&request.headers.get('Content-Type')?.split(';')[0]?.trim()!=='application/json')return new Response('JSON required',{status:415});
 let body:unknown;try{body=request.method==='POST'?await readJson(request):undefined;}catch(error){return new Response(error instanceof RangeError?'Body too large':'Invalid JSON',{status:error instanceof RangeError?413:400});}
 try{
 const ledger=env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));const info=callInfo(body);
 if(!info.scopes.every(scope=>ctx.auth.scope.includes(scope)))return new Response('Insufficient scope',{status:403});
 const admitted=await ledger.admit(ctx.props.connectionId,info.scopes,info.generation);
 if(!admitted.ok)return Response.json(admitted,{status:admitted.error.code==='UNAUTHORISED'?401:403});
 const rate=await ledger.rateLimit(ctx.props.connectionId);if(!rate.ok)return Response.json({error:'Request rate exceeded'},{status:429,headers:{'Retry-After':String('retryAfterSeconds' in rate?rate.retryAfterSeconds:60)}});
 const effective={...admitted.admission,scopes:admitted.admission.scopes.filter(scope=>ctx.auth.scope.includes(scope))};
 const captureSource=releaseMode==='full'&&env.TEACH_SOURCE_ORIGINS?workerSourceCapture(parseSourceOrigins(env.TEACH_SOURCE_ORIGINS)):undefined;
 return await mcpHandler(env.LEARNING_DB,effective,{releaseMode,...(captureSource?{captureSource}:{}),budgetStatus:async()=>ledger.budgetStatus()}).fetch(request,{...(body===undefined?{}:{parsedBody:body})});
 }catch{return Response.json({error:'Tracker unavailable; no save acknowledgement'},{status:503});}
}};}
