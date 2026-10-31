import { describe,it,expect,vi } from 'vitest';
import { newSession,readSession } from '../src/control/session.ts';
import { runtime,learnerId,grantId } from '../../../tests/runtime.ts';
import { createRepository } from '../src/data/index.ts';
import { createControlHandler } from '../src/control/index.ts';
const config={origin:'https://teach.example.com',learnerId:'l_owner',googleSubject:'google-sub',ownerEmail:'owner@example.com',googleClientId:'google-client',googleIssuer:'https://accounts.google.com' as const,accessIssuer:'https://team.cloudflareaccess.com',accessAudience:'access-app'};
function setup(){
 const ledger={listConnections:vi.fn(async()=>({ok:true,connections:[{grantId:'grant1',clientId:'client',scopes:['teach:read'],status:'active'}]})),revoke:vi.fn(async()=>({ok:true,generation:1,mode:'active'})),rateControl:vi.fn(async()=>({ok:true})),createApproval:vi.fn(async()=>({ok:true,approvalId:'approval',expiresAt:'2026-10-29T10:00:00Z'}))};
 const verifyIdentity=vi.fn(async()=>({learnerId:'l_owner',issuer:config.accessIssuer,subject:'access-sub',email:config.ownerEmail,provider:'access' as const}));
 const fetcher=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json({keys:[]}));
 const db={prepare:()=>({first:async()=>({generation:1}),bind:()=>({first:async()=>({generation:1}),all:async()=>({results:[{id:'c_source',title:'Source <script>alert(1)</script>',version:2,merged_into:null,archived:0},{id:'c_target',title:'Target',version:3,merged_into:null,archived:0}]})})})};
 const env={LEARNING_DB:db,SECURITY_LEDGER:{idFromName:()=> 'id',get:()=>ledger},CONTROL_SESSION_SECRET:'x'.repeat(64)} as never;
 const handler=createControlHandler(config,{fetch:fetcher as typeof fetch,verifyIdentity,now:()=>1800000000000});
 return {ledger,verifyIdentity,fetcher,env,handler};
}
function req(path='/control',options:RequestInit={}){return new Request(config.origin+path,{...options,headers:{'Cf-Access-Jwt-Assertion':'signed-access',...Object.fromEntries(new Headers(options.headers).entries())}});}
async function session(f:ReturnType<typeof setup>){const response=await f.handler.fetch(req('/control/session'),f.env); const data=await response.json() as {csrf:string};return {csrf:data.csrf,cookie:response.headers.get('Set-Cookie')!.split(';')[0]!};}
const post=(path:string,cookie:string,csrf:string,data:unknown,origin=config.origin)=>req(path,{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':csrf,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
describe('trusted learner control boundary',()=>{
 it('requires Access identity on every request and never accepts MCP bearer credentials',async()=>{
  const f=setup();expect((await f.handler.fetch(new Request(config.origin+'/control',{headers:{Authorization:'Bearer mcp'}}),f.env)).status).toBe(401);
  const s=await session(f);f.verifyIdentity.mockRejectedValueOnce(new Error('private verification detail'));
  const response=await f.handler.fetch(post('/control/revoke',s.cookie,s.csrf,{grantId:'grant1'}),f.env);expect(response.status).toBe(401);expect(await response.text()).not.toContain('private verification detail');expect(f.ledger.revoke).not.toHaveBeenCalled();
 });
 it('fetches keys only from configured issuer and creates a protected session without writes',async()=>{
  const f=setup();const response=await f.handler.fetch(req(),f.env);expect(response.status).toBe(200);expect(response.headers.get('Set-Cookie')).toContain('HttpOnly; Secure; SameSite=Strict');expect(response.headers.get('Cache-Control')).toBe('no-store');expect(await response.text()).toContain('Connections');
  expect(f.fetcher.mock.calls[0]?.[0]).toBe(config.accessIssuer+'/cdn-cgi/access/certs');expect(f.ledger.revoke).not.toHaveBeenCalled();
 });
 it('lists connections but GET revoke never changes authority',async()=>{
  const f=setup();expect((await f.handler.fetch(req('/control/connections'),f.env)).status).toBe(200);expect((await f.handler.fetch(req('/control/revoke'),f.env)).status).toBe(405);expect(f.ledger.revoke).not.toHaveBeenCalled();
 });
 it('requires exact origin, signed session and session CSRF before revoke',async()=>{
  const f=setup();const s=await session(f);
  for(const [cookie,csrf,origin] of [[s.cookie,s.csrf,'https://evil.example'],[s.cookie,'forged',config.origin],['forged',s.csrf,config.origin]]) expect((await f.handler.fetch(post('/control/revoke',cookie!,csrf!,{grantId:'grant1'},origin!),f.env)).status).toBe(403);
  expect(f.ledger.revoke).not.toHaveBeenCalled();
  expect((await f.handler.fetch(post('/control/revoke',s.cookie,s.csrf,{grantId:'grant1'}),f.env)).status).toBe(200);expect(f.ledger.revoke).toHaveBeenCalledWith('grant1');
 });
 it('binds approvals to canonical merge content, generation and versions',async()=>{
  const f=setup();const s=await session(f);const action={operation:'concept_merge',source_id:'c_source',target_id:'c_target'};
  const response=await f.handler.fetch(post('/control/approve',s.cookie,s.csrf,{action,generation:1,expected:{c_source:2,c_target:3}}),f.env);expect(response.status).toBe(200);expect(f.ledger.createApproval).toHaveBeenCalledWith(expect.objectContaining({generation:1,targetVersions:{c_source:2,c_target:3},actionHash:expect.stringMatching(/^[a-f0-9]{64}$/)}));
  expect((await f.handler.fetch(post('/control/approve',s.cookie,s.csrf,{action:{operation:'restore',approved:true},generation:1,expected:{}}),f.env)).status).toBe(400);
 });
 it('does not execute unimplemented deletion/backup/restore and applies control rates',async()=>{
  const f=setup();for(const route of ['/control/backups','/control/restore','/control/deletion'])expect((await f.handler.fetch(req(route),f.env)).status).toBe(503);
  const s=await session(f);f.ledger.rateControl.mockResolvedValueOnce({ok:false,retryAfterSeconds:60} as never);expect((await f.handler.fetch(post('/control/revoke',s.cookie,s.csrf,{grantId:'grant1'}),f.env)).status).toBe(429);expect(f.ledger.revoke).not.toHaveBeenCalled();
 });
 it('supports browser forms but rejects duplicate fields and bounded malformed bodies',async()=>{
  const f=setup();const s=await session(f);const headers={Cookie:s.cookie,Origin:config.origin,'Content-Type':'application/x-www-form-urlencoded'};
  const body=new URLSearchParams({csrf:s.csrf,grantId:'grant1'}).toString();
  expect((await f.handler.fetch(req('/control/revoke',{method:'POST',headers,body}),f.env)).status).toBe(200);
  expect((await f.handler.fetch(req('/control/revoke',{method:'POST',headers,body:body+'&grantId=grant2'}),f.env)).status).toBe(400);
  expect((await f.handler.fetch(req('/control/revoke',{method:'POST',headers,body:'a'.repeat(65537)}),f.env)).status).toBe(413);
  expect((await f.handler.fetch(req('/control/revoke',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{bad'}),f.env)).status).toBe(400);
 });
 it('rejects altered, expired and cross-subject sessions',async()=>{
  const created=await newSession('x'.repeat(64),'subject-a',1000);const cookie=created.cookie.split(';')[0]!;
  expect(await readSession(cookie,'x'.repeat(64),'subject-a',1001)).toMatchObject({sub:'subject-a'});
  expect(await readSession(cookie,'x'.repeat(64),'subject-b',1001)).toBeNull();
  expect(await readSession(cookie,'x'.repeat(64),'subject-a',1801000)).toBeNull();
  expect(await readSession(cookie+'a','x'.repeat(64),'subject-a',1001)).toBeNull();
  expect(await readSession(cookie,'y'.repeat(64),'subject-a',1001)).toBeNull();
 });
 it('fails closed on trusted key and ledger failures with no private errors',async()=>{
  const f=setup();f.fetcher.mockResolvedValueOnce(new Response('private upstream',{status:500}));expect((await f.handler.fetch(req(),f.env)).status).toBe(401);
  f.fetcher.mockResolvedValueOnce(Response.json({keys:[],jku:'https://evil.example'}));f.ledger.listConnections.mockResolvedValueOnce({ok:false,error:{code:'UNAUTHORISED'}} as never);expect((await f.handler.fetch(req(),f.env)).status).toBe(503);
  const s=await session(f);f.ledger.revoke.mockRejectedValueOnce(new Error('secret database error'));const response=await f.handler.fetch(post('/control/revoke',s.cookie,s.csrf,{grantId:'grant1'}),f.env);expect(response.status).toBe(503);expect(await response.text()).not.toContain('secret');
 });

 it('executes a confirmed merge against real D1 and reconciles the same request after a lost response',async()=>{
  const instance=await runtime();try{
   const cfg={...config,learnerId};const env={...instance.env,CONTROL_SESSION_SECRET:'x'.repeat(64)};
   const handler=createControlHandler(cfg,{fetch:(async()=>Response.json({keys:[]})) as typeof fetch,verifyIdentity:async()=>({learnerId,issuer:cfg.accessIssuer,subject:'access-sub',email:cfg.ownerEmail,provider:'access'})});
   const repo=createRepository(env.LEARNING_DB);const actor={learner_id:learnerId,connection_id:grantId,generation:1,scopes:['teach:read','teach:organize']};
   const concept=async(slug:string)=>{const result=await repo.execute({protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation:'concept_upsert',reason:'Synthetic control test',expected:{},data:{realm:'cs',area:'systems',slug,title:slug,purpose:'Test confirmed merge',origin:'inquiry',anchor_ids:[]}},actor);if(!result.ok)throw new Error(JSON.stringify(result));return result.data.ids![0]!;};
   const source=await concept('source');const target=await concept('target');
   const start=await handler.fetch(req('/control/session'),env);const csrf=(await start.json() as {csrf:string}).csrf;const cookie=start.headers.get('Set-Cookie')!.split(';')[0]!;
   const preview=await handler.fetch(req('/control/merge-preview?source_id='+source+'&target_id='+target),env);expect(preview.status).toBe(200);expect(await preview.json()).toMatchObject({expected:{[source]:1,[target]:1}});
   const proposal={action:{operation:'concept_merge',source_id:source,target_id:target},generation:1,expected:{[source]:1,[target]:1}};
   const formHeaders={Cookie:cookie,Origin:config.origin,'Content-Type':'application/x-www-form-urlencoded'};
   const approved=await handler.fetch(req('/control/approve',{method:'POST',headers:formHeaders,body:new URLSearchParams({csrf,payload:JSON.stringify(proposal)}).toString()}),env);expect(approved.status).toBe(200);
   const approvalHtml=await approved.text();expect(approvalHtml).toContain('Confirm concept merge');
   const encodedPayload=approvalHtml.match(/name="payload" value="([^"]+)"/)![1]!;
   const body=JSON.parse(encodedPayload.replace(/&#(\d+);/g,(_match,code)=>String.fromCharCode(Number(code)))) as typeof proposal & {approvalId:string;requestId:string};
   let loseAcknowledgement=true;const interruptedDb=new Proxy(env.LEARNING_DB,{get(db,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{const result=await db.batch(statements);if(loseAcknowledgement){loseAcknowledgement=false;throw new Error('Synthetic lost acknowledgement after commit');}return result;};const value=Reflect.get(db,key);return typeof value==='function'?value.bind(db):value;}});
   const merged=await handler.fetch(req('/control/merge',{method:'POST',headers:formHeaders,body:new URLSearchParams({csrf,payload:JSON.stringify(body)}).toString()}),{...env,LEARNING_DB:interruptedDb});expect(merged.status).toBe(503);const interruptedHtml=await merged.text();expect(interruptedHtml).toContain('The save could not be confirmed');expect(interruptedHtml).toContain(body.requestId);expect(interruptedHtml).not.toContain('The merge was not saved');
   const unavailableDb=new Proxy(env.LEARNING_DB,{get(_db,key){if(key==='prepare')return ()=>{throw new Error('Synthetic store outage');};return Reflect.get(_db,key);}});
   const uncertainJson=await handler.fetch(post('/control/merge',cookie,csrf,body),{...env,LEARNING_DB:unavailableDb});expect(uncertainJson.status).toBe(503);expect(await uncertainJson.json()).toMatchObject({ok:false,error:{retryable:true}});
   const replay=await handler.fetch(post('/control/merge',cookie,csrf,body),env);expect(replay.status).toBe(200);expect(await replay.json()).toMatchObject({ok:true,meta:{replayed:true}});
   expect((await handler.fetch(post('/control/merge',cookie,csrf,{...body,requestId:crypto.randomUUID()}),env)).status).toBe(409);
   expect(await env.LEARNING_DB.prepare('SELECT merged_into FROM concepts WHERE id=?').bind(source).first('merged_into')).toBe(target);
   expect((await handler.fetch(post('/control/approve',cookie,csrf,proposal),env)).status).toBe(409);
  }finally{await instance.mf.dispose();}
 },30000);

 it('renders a browser merge review and approval form without developer tools',async()=>{
  const f=setup();const response=await f.handler.fetch(req('/control/merge?source_id=c_source&target_id=c_target'),f.env);
  expect(response.status).toBe(200);expect(response.headers.get('Content-Type')).toContain('text/html');const html=await response.text();
  expect(html).toContain('Review concept merge');expect(html).toContain('Source');expect(html).toContain('&#60;script&#62;');expect(html).not.toContain('<script>');expect(html).toContain('Target');expect(html).toContain('version 2');expect(html).toContain('version 3');expect(html).toContain('Learning history is retained');expect(html).toContain('action="/control/approve"');expect(html).toContain('name="payload"');
  const cookie=response.headers.get('Set-Cookie')!.split(';')[0]!;const csrf=html.match(/name="csrf" value="([^"]+)"/)![1]!;
  const proposal={action:{operation:'concept_merge',source_id:'c_source',target_id:'c_target'},generation:1,expected:{c_source:2,c_target:3}};
  const body=new URLSearchParams({csrf,payload:JSON.stringify(proposal)}).toString();const headers={Cookie:cookie,Origin:config.origin,'Content-Type':'application/x-www-form-urlencoded'};
  const approved=await f.handler.fetch(req('/control/approve',{method:'POST',headers,body}),f.env);expect(approved.status).toBe(200);const confirmation=await approved.text();expect(confirmation).toContain('Confirm concept merge');expect(confirmation).toContain('action="/control/merge"');expect(confirmation).toContain('requestId');
  const tampered=new URLSearchParams({csrf,payload:JSON.stringify({...proposal,expected:{c_source:1,c_target:3}})}).toString();expect((await f.handler.fetch(req('/control/approve',{method:'POST',headers,body:tampered}),f.env)).status).toBe(409);
  expect((await f.handler.fetch(req('/control/approve',{method:'POST',headers,body:new URLSearchParams({csrf:'forged',payload:JSON.stringify(proposal)}).toString()}),f.env)).status).toBe(403);
 });

 it('preserves the approved request identity in an uncertain browser save response',async()=>{
  const f=setup();const s=await session(f);const payload={action:{operation:'concept_merge',source_id:'c_source',target_id:'c_target'},generation:1,expected:{c_source:2,c_target:3},approvalId:crypto.randomUUID(),requestId:crypto.randomUUID()};
  const response=await f.handler.fetch(req('/control/merge',{method:'POST',headers:{Cookie:s.cookie,Origin:config.origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:s.csrf,payload:JSON.stringify(payload)}).toString()}),f.env);
  expect(response.status).toBe(503);const html=await response.text();expect(html).toContain('The save could not be confirmed');expect(html).toContain(payload.requestId);expect(html).toContain(payload.approvalId);expect(html).toContain('Check or retry this merge');
 });

});
it('renders only connection controls in the capture release',async()=>{
 const f=setup();const handler=createControlHandler(config,{fetch:f.fetcher as typeof fetch,verifyIdentity:f.verifyIdentity,now:()=>1800000000000},'capture');
 const response=await handler.fetch(req('/control'),f.env);expect(response.status).toBe(200);const html=await response.text();
 expect(html).toContain('Revoke connection');expect(html).not.toContain('/control/grading');expect(html).not.toContain('/control/merge');
 expect((await handler.fetch(req('/control/grading'),f.env)).status).toBe(404);expect((await handler.fetch(req('/control/merge'),f.env)).status).toBe(404);
});
