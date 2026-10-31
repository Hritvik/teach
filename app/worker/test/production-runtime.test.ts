import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fileURLToPath} from 'node:url';
let mf:Miniflare;
const origin='https://teach.example.com';
beforeAll(async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/production.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',target:'es2023',external:['cloudflare:workers']});
 mf=new Miniflare(convertV4MiniflareOptions({name:'teach-hosted-test',modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat','global_fetch_strictly_public'],kvNamespaces:['OAUTH_KV'],d1Databases:{LEARNING_DB:'hosted-test'},durableObjects:{SECURITY_LEDGER:{className:'SecurityLedger',useSQLite:true}},bindings:{TEACH_ORIGIN:origin,TEACH_LEARNER_ID:'l_22222222-2222-4222-8222-222222222222',GOOGLE_SUBJECT:'owner',OWNER_EMAIL:'owner@example.com',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-only-not-live',ACCESS_ISSUER:'https://team.cloudflareaccess.com',ACCESS_AUDIENCE:'test-access',CONTROL_SESSION_SECRET:'x'.repeat(64)}}));
});
afterAll(async()=>{await mf?.dispose();});
describe('production bundle in Workers runtime',()=>{
 it('serves discovery and requires OAuth for MCP and Access for controls',async()=>{
  expect((await mf.dispatchFetch(origin+'/health')).status).toBe(200);
  const metadata=await mf.dispatchFetch(origin+'/.well-known/oauth-authorization-server');expect(metadata.status).toBe(200);
  expect(await metadata.json()).toMatchObject({issuer:origin,authorization_endpoint:origin+'/authorize',token_endpoint:origin+'/oauth/token',registration_endpoint:origin+'/register'});
  const resource=await mf.dispatchFetch(origin+'/.well-known/oauth-protected-resource/mcp');expect(resource.status).toBe(200);expect(await resource.json()).toMatchObject({resource:origin+'/mcp',authorization_servers:[origin]});
  expect((await mf.dispatchFetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(401);
  expect((await mf.dispatchFetch(origin+'/control')).status).toBe(401);
 });
 it('allows registration preflight and caps actual registrations authoritatively',async()=>{
  const preflight=await mf.dispatchFetch(origin+'/register',{method:'OPTIONS'});expect(preflight.status).toBeLessThan(400);
  for(let i=0;i<5;i++){
   const result=await mf.dispatchFetch(origin+'/register',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.2'},body:JSON.stringify({client_name:'Synthetic client',redirect_uris:['http://127.0.0.1:3542/callback'],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']})});
   expect(result.status).toBe(201);
  }
  const limited=await mf.dispatchFetch(origin+'/register',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.2'},body:'{}'});expect(limited.status).toBe(429);
 });
});
