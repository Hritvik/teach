import { describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class {} }));
vi.mock('@cloudflare/workers-oauth-provider', () => ({
  default: class { constructor(readonly options: unknown) {} },
  OAuthError: class extends Error { constructor(readonly code: string, options: { description: string }) { super(options.description); } },
  AuthorizationError: class extends Error {}, CimdFetchError: class extends Error {},
}));
import { createHostedOAuth, createAuthorizationHandler, type HostedOAuthConfig, type HostedOAuthEnv, validateTokenGrant } from '../src/auth/oauth.ts';
const config: HostedOAuthConfig = { origin: 'https://teach.example', learnerId: 'learner', googleIssuer: 'https://accounts.google.com', googleSubject: 'owner-sub', ownerEmail: 'owner@example.com', googleClientId: 'teach-client' };
const auth = { clientId: 'client', responseType: 'code', redirectUri: 'http://localhost:9999/callback', scope: ['teach:read'], state: 'client-state', resource: 'https://teach.example/mcp', codeChallengeMethod: 'S256', codeChallenge: 'a'.repeat(43) };
function setup() {
  const helper = { parseAuthRequest: vi.fn(async () => auth), describeConsent: vi.fn(async () => ({ clientName: '<script>', redirectHost: 'localhost', redirectIsLoopback: true, scope: auth.scope })), beginConsent: vi.fn(async () => ({ handle: 'handle', headers: new Headers() })), approveConsent: vi.fn(async () => ({ request: auth, headers: new Headers() })), denyConsent: vi.fn(async () => ({ headers: new Headers({ Location: 'http://localhost:9999/callback?error=access_denied' }) })), beginUpstream: vi.fn(async (_request: unknown, _options: unknown) => ({ state: 'upstream-state', headers: new Headers() })), finishUpstream: vi.fn(async () => { throw new Error('Invalid binding'); }) };
  return { helper, env: { OAUTH_PROVIDER: helper, GOOGLE_CLIENT_SECRET: 'synthetic-secret' } as unknown as HostedOAuthEnv };
}
describe('hosted OAuth authorization boundary', () => {
  it('refuses configuration derived from unsafe origins', () => {
    expect(() => createHostedOAuth({ ...config, origin: 'http://evil.example' }, { fetch: async () => new Response() })).toThrow();
  });
  it('escapes client text and asks consent before upstream login', async () => {
    const { helper, env } = setup();
    const response = await createAuthorizationHandler(config).fetch(new Request(`${config.origin}/authorize`), env);
    expect(response.status).toBe(200); expect(await response.text()).toContain('&#60;script&#62;');
    expect(helper.beginUpstream).not.toHaveBeenCalled();
  });
  it('rejects cross-origin or unbounded consent posts before helper access', async () => {
    const { helper, env } = setup(); const handler = createAuthorizationHandler(config);
    expect((await handler.fetch(new Request(`${config.origin}/authorize`, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: 'handle=x' }), env)).status).toBe(403);
    expect(helper.approveConsent).not.toHaveBeenCalled();
    expect((await handler.fetch(new Request(`${config.origin}/authorize`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x'.repeat(8193) }), env)).status).toBe(413);
  });
  it('intersects chosen scopes with the stored request, starts nonce-bound Google login', async () => {
    const { helper, env } = setup();
    const response = await createAuthorizationHandler(config).fetch(new Request(`${config.origin}/authorize`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'handle=handle&decision=approve&scope=teach%3Aread&scope=teach%3Aorganize' }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Location')).toBeNull();
    const location = await linkFrom(response);
    expect(location.origin).toBe('https://accounts.google.com'); expect(location.searchParams.get('state')).toBe('upstream-state');
    expect(location.searchParams.get('nonce')).toBeTruthy();
    expect(helper.beginUpstream.mock.calls[0]?.[0]).toMatchObject({ scope: ['teach:read'] });
  });
  it('returns a browser-safe denial link with the library binding headers', async () => {
    const { helper, env } = setup();
    const response = await createAuthorizationHandler(config).fetch(new Request(`${config.origin}/authorize`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'handle=handle&decision=deny' }), env);
    expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
    expect((await linkFrom(response)).searchParams.get('error')).toBe('access_denied');
    expect(helper.beginUpstream).not.toHaveBeenCalled();
  });
  it('fails invalid callback state closed without exchanging secrets', async () => {
    const { env } = setup(); const fetcher = vi.fn();
    const response = await createAuthorizationHandler(config, { fetch: fetcher }).fetch(new Request(`${config.origin}/callback?code=stolen&state=forged`), env);
    expect(response.status).toBe(400); expect(fetcher).not.toHaveBeenCalled(); expect(await response.text()).not.toContain('binding');
  });
});

async function linkFrom(response: Response) {
  const href = /href="([^"]+)"/.exec(await response.text())![1]!;
  return new URL(href.replace(/&#(\d+);/g, (_all, code: string) => String.fromCharCode(Number(code))));
}
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
async function callbackFixture(patch: Record<string, unknown> = {}, failure: 'pending' | 'activation' | 'complete' | undefined = undefined, now = 1_800_000_000) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const payload = `${encode({ alg: 'RS256', kid: 'one' })}.${encode({ iss: config.googleIssuer, aud: config.googleClientId, sub: config.googleSubject, email: config.ownerEmail, email_verified: true, nonce: 'fresh-nonce', iat: now - 10, exp: now + 300, ...patch })}`;
  const signed = `${payload}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(payload))).toString('base64url')}`;
  const order: string[] = [];
  const helpers = {
    finishUpstream: vi.fn(async () => ({ request: auth, data: { nonce: 'fresh-nonce' }, headers: new Headers() })),
    completeAuthorization: vi.fn(async () => { order.push('complete'); if (failure === 'complete') throw new Error('Outage'); return { redirectTo: 'http://localhost:9999/callback?code=library-code' }; }),
  };
  const authority = { createPendingGrant: vi.fn(async () => { order.push('pending'); return { ok: failure !== 'pending' }; }), activateGrant: vi.fn(async () => { order.push('active'); return { ok: failure !== 'activation' }; }), admit: vi.fn(async () => ({ ok: true, admission: { scopes: ['teach:read'] } })) };
  const env = { OAUTH_PROVIDER: helpers, GOOGLE_CLIENT_SECRET: 'secret', SECURITY_LEDGER: { idFromName: () => 'id', get: () => authority } } as unknown as HostedOAuthEnv;
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).includes('/token') ? Response.json({ id_token: signed }) : Response.json({ keys: [{ ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'one', alg: 'RS256', use: 'sig' }] }));
  return { env, helpers, authority, order, fetcher, handler: createAuthorizationHandler(config, { now: () => now, fetch: fetcher }) };
}
describe('Google owner callback and authoritative grant issue', () => {
  it('accepts a valid callback using the default production clock', async () => {
    const fixture = await callbackFixture({}, undefined, Math.floor(Date.now() / 1000));
    const response = await createAuthorizationHandler(config, { fetch: fixture.fetcher }).fetch(new Request(`${config.origin}/callback?code=google-code`), fixture.env);
    expect(response.status).toBe(302);
  });
  it('verifies signed owner then commits pending, library grant and activation before redirect', async () => {
    const fixture = await callbackFixture();
    const response = await fixture.handler.fetch(new Request(`${config.origin}/callback?code=google-code&state=bound-state`), fixture.env);
    expect(response.status).toBe(302); expect(fixture.order).toEqual(['pending', 'complete', 'active']);
    expect(fixture.authority.createPendingGrant).toHaveBeenCalledWith(expect.objectContaining({ subject: config.googleSubject, clientId: 'client', scopes: ['teach:read'] }));
    expect(fixture.helpers.completeAuthorization).toHaveBeenCalledWith(expect.objectContaining({ userId: config.learnerId, props: expect.objectContaining({ learnerId: config.learnerId, connectionId: expect.any(String) }) }));
    expect(fixture.fetcher.mock.calls.map(call => String(call[0]))).toEqual(['https://oauth2.googleapis.com/token', 'https://www.googleapis.com/oauth2/v3/certs']);
  });
  it.each([{ sub: 'attacker' }, { aud: 'wrong' }, { nonce: 'replay' }, { email_verified: false }])('denies malicious signed callback claims %j', async patch => {
    const fixture = await callbackFixture(patch);
    const response = await fixture.handler.fetch(new Request(`${config.origin}/callback?code=google-code`), fixture.env);
    expect(response.status).toBe(400); expect(fixture.order).toEqual([]);
  });
  it.each(['pending', 'complete', 'activation'] as const)('does not redirect a partially issued connection after %s failure', async failure => {
    const fixture = await callbackFixture({}, failure);
    const response = await fixture.handler.fetch(new Request(`${config.origin}/callback?code=google-code`), fixture.env);
    expect(response.status).toBe(400); expect(response.headers.get('Location')).toBeNull();
  });
});

