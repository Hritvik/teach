import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runtime, token } from '../../../tests/runtime.ts';
import { createDevelopmentHandler } from '../src/development.ts';
import production from '../src/index.ts';
let instance: Awaited<ReturnType<typeof runtime>>;
beforeAll(async () => { instance = await runtime(); });
afterAll(async () => { await instance?.mf.dispose(); });
const req = (headers: Record<string,string> = {}, body = '{}') => new Request('http://localhost/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body });
describe('development isolation and ingress', () => {
  it('production does not expose synthetic identities', async () => {
    const response = await production.fetch(req(), {} as never);
    expect(response.status).toBe(503);
  });
  it('returns generic health without authentication or learner state', async () => {
    const response = await createDevelopmentHandler().fetch(new Request('http://localhost/health'), instance.env);
    expect(await response.json()).toEqual({ status: 'ok', mode: 'synthetic-development' });
  });
  it('rejects absent or incorrect credentials', async () => {
    const handler = createDevelopmentHandler();
    expect((await handler.fetch(req({ Authorization: '' }), instance.env)).status).toBe(401);
    expect((await handler.fetch(req({ Authorization: 'Bearer incorrect' }), instance.env)).status).toBe(401);
    expect((await handler.fetch(req(), { ...instance.env, TEACH_DEV_TOKEN: '' })).status).toBe(503);
  });
  it('blocks hostile Host, URL and Origin values', async () => {
    const handler = createDevelopmentHandler();
    expect((await handler.fetch(req({ Host: 'evil.example' }), instance.env)).status).toBe(403);
    expect((await handler.fetch(req({ Origin: 'https://evil.example' }), instance.env)).status).toBe(403);
    expect((await handler.fetch(new Request('https://evil.example/mcp'), instance.env)).status).toBe(403);
  });
  it('rejects malformed JSON and over-limit bodies before MCP dispatch', async () => {
    const handler = createDevelopmentHandler();
    expect((await handler.fetch(req({}, '{bad'), instance.env)).status).toBe(400);
    expect((await handler.fetch(req({}, ' '.repeat(65537)), instance.env)).status).toBe(413);
    expect((await handler.fetch(req({ 'Content-Type': 'text/plain' }), instance.env)).status).toBe(415);
  });
  it('does not route arbitrary API paths or methods', async () => {
    const handler = createDevelopmentHandler();
    expect((await handler.fetch(new Request('http://localhost/unknown'), instance.env)).status).toBe(404);
    expect((await handler.fetch(new Request('http://localhost/mcp', { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }), instance.env)).status).toBe(405);
  });
});
