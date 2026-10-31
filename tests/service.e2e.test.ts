import { afterEach, describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runtime, token } from './runtime.ts';
import { createDevelopmentHandler } from '../app/worker/src/development.ts';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const clean of cleanups.splice(0).reverse()) await clean(); });
function message(result: unknown): Record<string, unknown> {
  if (typeof result !== 'object' || !result || !('structuredContent' in result)) throw new Error('Missing structured result');
  return result.structuredContent as Record<string, unknown>;
}
async function clientFor(mf: Awaited<ReturnType<typeof runtime>>['mf'], env?: Awaited<ReturnType<typeof runtime>>['env']) {
  const client = new Client({ name: 'teach-synthetic-client', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
    authProvider: { token: async () => token },
    fetch: async (input, init) => {
      const options = {
        ...(init?.method ? { method: init.method } : {}),
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        ...(typeof init?.body === 'string' ? { body: init.body } : {}),
      };
      const response = env
        ? await createDevelopmentHandler().fetch(new Request(String(input), options), env)
        : await mf.dispatchFetch(String(input), options);
      return new Response(await response.arrayBuffer(), { status: response.status,
        headers: Object.fromEntries(response.headers.entries()) });
    },
  });
  await client.connect(transport);
  cleanups.push(() => client.close());
  return client;
}
const request = (operation: string, data: Record<string, unknown>) => ({
  protocol_version: 1, rules_version: 1, recovery_generation: 1,
  request_id: crypto.randomUUID(), operation, reason: 'Synthetic acceptance test', expected: {}, data,
});

describe('hosted tracker service tested locally', () => {
  it('completes a real MCP session/inquiry/aim flow and survives a process restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'teach-persist-'));
    cleanups.push(() => rm(root, { recursive: true, force: true }));
    const first = await runtime(root);
    cleanups.push(() => first.mf.dispose());
    const client = await clientFor(first.mf);
    const tools = await client.listTools();
    expect(tools.tools.some(t => t.name === 'session_start')).toBe(true);
    const started = message(await client.callTool({ name: 'session_start', arguments: request('session_start', {}) }));
    expect(started.ok).toBe(true);
    const conceptRequest = request('concept_upsert', { realm: 'cs', area: 'queues', slug: 'idempotency', title: 'Idempotency', purpose: 'Retry safely', origin: 'inquiry', anchor_ids: [] });
    const concept = message(await client.callTool({ name: 'concept_upsert', arguments: conceptRequest }));
    expect(concept.ok).toBe(true);
    const payload = concept.data as { ids: string[] };
    const c = payload.ids[0];
    expect(c).toBeTypeOf('string');
    const aim = message(await client.callTool({ name: 'set_aim', arguments: request('set_aim', { concept_id: c, owner_kind: 'learner', owner_id: 'l_11111111-1111-4111-8111-111111111111', level: 2, parked: false }) }));
    expect(aim.ok).toBe(true);
    const sessionId = (started.data as { ids: string[] }).ids[0];
    const inquiry = message(await client.callTool({ name: 'log_inquiry', arguments: {
      ...request('log_inquiry', { text: 'How do idempotency keys make retries safe?', concept_ids: [c] }), session_id: sessionId,
    } }));
    expect(inquiry.ok).toBe(true);
    const exposure = message(await client.callTool({ name: 'record', arguments: {
      ...request('record', { records: [{ kind: 'exposure', concept_id: c, level: 1, source: { kind: 'conversation' }, occurred_at: new Date().toISOString() }] }), session_id: sessionId,
    } }));
    expect(exposure.ok).toBe(true);
    await client.close();
    await first.mf.dispose();
    const second = await runtime(root);
    cleanups.push(() => second.mf.dispose());
    const resumed = await clientFor(second.mf, second.env);
    const found = message(await resumed.callTool({ name: 'concept_get', arguments: { concept_id: c } }));
    expect(found, JSON.stringify(found)).toMatchObject({ ok: true });
    expect(JSON.stringify(found)).toContain('Idempotency');
    const history = message(await resumed.callTool({ name: 'history', arguments: { record_id: (exposure.data as { ids: string[] }).ids[0] } }));
    expect(history.ok).toBe(true);
    expect(await second.env.LEARNING_DB.prepare('SELECT kind FROM evidence WHERE id=?').bind((exposure.data as { ids: string[] }).ids[0]).first('kind')).toBe('exposure');
    const replay = message(await resumed.callTool({ name: 'concept_upsert', arguments: conceptRequest }));
    expect(replay.meta).toMatchObject({ replayed: true });
    const resource = await resumed.readResource({ uri: 'teach://protocol' });
    expect(JSON.stringify(resource)).toContain('Exposure');
  }, 60000);
});
