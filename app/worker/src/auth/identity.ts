/** Keys must come from a separately configured trusted issuer, never a JWT-provided URL. */
export interface TrustedJwk extends JsonWebKey { readonly kid?: string; }
export interface TrustedJwks { readonly keys: readonly TrustedJwk[]; }
export interface IdentityPolicy {
  readonly jwks: TrustedJwks;
  readonly issuer: string;
  readonly audience: string;
  readonly email: string;
  readonly learnerId: string;
  /** Unix seconds. Explicit injection keeps fake-issuer tests independent of wall time. */
  readonly now: number;
}
export interface GoogleIdentityPolicy extends IdentityPolicy { readonly subject: string; readonly nonce: string; }
export interface VerifiedIdentity {
  readonly learnerId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly email: string;
  readonly provider: 'google' | 'access';
}
const denied = () => new Error('Identity verification failed');
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024;
function bytes(segment: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw denied();
  const decoded = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
  const encoded = btoa(decoded).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (encoded !== segment) throw denied();
  return Uint8Array.from(decoded, ch => ch.charCodeAt(0));
}
function object(segment: string): Record<string, unknown> {
  const result: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(segment)));
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw denied();
  return result as Record<string, unknown>;
}
function validatePolicy(policy: IdentityPolicy) {
  if (![policy.issuer, policy.audience, policy.email, policy.learnerId].every(text) || !Number.isSafeInteger(policy.now) || policy.now < 0) throw denied();
  const issuer = new URL(policy.issuer);
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash) throw denied();
}
async function verify(token: string, policy: IdentityPolicy): Promise<Record<string, unknown>> {
  validatePolicy(policy);
  if (typeof token !== 'string' || token.length > 16384) throw denied();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw denied();
  const [head, body, signature] = parts as [string, string, string];
  const header = object(head);
  if (header.alg !== 'RS256' || !text(header.kid) || header.crit !== undefined || header.jku !== undefined || header.jwk !== undefined || header.x5u !== undefined || (header.typ !== undefined && header.typ !== 'JWT')) throw denied();
  const matching = policy.jwks.keys.filter(key => key.kid === header.kid);
  if (matching.length !== 1) throw denied();
  const key = matching[0]!;
  if (key.kty !== 'RSA' || (key.alg !== undefined && key.alg !== 'RS256') || (key.use !== undefined && key.use !== 'sig') || ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'].some(field => field in key) || (key.key_ops !== undefined && (key.key_ops.length !== 1 || key.key_ops[0] !== 'verify'))) throw denied();
  if (!text(key.n) || !text(key.e) || bytes(key.n).byteLength < 256) throw denied();
  const imported = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', imported, bytes(signature), new TextEncoder().encode(`${head}.${body}`))) throw denied();
  const claims = object(body);
  if (claims.iss !== policy.issuer || !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) || Number(claims.exp) <= policy.now || Number(claims.iat) > policy.now || Number(claims.iat) > Number(claims.exp) || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || Number(claims.nbf) > policy.now)) || !text(claims.sub) || claims.email !== policy.email) throw denied();
  return claims;
}
function identity(claims: Record<string, unknown>, policy: IdentityPolicy, provider: VerifiedIdentity['provider']): VerifiedIdentity {
  return { learnerId: policy.learnerId, issuer: policy.issuer, subject: String(claims.sub), email: policy.email, provider };
}
export async function verifyGoogleIdentity(token: string, policy: GoogleIdentityPolicy): Promise<VerifiedIdentity> {
  try {
    if (!text(policy.subject) || !text(policy.nonce)) throw denied();
    const claims = await verify(token, policy);
    if (claims.aud !== policy.audience || claims.sub !== policy.subject || claims.nonce !== policy.nonce || claims.email_verified !== true || (claims.azp !== undefined && claims.azp !== policy.audience)) throw denied();
    return identity(claims, policy, 'google');
  } catch { throw denied(); }
}
export async function verifyAccessIdentity(token: string, policy: IdentityPolicy): Promise<VerifiedIdentity> {
  try {
    const claims = await verify(token, policy);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.length || audiences.some(a => !text(a)) || !audiences.includes(policy.audience)) throw denied();
    return identity(claims, policy, 'access');
  } catch { throw denied(); }
}
