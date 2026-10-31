import {describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({action:vi.fn(async()=>({status:'pending',reason:'dispatch_disabled'})),overview:vi.fn(async()=>({generation:1,budget:{ok:false,error:{code:'BUDGET_DISABLED'}},jobs:[{job_id:'job',job_revision:2,recovery_generation:1,purpose:'grade',status:'pending',pending_reason:'dispatch_disabled'}]}))}));
vi.mock('../src/control/grading.ts',async()=>({...await vi.importActual<typeof import('../src/control/grading.ts')>('../src/control/grading.ts'),assessmentOverview:mocks.overview,assessmentAction:mocks.action}));
import {createControlHandler} from '../src/control/index.ts';
const origin='https://teach.example.com';const config={origin,learnerId:'l_22222222-2222-4222-8222-222222222222',googleSubject:'owner',ownerEmail:'owner@example.com',googleClientId:'client',googleIssuer:'https://accounts.google.com' as const,accessIssuer:'https://team.cloudflareaccess.com',accessAudience:'access'};
const env={CONTROL_SESSION_SECRET:'x'.repeat(64),SECURITY_LEDGER:{idFromName:()=>'',get:()=>({rateControl:async()=>({ok:true})})}} as never;
const handler=createControlHandler(config,{fetch:vi.fn(async()=>Response.json({keys:[]})) as typeof fetch,verifyIdentity:async()=>({learnerId:config.learnerId,issuer:config.accessIssuer,subject:'access-sub',email:config.ownerEmail,provider:'access'})});
describe('trusted grading controls',()=>{
 it('displays budget/pending work and requires signed browser CSRF before retry/cancel',async()=>{
  const signed={'Cf-Access-Jwt-Assertion':'test-assertion'};
  const session=await handler.fetch(new Request(origin+'/control/session',{headers:signed}),env);
  const cookie=session.headers.get('Set-Cookie')!.split(';')[0]!;const {csrf}=await session.json() as {csrf:string};
  const page=await handler.fetch(new Request(origin+'/control/grading',{headers:{...signed,Cookie:cookie}}),env);expect(page.status).toBe(200);const html=await page.text();expect(html).toContain('Inference budget');expect(html).toContain('dispatch_disabled');expect(html).toContain('jobRevision');
  const post=(token:string)=>new Request(origin+'/control/grading/retry',{method:'POST',headers:{...signed,Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({jobId:'job',generation:1,jobRevision:2})});
  mocks.action.mockClear();expect((await handler.fetch(post('wrong'),env)).status).toBe(403);expect(mocks.action).not.toHaveBeenCalled();
  expect((await handler.fetch(post(csrf),env)).status).toBe(200);expect(mocks.action).toHaveBeenCalledWith(env,config,'retry',{jobId:'job',generation:1,jobRevision:2});
  expect((await handler.fetch(new Request(origin+'/control/grading/retry',{headers:{...signed,Cookie:cookie}}),env)).status).toBe(405);
 });
});
