import OAuthProvider, { AuthorizationError, CimdFetchError, OAuthError, type AuthRequest, type OAuthHelpers, type TokenExchangeCallbackOptions, type OAuthResourceContext } from '@cloudflare/workers-oauth-provider';
import type { SecurityLedger } from '../security/index.ts';
import { verifyGoogleIdentity, type TrustedJwks } from './identity.ts';

export interface HostedOAuthConfig {
  readonly origin: string; readonly learnerId: string; readonly googleIssuer: string;
  readonly googleSubject: string; readonly ownerEmail: string; readonly googleClientId: string;
}
export interface HostedOAuthEnv {
  readonly LEARNING_DB: D1Database; readonly OAUTH_KV: KVNamespace; readonly OAUTH_PROVIDER: OAuthHelpers;
  readonly SECURITY_LEDGER: DurableObjectNamespace<SecurityLedger>;
  readonly GOOGLE_CLIENT_SECRET: string;
}
export interface OAuthProps { readonly learnerId: string; readonly connectionId: string; }
export type OAuthFailureStage = 'state_finish'|'google_token_exchange'|'google_jwks'|'google_identity'|'owner_authority'|'grant_create'|'grant_issue'|'grant_activate';
export interface OAuthDependencies { readonly fetch?: typeof fetch; readonly now?: () => number; readonly onVerifiedOwner?: (env: HostedOAuthEnv) => Promise<void>; readonly onFailureStage?: (stage: OAuthFailureStage) => void; }
const scopes = ['teach:read', 'teach:learn', 'teach:organize'];
const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
function validate(config: HostedOAuthConfig) {
  const u = new URL(config.origin);
  if (u.protocol !== 'https:' || u.origin !== config.origin || u.username || u.password || config.googleIssuer !== 'https://accounts.google.com'
    || !config.learnerId || !config.googleSubject || !config.ownerEmail || !config.googleClientId) throw new Error('Invalid hosted identity configuration');
}
function ledger(env: HostedOAuthEnv, config: HostedOAuthConfig) {
  return env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));
}
function validRequest(auth: AuthRequest, config: HostedOAuthConfig) {
  if (auth.codeChallengeMethod !== 'S256' || !auth.codeChallenge || auth.resource !== `${config.origin}/mcp`
    || !auth.scope.includes('teach:read') || auth.scope.some(scope => !scopes.includes(scope))) throw new Error('Invalid authorization request');
}
function page(details: { clientName: string; clientDomain?: string; redirectHost: string; redirectIsLoopback: boolean; scope: string[] }, handle: string) {
  const options = details.scope.filter(scope => scopes.includes(scope)).map(scope => `<label><input type="checkbox" name="scope" value="${escape(scope)}" checked>${escape(scope)}</label>`).join('<br>');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Teach connection</title><main><h1>Connect ${escape(details.clientName)} to Teach?</h1><p>${details.clientDomain ? `Publisher: ${escape(details.clientDomain)}` : 'Client name is unverified.'}</p><p>Access returns to ${escape(details.redirectHost)}.</p>${details.redirectIsLoopback ? '<p>Continue only if you started this sign-in from your computer.</p>' : ''}<form method="post"><input type="hidden" name="handle" value="${escape(handle)}">${options}<button name="decision" value="approve">Allow</button><button name="decision" value="deny">Deny</button></form></main>`;
}
/** A link navigation avoids form-action restrictions on cross-origin POST redirects. */
function continuation(headers: Headers, target: string, label: string): Response {
  headers.delete('Location');
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Security-Policy', "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Teach sign-in</title><main><p><a href="${escape(target)}">${escape(label)}</a></p></main>`, { headers });
}
async function boundedText(request: { body: ReadableStream<Uint8Array> | null }, max: number): Promise<string> {
  const reader = request.body?.getReader(); if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength;
      if (size > max) { await reader.cancel(); throw new RangeError('Too large'); } chunks.push(next.value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally { reader.releaseLock(); }
}
async function upstreamJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) {
    // Google's error body names the refusal (for example invalid_grant) and never
    // contains the authorization code, client secret or token. Keep it short and
    // single-line so it is safe to emit to Worker logs.
    let detail = '';
    try { detail = (await boundedText(response, 4096)).replace(/\s+/g, ' ').slice(0, 300); } catch { /* Body unavailable. */ }
    console.warn(`Teach ${label} failed: ${response.status} ${detail}`);
    throw new Error('Upstream unavailable');
  }
  return JSON.parse(await boundedText(response, 65536));
}
async function googleIdentity(config: HostedOAuthConfig, env: HostedOAuthEnv, code: string, nonce: string, deps: OAuthDependencies, stage: (value: OAuthFailureStage) => void) {
  stage('google_token_exchange');
  if (!env.GOOGLE_CLIENT_SECRET) throw new Error('Upstream not configured');
  const fetcher = deps.fetch ?? fetch;
  let response: Response;
  try { response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.googleClientId, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: `${config.origin}/callback`, grant_type: 'authorization_code' }) }); }
  catch (error) { console.warn(`Teach google token exchange request failed: ${error instanceof Error ? error.name : 'unknown'}`); throw error; }
  const token = await upstreamJson(response, 'google token exchange');
  if (!token || typeof token !== 'object' || !('id_token' in token) || typeof token.id_token !== 'string') throw new Error('Missing identity');
  stage('google_jwks');
  let certs: Response;
  try { certs = await fetcher('https://www.googleapis.com/oauth2/v3/certs', { redirect: 'error', signal: AbortSignal.timeout(5000) }); }
  catch (error) { console.warn(`Teach google jwks request failed: ${error instanceof Error ? error.name : 'unknown'}`); throw error; }
  const jwks = await upstreamJson(certs, 'google jwks');
  if (!jwks || typeof jwks !== 'object' || !('keys' in jwks) || !Array.isArray(jwks.keys)) throw new Error('Invalid keys');
  stage('google_identity');
  return verifyGoogleIdentity(token.id_token, { jwks: jwks as TrustedJwks, issuer: config.googleIssuer, subject: config.googleSubject, audience: config.googleClientId, email: config.ownerEmail, learnerId: config.learnerId, nonce, now: (deps.now ?? (() => Math.floor(Date.now() / 1000)))() });
}
export function createAuthorizationHandler(config: HostedOAuthConfig, deps: OAuthDependencies = {}) {
  validate(config);
  return { async fetch(request: Request, env: HostedOAuthEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.origin !== config.origin) return new Response('Invalid origin', { status: 403 });
    let failureStage: OAuthFailureStage = 'state_finish';
    try {
      const oauth = env.OAUTH_PROVIDER;
      if (url.pathname === '/authorize' && request.method === 'GET') {
        const auth = await oauth.parseAuthRequest(request); validRequest(auth, config);
        const details = await oauth.describeConsent(auth); const consent = await oauth.beginConsent(auth);
        consent.headers.set('Content-Type', 'text/html; charset=utf-8');
        consent.headers.set('Content-Security-Policy', "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
        return new Response(page(details, consent.handle), { headers: consent.headers });
      }
      if (url.pathname === '/authorize' && request.method === 'POST') {
        if (request.headers.get('Origin') !== config.origin) return new Response('Invalid origin', { status: 403 });
        if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return new Response('Form required', { status: 415 });
        const form = new URLSearchParams(await boundedText(request, 8192));
        if (form.getAll('handle').length !== 1) throw new Error('Invalid consent');
        const handle = form.get('handle')!;
        if (form.get('decision') !== 'approve') { const denied = await oauth.denyConsent(request, handle); const target = denied.headers.get('Location'); if (!target) throw new Error('Missing client redirect'); return continuation(denied.headers, target, 'Return to the requesting app'); }
        // Recover the original request before restricting scopes; helper options can otherwise expand them.
        const approved = await oauth.approveConsent(request, handle); validRequest(approved.request, config);
        const selected = new Set(form.getAll('scope'));
        const scope = approved.request.scope.filter(s => selected.has(s) && scopes.includes(s));
        if (!scope.includes('teach:read')) throw new Error('Read access required');
        const nonce = crypto.randomUUID();
        const upstream = await oauth.beginUpstream({ ...approved.request, scope }, { data: { nonce }, headers: approved.headers });
        const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        target.search = new URLSearchParams({ client_id: config.googleClientId, redirect_uri: `${config.origin}/callback`, response_type: 'code', scope: 'openid email', state: upstream.state, nonce }).toString();
        return continuation(upstream.headers, target.href, 'Continue to Google sign-in');
      }
      if (url.pathname === '/callback' && request.method === 'GET') {
        const resumed = await oauth.finishUpstream<{ nonce: string }>(request); validRequest(resumed.request, config);
        if (url.searchParams.has('error')) return new Response('Sign-in declined', { status: 403, headers: resumed.headers });
        const code = url.searchParams.get('code');
        if (!code || code.length > 2048 || url.searchParams.getAll('code').length !== 1 || typeof resumed.data.nonce !== 'string') throw new Error('Invalid callback');
        const identity = await googleIdentity(config, env, code, resumed.data.nonce, deps, value => { failureStage = value; });
        // Trusted operator wiring may initialize owner authority only after all identity checks pass.
        failureStage = 'owner_authority';
        await deps.onVerifiedOwner?.(env);
        const connectionId = crypto.randomUUID(); const authority = ledger(env, config);
        failureStage = 'grant_create';
        const pending = await authority.createPendingGrant({ grantId: connectionId, clientId: resumed.request.clientId, subject: identity.subject, scopes: resumed.request.scope });
        if (!pending.ok) throw new Error('Grant registration denied');
        failureStage = 'grant_issue';
        const result = await oauth.completeAuthorization({ request: resumed.request, userId: config.learnerId, metadata: {}, revokeExistingGrants: false, scope: resumed.request.scope, props: { learnerId: config.learnerId, connectionId } satisfies OAuthProps });
        failureStage = 'grant_activate';
        if (!(await authority.activateGrant(connectionId)).ok) throw new Error('Grant activation denied');
        resumed.headers.set('Location', result.redirectTo); return new Response(null, { status: 302, headers: resumed.headers });
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      // Only a closed stage code reaches operator diagnostics; never pass the caught error or request.
      try { await deps.onFailureStage?.(failureStage); } catch { /* Diagnostics cannot change authentication refusal. */ }
      if (error instanceof RangeError) return new Response('Body too large', { status: 413 });
      if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
      if (error instanceof CimdFetchError) return new Response('Client metadata could not be verified', { status: 400 });
      return new Response('Authorization failed', { status: 400 });
    }
  } };
}
export async function validateTokenGrant(config: HostedOAuthConfig, options: TokenExchangeCallbackOptions<HostedOAuthEnv>) {
  const props = options.props as Partial<OAuthProps> | null;
  if (!props || props.learnerId !== config.learnerId || typeof props.connectionId !== 'string' || !props.connectionId
    || options.userId !== config.learnerId || options.resource !== `${config.origin}/mcp` || options.clientId !== options.subjectClientId
    || options.requestedScope.some(scope => !scopes.includes(scope))) throw new OAuthError('invalid_grant', { description: 'Connection is not authorised' });
  const admitted = await ledger(options.env, config).admit(props.connectionId, ['teach:read']);
  if (!admitted.ok || options.requestedScope.some(scope => !admitted.admission.scopes.includes(scope))) throw new OAuthError('invalid_grant', { description: 'Connection is not authorised' });
}
export function createHostedOAuth(config: HostedOAuthConfig, apiHandler: { fetch(request: Request, env: HostedOAuthEnv, ctx: OAuthResourceContext<OAuthProps>): Response | Promise<Response> }, deps: OAuthDependencies = {}) {
  validate(config);
  return new OAuthProvider<HostedOAuthEnv>({ apiRoute: `${config.origin}/mcp`, apiHandler: { fetch: (request, env, ctx) => apiHandler.fetch(request, env, ctx as OAuthResourceContext<OAuthProps>) }, defaultHandler: createAuthorizationHandler(config, deps),
    authorizeEndpoint: `${config.origin}/authorize`, tokenEndpoint: `${config.origin}/oauth/token`, clientRegistrationEndpoint: `${config.origin}/register`,
    scopesSupported: scopes, requiredScopes: ['teach:read'], resourceMetadata: { resource: `${config.origin}/mcp`, authorization_servers: [config.origin] },
    clientIdMetadataDocumentEnabled: true, accessTokenTTL: 3600, refreshTokenTTL: 2_592_000,
    tokenExchangeCallback: options => validateTokenGrant(config, options),
  });
}