describe('token exchange rechecks the ledger', () => {
  it('rejects revoked, unknown and legacy credentials and scope escalation on refresh', async () => {
    const fixture = await callbackFixture();
    const options = { props: { learnerId: config.learnerId, connectionId: 'connection' }, userId: config.learnerId, resource: `${config.origin}/mcp`, clientId: 'client', subjectClientId: 'client', requestedScope: ['teach:read'], env: fixture.env };
    const invoke = (patch: Record<string, unknown> = {}) => validateTokenGrant(config, { ...options, ...patch } as Parameters<typeof validateTokenGrant>[1]);
    await expect(invoke()).resolves.toBeUndefined();
    await expect(invoke({ props: { learnerId: config.learnerId } })).rejects.toThrow();
    await expect(invoke({ resource: 'https://evil.example/mcp' })).rejects.toThrow();
    await expect(invoke({ clientId: 'different-client' })).rejects.toThrow();
    await expect(invoke({ requestedScope: ['teach:organize'] })).rejects.toThrow();
    fixture.authority.admit.mockResolvedValue({ ok: false } as never);
    await expect(invoke()).rejects.toThrow();
  });
});


describe('real OAuth provider protocol integration', () => {
  it('completes DCR, consent, Google identity, PKCE token issue and refresh with ledger checks', async () => {
    const built = await build({ stdin: { contents: "export * from '@cloudflare/workers-oauth-provider'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'cloudflare-base', setup(plugin) { plugin.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'cloudflare-base', namespace: 'shim' })); plugin.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({ contents: 'export class WorkerEntrypoint {}' })); } }] });
    const real = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`) as typeof import('@cloudflare/workers-oauth-provider');
    const store = new Map<string, string>();
    const kv = {
      async get(key: string, options?: { type?: string }) { const value = store.get(key); return value === undefined ? null : options?.type === 'json' ? JSON.parse(value) : value; },
      async put(key: string, value: string) { store.set(key, value); }, async delete(key: string) { store.delete(key); },
      async list(options: { prefix?: string } = {}) { return { keys: [...store.keys()].filter(key => key.startsWith(options.prefix ?? '')).map(name => ({ name })), list_complete: true, cacheStatus: null }; },
    };
    let upstreamFetch: typeof fetch = async () => { throw new Error('Not ready'); };
    let active = false; let revokedConnection: string | undefined;
    const connections = new Set<string>();
    const authority = { async createPendingGrant() { return { ok: true }; }, async activateGrant(grantId: string) { active = true; connections.add(grantId); return { ok: true }; }, async admit(grantId: string) { return connections.has(grantId) && grantId !== revokedConnection ? { ok: true, admission: { scopes: ['teach:read'] } } : { ok: false }; } };
    const env = { OAUTH_KV: kv, GOOGLE_CLIENT_SECRET: 'synthetic', SECURITY_LEDGER: { idFromName: () => 'id', get: () => authority } } as unknown as HostedOAuthEnv;
    const wrapper = createHostedOAuth(config, { fetch: async (_request, _env, ctx) => Response.json({ connectionId: ctx.props.connectionId, audience: ctx.auth.audience }) }, { now: () => 1_800_000_000, fetch: (...args) => upstreamFetch(...args) });
    const realOptions = (wrapper as unknown as { options: import('@cloudflare/workers-oauth-provider').OAuthProviderOptions<HostedOAuthEnv> }).options;
    // The helper-boundary tests mock the package constructor. Bridge its error class to the
    // actual library class for this independently bundled protocol integration.
    const provider = new real.OAuthProvider<HostedOAuthEnv>({ ...realOptions, tokenExchangeCallback: async options => {
      try { await validateTokenGrant(config, options); } catch { throw new real.OAuthError('invalid_grant', { description: 'Connection is not authorised' }); }
    } });
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (value: Promise<unknown>) => pending.push(value), passThroughOnException() {} } as unknown as ExecutionContext;
    const call = (path: string, init?: RequestInit) => provider.fetch(new Request(`${config.origin}${path}`, init), env, ctx);
    const metadata = await call('/.well-known/oauth-authorization-server');
    expect(await metadata.json()).toMatchObject({ issuer: config.origin, authorization_endpoint: `${config.origin}/authorize`, token_endpoint: `${config.origin}/oauth/token` });
    const registration = await call('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Synthetic test', redirect_uris: ['http://localhost:9999/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) });
    expect(registration.status, await registration.clone().text()).toBe(201);
    const registered = await registration.json() as { client_id: string };
    const verifier = 'v'.repeat(64);
    const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
    const authorize = new URLSearchParams({ response_type: 'code', client_id: registered.client_id, redirect_uri: 'http://localhost:9999/callback', resource: `${config.origin}/mcp`, scope: 'teach:read', state: 'client-state', code_challenge: challenge, code_challenge_method: 'S256' });
    const consent = await call(`/authorize?${authorize}`);
    expect(consent.status, await consent.clone().text()).toBe(200);
    const handle = /name="handle" value="([^"]+)"/.exec(await consent.text())![1]!;
    const consentCookie = consent.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const google = await call('/authorize', { method: 'POST', headers: { Origin: config.origin, Cookie: consentCookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle, decision: 'approve', scope: 'teach:read' }) });
    expect(google.status, await google.clone().text()).toBe(200);
    const googleUrl = await linkFrom(google);
    const fixture = await callbackFixture({ nonce: googleUrl.searchParams.get('nonce') }); upstreamFetch = fixture.fetcher;
    const callback = await call(`/callback?${new URLSearchParams({ state: googleUrl.searchParams.get('state')!, code: 'google-code' })}`, { headers: { Cookie: google.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') } });
    expect(callback.status, await callback.clone().text()).toBe(302); expect(active).toBe(true);
    const clientRedirect = new URL(callback.headers.get('Location')!);
    const tokens = await call('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: clientRedirect.searchParams.get('code')!, client_id: registered.client_id, redirect_uri: 'http://localhost:9999/callback', code_verifier: verifier, resource: `${config.origin}/mcp` }) });
    expect(tokens.status, await tokens.clone().text()).toBe(200);
    const issued = await tokens.json() as { access_token: string; refresh_token: string };
    const firstRead = await call('/mcp', { headers: { Authorization: `Bearer ${issued.access_token}` } });
    expect(firstRead.status).toBe(200);
    const firstConnection = (await firstRead.json() as { connectionId: string }).connectionId;
    const secondConsent = await call(`/authorize?${authorize}`);
    const secondHandle = /name="handle" value="([^"]+)"/.exec(await secondConsent.text())![1]!;
    const secondGoogle = await call('/authorize', { method: 'POST', headers: { Origin: config.origin, Cookie: secondConsent.headers.getSetCookie().map(value => value.split(';')[0]).join('; '), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle: secondHandle, decision: 'approve', scope: 'teach:read' }) });
    const secondGoogleUrl = await linkFrom(secondGoogle);
    const secondFixture = await callbackFixture({ nonce: secondGoogleUrl.searchParams.get('nonce') }); upstreamFetch = secondFixture.fetcher;
    const secondCallback = await call(`/callback?${new URLSearchParams({ state: secondGoogleUrl.searchParams.get('state')!, code: 'second-google-code' })}`, { headers: { Cookie: secondGoogle.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') } });
    expect(secondCallback.status).toBe(302);
    const secondTokens = await call('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: new URL(secondCallback.headers.get('Location')!).searchParams.get('code')!, client_id: registered.client_id, redirect_uri: 'http://localhost:9999/callback', code_verifier: verifier, resource: `${config.origin}/mcp` }) });
    expect(secondTokens.status).toBe(200);
    const secondIssued = await secondTokens.json() as { access_token: string; refresh_token: string };
    // Reauthorizing the same client and redirect must preserve the first connection.
    expect((await call('/mcp', { headers: { Authorization: `Bearer ${issued.access_token}` } })).status).toBe(200);
    revokedConnection = firstConnection;
    const refresh = await call('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: issued.refresh_token, client_id: registered.client_id, resource: `${config.origin}/mcp` }) });
    expect(refresh.status).toBe(400); expect(await refresh.json()).toMatchObject({ error: 'invalid_grant' });
    const independentRefresh = await call('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: secondIssued.refresh_token, client_id: registered.client_id, resource: `${config.origin}/mcp` }) });
    expect(independentRefresh.status).toBe(200);
    await Promise.all(pending);
  });
});

describe('trusted initialization after verified Google owner identity', () => {
  it('runs the private owner hook after identity verification and before any grant is created', async () => {
    const fixture = await callbackFixture();
    const onVerifiedOwner = vi.fn(async (env: HostedOAuthEnv) => {
      expect(env).toBe(fixture.env);
      expect(fixture.fetcher).toHaveBeenCalledTimes(2);
      fixture.order.push('owner-initialized');
    });
    const handler = createAuthorizationHandler(config, { now: () => 1_800_000_000, fetch: fixture.fetcher, onVerifiedOwner });
    const response = await handler.fetch(new Request(`${config.origin}/callback?code=google-code`), fixture.env);
    expect(response.status).toBe(302);
    expect(onVerifiedOwner).toHaveBeenCalledTimes(1);
    expect(fixture.order).toEqual(['owner-initialized', 'pending', 'complete', 'active']);
  });

  it('never initializes an unverified or wrong owner', async () => {
    const fixture = await callbackFixture({ sub: 'another-user' });
    const onVerifiedOwner = vi.fn(async (_env: HostedOAuthEnv) => {});
    const handler = createAuthorizationHandler(config, { now: () => 1_800_000_000, fetch: fixture.fetcher, onVerifiedOwner });
    const response = await handler.fetch(new Request(`${config.origin}/callback?code=google-code`), fixture.env);
    expect(response.status).toBe(400);
    expect(onVerifiedOwner).not.toHaveBeenCalled();
    expect(fixture.order).toEqual([]);
  });

  it('fails closed without creating a grant or redirecting if trusted initialization fails', async () => {
    const fixture = await callbackFixture();
    const onVerifiedOwner = vi.fn(async (_env: HostedOAuthEnv) => { throw new Error('Private initialization failure'); });
    const handler = createAuthorizationHandler(config, { now: () => 1_800_000_000, fetch: fixture.fetcher, onVerifiedOwner });
    const response = await handler.fetch(new Request(`${config.origin}/callback?code=google-code`), fixture.env);
    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
    expect(await response.text()).not.toContain('Private initialization');
    expect(fixture.authority.createPendingGrant).not.toHaveBeenCalled();
    expect(fixture.helpers.completeAuthorization).not.toHaveBeenCalled();
  });
});

describe('secret-free callback failure stages', () => {
  it.each(['state_finish','google_token_exchange','google_jwks','google_identity','owner_authority','grant_create','grant_issue','grant_activate'] as const)('reports only the controlled %s code', async stage => {
    const failure = stage === 'grant_create' ? 'pending' : stage === 'grant_issue' ? 'complete' : stage === 'grant_activate' ? 'activation' : undefined;
    const fixture = await callbackFixture(stage === 'google_identity' ? {sub:'wrong-owner'} : {}, failure);
    const secret = 'never-log-token-code-claim-url';
    if(stage === 'state_finish') fixture.helpers.finishUpstream.mockRejectedValueOnce(new Error(secret));
    if(stage === 'google_token_exchange') fixture.fetcher.mockRejectedValueOnce(new Error(secret));
    // For the JWKS stage the token exchange must first succeed with the original signed fixture.
    let calls = 0;
    const fetcher:typeof fetch = stage === 'google_jwks' ? async (...args) => {
      calls++;
      if(calls === 2)throw new Error(secret);
      const valid = await callbackFixture();
      return valid.fetcher(args[0]);
    } : fixture.fetcher;
    const onFailureStage=vi.fn();
    const handler=createAuthorizationHandler(config,{now:()=>1_800_000_000,fetch:fetcher,onFailureStage,onVerifiedOwner:async()=>{if(stage==='owner_authority')throw new Error(secret);}});
    const response=await handler.fetch(new Request(`${config.origin}/callback?code=${secret}`),fixture.env);
    expect(response.status).toBe(400);expect(response.headers.get('Location')).toBeNull();
    expect(await response.text()).toBe('Authorization failed');
    expect(onFailureStage.mock.calls).toEqual([[stage]]);
    expect(JSON.stringify(onFailureStage.mock.calls)).not.toContain(secret);
  });
  it('does not change the public refusal when the diagnostic sink fails',async()=>{
    const fixture=await callbackFixture({nonce:'wrong'});
    const response=await createAuthorizationHandler(config,{now:()=>1_800_000_000,fetch:fixture.fetcher,onFailureStage:()=>{throw new Error('private logger detail');}}).fetch(new Request(`${config.origin}/callback?code=opaque`),fixture.env);
    expect(response.status).toBe(400);expect(await response.text()).toBe('Authorization failed');
  });
});
