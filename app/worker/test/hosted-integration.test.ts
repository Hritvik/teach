import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {runtime,learnerId,grantId} from '../../../tests/runtime.ts';
import {hostedMcp} from '../src/hosted.ts';
let instance:Awaited<ReturnType<typeof runtime>>;
beforeAll(async()=>{instance=await runtime();});afterAll(async()=>{await instance?.mf.dispose();});
const config={origin:'https://teach.example.com',learnerId,googleSubject:'owner',ownerEmail:'owner@example.com',googleClientId:'google',googleIssuer:'https://accounts.google.com' as const,accessIssuer:'https://team.cloudflareaccess.com',accessAudience:'access'};
describe('hosted MCP with actual D1 and ledger',()=>{
 it('serves permitted reads, rejects scope escalation and denies newly admitted calls after revocation',async()=>{
  const client=new Client({name:'hosted-test',version:'1'});
  const handler=hostedMcp(config);
  const transport=new StreamableHTTPClientTransport(new URL(config.origin+'/mcp'),{fetch:async(input,init)=>{
   const request=new Request(String(input),init);
   return handler.fetch(request,instance.env,{props:{learnerId,connectionId:grantId},auth:{audience:config.origin+'/mcp',scope:['teach:read']}});
  }});
  try{
   await client.connect(transport);
   const who=await client.callTool({name:'whoami',arguments:{}});expect(who.structuredContent).toMatchObject({ok:true});
   const protocol=await client.callTool({name:'protocol',arguments:{}});expect(JSON.stringify(protocol)).toContain('Exposure');
   await expect(client.callTool({name:'session_start',arguments:{protocol_version:1,rules_version:1,recovery_generation:1,request_id:crypto.randomUUID(),operation:'session_start',reason:'scope test',expected:{},data:{}}})).rejects.toThrow();
   await instance.ledger.revoke(grantId);
   await expect(client.callTool({name:'whoami',arguments:{}})).rejects.toThrow();
  }finally{await client.close();}
 });
});
