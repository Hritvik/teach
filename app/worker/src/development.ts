import type { DevelopmentEnv } from './env.ts';
import { mcpHandler } from './mcp/server.ts';
const allowed = new Set(['localhost', '127.0.0.1', '[::1]']);
function allowedOrigin(value: string) {
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && allowed.has(u.hostname); }
  catch { return false; }
}
function localRequest(request: Request) {
  const url = new URL(request.url);
  if (!allowed.has(url.hostname)) return false;
  const host = request.headers.get('Host');
  if (host && !allowedOrigin(`http://${host}`)) return false;
  const origin = request.headers.get('Origin');
  return !origin || allowedOrigin(origin);
}
async function parsedBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new RangeError('Body too large'); }
      chunks.push(next.value);
    }
    const combined = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(combined));
  } finally { reader.releaseLock(); }
}
function generationIn(body: unknown): number | undefined {
  if (!body || typeof body !== 'object' || !('params' in body)) return undefined;
  const params = body.params;
  if (!params || typeof params !== 'object' || !('arguments' in params)) return undefined;
  const args = params.arguments;
  if (!args || typeof args !== 'object' || !('recovery_generation' in args)) return undefined;
  return typeof args.recovery_generation === 'number' ? args.recovery_generation : undefined;
}
export function createDevelopmentHandler() {
  return { async fetch(request: Request, env: DevelopmentEnv): Promise<Response> {
    if (!localRequest(request)) return Response.json({ error: 'Loopback requests only' }, { status: 403 });
    const path = new URL(request.url).pathname;
    if (path === '/health') return Response.json({ status: 'ok', mode: 'synthetic-development' });
    if (path !== '/mcp') return new Response('Not found', { status: 404 });
    if (!env.TEACH_DEV_TOKEN || !env.TEACH_DEV_LEARNER || !env.TEACH_DEV_GRANT) return new Response('Development identity not configured', { status: 503 });
    if (request.headers.get('Authorization') !== `Bearer ${env.TEACH_DEV_TOKEN}`) return new Response('Unauthorised', { status: 401 });
    if (!['POST','GET','DELETE'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    if (request.method === 'POST' && request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') return new Response('JSON required', { status: 415 });
    let body: unknown;
    try { body = request.method === 'POST' ? await parsedBody(request) : undefined; }
    catch (error) { return new Response(error instanceof RangeError ? 'Body too large' : 'Invalid JSON', { status: error instanceof RangeError ? 413 : 400 }); }
    try {
      const ledger = env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(env.TEACH_DEV_LEARNER));
      const admitted = await ledger.admit(env.TEACH_DEV_GRANT, ['teach:read']);
      if (!admitted.ok) return Response.json(admitted, { status: admitted.error.code === 'UNAUTHORISED' ? 401 : 403 });
      const generation = generationIn(body);
      if (generation !== undefined) {
        const writeAdmission = await ledger.admit(env.TEACH_DEV_GRANT, ['teach:read'], generation);
        if (!writeAdmission.ok) return Response.json(writeAdmission, { status: 409 });
      }
      return await mcpHandler(env.LEARNING_DB, admitted.admission,{budgetStatus:async()=>ledger.budgetStatus()}).fetch(request, { ...(body === undefined ? {} : { parsedBody: body }) });
    } catch {
      return Response.json({ error: 'Tracker unavailable; no save acknowledgement' }, { status: 503 });
    }
  } };
}
