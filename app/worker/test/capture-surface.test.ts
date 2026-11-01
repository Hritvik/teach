import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { runtime, learnerId, grantId } from '../../../tests/runtime.ts';
import { mcpHandler } from '../src/mcp/server.ts';
let instance: Awaited<ReturnType<typeof runtime>>;
const actor = { learner_id: learnerId, connection_id: grantId, generation: 1, scopes: ['teach:read','teach:learn','teach:organize'] };
beforeAll(async () => { instance = await runtime(); });
afterAll(async () => { await instance?.mf.dispose(); });
async function clientFor(mode: 'capture'|'full') {
  const client = new Client({ name: 'capture-release-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('https://teach.example.com/mcp'), {
    fetch: async (input, init) => mcpHandler(instance.env.LEARNING_DB, actor, { releaseMode: mode }).fetch(new Request(String(input), init)),
  }));
  return client;
}
function structured(value: unknown) {
  const result = value as { structuredContent: { ok: boolean; data: Record<string, unknown> } };
  return result.structuredContent;
}
const envelope = (operation: string, data: Record<string, unknown>, session_id?: string) => ({
  protocol_version: 1, rules_version: 1, recovery_generation: 1, request_id: crypto.randomUUID(), operation,
  reason: 'Synthetic capture release acceptance', expected: {}, data, ...(session_id ? { session_id } : {}),
});
describe('capture-only MCP release', () => {
  it('advertises capture tools and omits deferred assessment/review/control operations', async () => {
    const client = await clientFor('capture');
    try {
      const tools = (await client.listTools()).tools;
      const names = tools.map(tool => tool.name);
      for (const name of ['session_start','log_inquiry','record','concept_upsert','set_aim','learner_notes','inbox']) expect(names).toContain(name);
      for (const name of ['anchor_capture','item_add','item_verify','item_next','answer','attempt_status','item_status','dispute_answer','budget_status','calibration','misconceptions','mastery','next','needs_you','concept_merge','goal_close']) expect(names).not.toContain(name);
      expect(tools.find(tool => tool.name === 'history')?.inputSchema).toMatchObject({required:['record_id']});
      expect(tools.find(tool => tool.name === 'session_end')?.description).toContain('expected');
      expect(tools.find(tool => tool.name === 'retract')?.description).toContain('Destructive');
      const resource = JSON.stringify(await client.readResource({uri:'teach://protocol'}));
      expect(resource).toContain('capture-only');
      expect(resource).toContain('grading and spaced reviews are unavailable');
      expect(resource).toContain('Write envelope');
      expect(resource).toContain('history requires record_id');
      expect(JSON.stringify(await client.callTool({name:'protocol',arguments:{}}))).toContain('capture-only');
    } finally { await client.close(); }
  });
  it('names the missing field when a write payload is invalid', async () => {
    const client = await clientFor('capture');
    try {
      const result = await client.callTool({ name: 'concept_upsert', arguments: envelope('concept_upsert', {}) });
      expect(JSON.stringify(result)).toContain('realm');
    } finally { await client.close(); }
  });
  it('does not let a guessed disabled tool name or curated query access the deferred surface', async () => {
    const client = await clientFor('capture');
    try {
      await expect(client.callTool({name:'answer',arguments:envelope('answer',{})})).rejects.toThrow();
      const query = await client.callTool({name:'query',arguments:{view:'v_mastery',select:['state']}});
      expect(structured(query)).toMatchObject({ok:false});
      expect(await instance.env.LEARNING_DB.prepare('SELECT COUNT(*) AS n FROM grade_jobs').first('n')).toBe(0);
    } finally { await client.close(); }
  });
  it('saves a session, inquiry and exposure, then reads them through a new MCP connection', async () => {
    let client = await clientFor('capture');
    try {
      const start = structured(await client.callTool({name:'session_start',arguments:envelope('session_start',{})}));
      expect(start.ok).toBe(true);const session = (start.data.ids as string[])[0]!;
      const conceptInput = envelope('concept_upsert',{realm:'cs',area:'capture',slug:'capture',title:'Capture safely',purpose:'Remember inquiries',origin:'inquiry',anchor_ids:[]});
      const saved = structured(await client.callTool({name:'concept_upsert',arguments:conceptInput}));
      const concept = (saved.data.ids as string[])[0]!;
      expect(structured(await client.callTool({name:'log_inquiry',arguments:envelope('log_inquiry',{text:'How do receipts make a retry safe?',concept_ids:[concept],unresolved:true},session)})).ok).toBe(true);
      expect(structured(await client.callTool({name:'record',arguments:envelope('record',{records:[{kind:'exposure',concept_id:concept,level:1,source:{kind:'conversation'},occurred_at:new Date().toISOString()}]},session)})).ok).toBe(true);
      const forged = structured(await client.callTool({name:'record',arguments:envelope('record',{records:[{kind:'answer',concept_id:concept,level:1,content_grade:'correct',source:{},occurred_at:new Date().toISOString()}]},session)}));
      expect(forged.ok).toBe(false);
      await client.close();client = await clientFor('capture');
      expect(JSON.stringify(await client.callTool({name:'concept_get',arguments:{concept_id:concept}}))).toContain('Capture safely');
      expect(JSON.stringify(await client.callTool({name:'inbox',arguments:{}}))).toContain('How do receipts');
      expect(structured(await client.callTool({name:'concept_upsert',arguments:conceptInput})).ok).toBe(true);
      expect(await instance.env.LEARNING_DB.prepare("SELECT COUNT(*) AS n FROM evidence WHERE concept_id=? AND kind='exposure'").bind(concept).first('n')).toBe(1);
    } finally { await client.close(); }
  });
  it('refuses assessed metadata amendments and withdrawals without replaying existing review state', async () => {
    const client = await clientFor('capture');
    const id = (prefix:string) => prefix+'_'+crypto.randomUUID();
    const item=id('it'),verification=id('iv'),attempt=id('at'),evidence=id('e');
    try {
      const start=structured(await client.callTool({name:'session_start',arguments:envelope('session_start',{})}));const session=(start.data.ids as string[])[0]!;
      const saved=structured(await client.callTool({name:'concept_upsert',arguments:envelope('concept_upsert',{realm:'cs',area:'legacy',slug:'legacy',title:'Legacy assessed concept',purpose:'Retain existing state',origin:'inquiry',anchor_ids:[]})}));const concept=(saved.data.ids as string[])[0]!;
      const now=new Date().toISOString();
      await instance.env.LEARNING_DB.batch([
        instance.env.LEARNING_DB.prepare("INSERT INTO items(id,learner_id,concept_id,level,type,state,current_verification_id) VALUES(?,?,?,1,'free_text','verified',?)").bind(item,learnerId,concept,verification),
        instance.env.LEARNING_DB.prepare("INSERT INTO item_versions VALUES(?,1,'Question','{}','production','[]','[]',NULL,'content-hash')").bind(item),
        instance.env.LEARNING_DB.prepare("INSERT INTO item_verifications(id,learner_id,item_id,item_version,capture_set_hash,prompt_version,state,result_json,verifier_provenance_json,seq,result_job_id) VALUES(?,?,?,1,'capture',1,'supported','{}','{}',1,'fixture')").bind(verification,learnerId,item),
        instance.env.LEARNING_DB.prepare("INSERT INTO attempts(id,learner_id,session_id,item_id,item_version,answer,confidence,help_json,occurred_at,accepted_at,timezone,local_day,state,verification_id) VALUES(?,?,?,?,1,'Accepted answer','unknown','{}',?,?,'UTC',?,'graded',?)").bind(attempt,learnerId,session,item,now,now,now.slice(0,10),verification),
        instance.env.LEARNING_DB.prepare("INSERT INTO evidence(id,learner_id,seq,concept_id,level,session_id,attempt_id,kind,content_grade,strength,confidence,help_json,occurred_at,accepted_at,timezone,local_day,source_json,content,rules_version) VALUES(?,?,1,?,1,?,?,'answer','correct','unresolved','unknown','{}',?,?,'UTC',?,'{}','Accepted answer',1)").bind(evidence,learnerId,concept,session,attempt,now,now,now.slice(0,10)),
      ]);
      const before=await instance.env.LEARNING_DB.prepare('SELECT * FROM meta').first();
      for(const operation of ['amend','retract']) {
        const result=structured(await client.callTool({name:operation,arguments:envelope(operation,{root_record_id:evidence,expected_effective_revision:0,...(operation==='amend'?{replacement:{confidence:'sure'}}:{}),reason:'Correct metadata'})}));
        expect(result).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
      }
      expect(await instance.env.LEARNING_DB.prepare('SELECT * FROM meta').first()).toEqual(before);
      expect(await instance.env.LEARNING_DB.prepare('SELECT COUNT(*) AS n FROM record_corrections WHERE root_record_id=?').bind(evidence).first('n')).toBe(0);
      expect(await instance.env.LEARNING_DB.prepare('SELECT COUNT(*) AS n FROM review_schedules WHERE concept_id=?').bind(concept).first('n')).toBe(0);
    } finally { await client.close(); }
  });
  it('keeps the explicitly full surface available to full-mode development and later release tests', async () => {
    const client = await clientFor('full');
    try { expect((await client.listTools()).tools.map(tool=>tool.name)).toContain('answer'); }
    finally { await client.close(); }
  });
});
