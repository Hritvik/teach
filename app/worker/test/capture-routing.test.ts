import {describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({scheduled:vi.fn(async()=>({status:'idle'})),control:vi.fn(async()=>new Response('control')),mode:vi.fn()}));
vi.mock('../src/grading/config.ts',()=>({runScheduledAssessment:mocks.scheduled}));
vi.mock('../src/control/index.ts',()=>({createControlHandler:()=>({fetch:mocks.control})}));
vi.mock('../src/auth/oauth.ts',()=>({createHostedOAuth:()=>({fetch:async()=>new Response('oauth')})}));
import {createProductionHandler} from '../src/index.ts';
const origin='https://teach.example.com';
const env={TEACH_ORIGIN:origin,TEACH_LEARNER_ID:'l_22222222-2222-4222-8222-222222222222',GOOGLE_SUBJECT:'owner',OWNER_EMAIL:'owner@example.com',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',ACCESS_ISSUER:'https://team.cloudflareaccess.com',ACCESS_AUDIENCE:'access',CONTROL_SESSION_SECRET:'x'.repeat(64)};
describe('capture deployment isolation',()=>{
 it('never runs scheduled inference even if an enabled environment is supplied',async()=>{
  const worker=createProductionHandler('capture');const waitUntil=vi.fn();await worker.scheduled({} as ScheduledController,{...env,TEACH_INFERENCE_ENABLED:'true',OPENAI_API_KEY:'unused'}, {waitUntil} as unknown as ExecutionContext);
  expect(mocks.scheduled).not.toHaveBeenCalled();expect(waitUntil).not.toHaveBeenCalled();
 });
 it('exposes connection controls while deferred controls remain unavailable',async()=>{
  const worker=createProductionHandler('capture');
  for(const path of ['/control','/control/session','/control/connections','/control/revoke'])expect((await worker.fetch(new Request(origin+path),env,{} as ExecutionContext)).status).toBe(200);
  mocks.control.mockClear();
  for(const path of ['/control/grading','/control/grading/retry','/control/merge','/control/approve','/control/backups','/control/deletion','/control/restore'])expect((await worker.fetch(new Request(origin+path),env,{} as ExecutionContext)).status).toBe(404);
  expect(mocks.control).not.toHaveBeenCalled();
 });
});
