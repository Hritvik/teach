import { describe, it, expect, vi } from 'vitest';
import { hostedMcp, readHostedConfig } from '../src/hosted.ts';
const config = { origin: 'https://teach.example.com', learnerId: 'l_22222222-2222-4222-8222-222222222222', googleSubject: 'owner-sub', ownerEmail: 'owner@example.com', googleClientId: 'google-client', googleIssuer: 'https://accounts.google.com' as const, accessIssuer:'https://team.cloudflareaccess.com',accessAudience:'access-app' };
const ctx = { props: { learnerId: 'l_22222222-2222-4222-8222-222222222222', connectionId: 'connection' }, auth: { audience: config.origin + '/mcp', scope: ['teach:read'] } };
function fixture() {
 const ledger = { admit: vi.fn(async () => ({ok:true,admission:{learner_id:'l_owner',connection_id:'connection',generation:1,scopes:['teach:read']}})), rateLimit: vi.fn(async () => ({ok:true})) };
 const env = { SECURITY_LEDGER: { idFromName: () => 'id', get: () => ledger } } as never;
 return {ledger,env};
}
const request = (body = '{}', headers = {}) => new Request(config.origin + '/mcp', {method:'POST',headers:{'Content-Type':'application/json',...headers},body});
describe('hosted ingress', () => {
 it('refuses absent, insecure or synthetic production identity configuration', () => {
  expect(() => readHostedConfig({})).toThrow();
  const env = { TEACH_ORIGIN: config.origin, TEACH_LEARNER_ID: config.learnerId, GOOGLE_SUBJECT: config.googleSubject, OWNER_EMAIL: config.ownerEmail, GOOGLE_CLIENT_ID: config.googleClientId, GOOGLE_CLIENT_SECRET:'secret', ACCESS_ISSUER:'https://team.cloudflareaccess.com',ACCESS_AUDIENCE:'access-app', CONTROL_SESSION_SECRET:'x'.repeat(64) };
  expect(readHostedConfig(env)).toMatchObject(config);
  for(const origin of ['http://teach.example.com','https://localhost','https://teach.example.com/path','https://user:pass@teach.example.com']) expect(() => readHostedConfig({...env,TEACH_ORIGIN:origin})).toThrow();
  expect(() => readHostedConfig({...env,TEACH_DEV_TOKEN:'no'})).toThrow();
  expect(() => readHostedConfig({...env,TEACH_LEARNER_ID:'l_owner'})).toThrow();
 });
 it('denies missing connection, wrong learner or resource before ledger access', async () => {
  const {ledger,env}=fixture();
  for(const context of [{...ctx,props:{learnerId:'l_owner'}},{...ctx,props:{...ctx.props,learnerId:'other'}},{...ctx,auth:{...ctx.auth,audience:'https://other/mcp'}}]) expect((await hostedMcp(config).fetch(request(),env,context as never)).status).toBe(401);
  expect(ledger.admit).not.toHaveBeenCalled();
 });
 it('enforces method, origin, content and streaming size bounds',async()=>{
  const {env}=fixture(); const handler=hostedMcp(config);
  expect((await handler.fetch(new Request(config.origin+'/mcp',{method:'PUT'}),env,ctx as never)).status).toBe(405);
  expect((await handler.fetch(new Request(config.origin+'/mcpevil',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env,ctx as never)).status).toBe(404);
  expect((await handler.fetch(request('{}',{Origin:'https://evil.example'}),env,ctx as never)).status).toBe(403);
  expect((await handler.fetch(request('{}',{'Content-Type':'text/plain'}),env,ctx as never)).status).toBe(415);
  expect((await handler.fetch(request('{'),env,ctx as never)).status).toBe(400);
  expect((await handler.fetch(request(' '.repeat(65537)),env,ctx as never)).status).toBe(413);
 });
 it('checks mutation capability and generation at authoritative ledger admission',async()=>{
  const {ledger,env}=fixture(); ledger.admit.mockResolvedValue({ok:false,error:{code:'FORBIDDEN'}} as never);
  const response=await hostedMcp(config).fetch(request(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'set_aim',arguments:{recovery_generation:3}}})),env,{...ctx,auth:{...ctx.auth,scope:['teach:read','teach:organize']}} as never);
  expect(response.status).toBe(403); expect(ledger.admit).toHaveBeenCalledWith('connection',['teach:read','teach:organize'],3);
 });
 it('denies revoked and rate-limited grants and ledger outages',async()=>{
  const {ledger,env}=fixture(); const handler=hostedMcp(config);
  ledger.admit.mockResolvedValueOnce({ok:false,error:{code:'UNAUTHORISED'}} as never);
  expect((await handler.fetch(request(),env,ctx as never)).status).toBe(401);
  ledger.rateLimit.mockResolvedValueOnce({ok:false,retryAfterSeconds:2} as never);
  const limited=await handler.fetch(request(),env,ctx as never); expect(limited.status).toBe(429);expect(limited.headers.get('Retry-After')).toBe('2');
  ledger.admit.mockRejectedValueOnce(new Error('private error')); const unavailable=await handler.fetch(request(),env,ctx as never);expect(unavailable.status).toBe(503);expect(await unavailable.text()).not.toContain('private error');
 });
});
