import {describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({oauth:vi.fn(async()=>new Response('oauth')),control:vi.fn(async()=>new Response('control')),rate:vi.fn(async()=>({ok:true}))}));
vi.mock('../src/auth/oauth.ts',()=>({createHostedOAuth:()=>({fetch:mocks.oauth})}));
vi.mock('../src/control/index.ts',()=>({createControlHandler:()=>({fetch:mocks.control})}));
import production from '../src/index.ts';
const origin='https://teach.example.com';
const env={TEACH_ORIGIN:origin,TEACH_LEARNER_ID:'l_22222222-2222-4222-8222-222222222222',GOOGLE_SUBJECT:'owner',OWNER_EMAIL:'owner@example.com',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',ACCESS_ISSUER:'https://team.cloudflareaccess.com',ACCESS_AUDIENCE:'access',CONTROL_SESSION_SECRET:'x'.repeat(64),SECURITY_LEDGER:{idFromName:()=>'',get:()=>({rateRegistration:mocks.rate})}};
const ctx={} as ExecutionContext;
describe('production routing',()=>{
 it('serves generic health and rejects noncanonical origin',async()=>{
  expect(await(await production.fetch(new Request(origin+'/health'),env,ctx)).json()).toEqual({status:'ok'});
  expect((await production.fetch(new Request('https://evil.example/health'),env,ctx)).status).toBe(403);
 });
 it('charges only registration POSTs, not preflight or rejected methods',async()=>{
  mocks.rate.mockClear();
  for(const method of ['OPTIONS','GET'])expect((await production.fetch(new Request(origin+'/register',{method}),env,ctx)).status).toBe(200);
  expect(mocks.rate).not.toHaveBeenCalled();
  expect((await production.fetch(new Request(origin+'/register',{method:'POST'}),env,ctx)).status).toBe(503);
  const request=()=>new Request(origin+'/register',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.1'}});
  expect((await production.fetch(request(),env,ctx)).status).toBe(200);expect(mocks.rate).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
  mocks.rate.mockResolvedValueOnce({ok:false,retryAfterSeconds:45} as never);
  const response=await production.fetch(request(),env,ctx);expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('45');
 });
 it('routes browser controls separately and fails closed on missing context/outage',async()=>{
  expect(await(await production.fetch(new Request(origin+'/control'),env,ctx)).text()).toBe('control');
  expect((await production.fetch(new Request(origin+'/mcp'),env)).status).toBe(503);
  mocks.oauth.mockRejectedValueOnce(new Error('private'));
  const failure=await production.fetch(new Request(origin+'/mcp'),env,ctx);expect(failure.status).toBe(503);expect(await failure.text()).not.toContain('private');
 });
});
