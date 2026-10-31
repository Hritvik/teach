import { beforeAll, describe, expect, it } from 'vitest';
import { verifyGoogleIdentity, verifyAccessIdentity, type TrustedJwks } from '../src/auth/identity.ts';
const now = 1_800_000_000;
const issuer = 'https://accounts.google.com';
let pair: CryptoKeyPair;
let keys: TrustedJwks;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(patch: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const content = `${encode({ alg: 'RS256', kid: 'key-one', ...header })}.${encode({ iss: issuer, aud: 'teach-client', sub: 'google-owner', email: 'owner@example.test', email_verified: true, nonce: 'fresh-nonce', iat: now - 10, exp: now + 300, ...patch })}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(content));
  return `${content}.${Buffer.from(signature).toString('base64url')}`;
}
const google = () => ({ jwks: keys, issuer, audience: 'teach-client', subject: 'google-owner', email: 'owner@example.test', nonce: 'fresh-nonce', learnerId: 'learner-one', now });
beforeAll(async () => {
  pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  keys = { keys: [{ ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'key-one', alg: 'RS256', use: 'sig' }] };
});
describe('trusted identity verification', () => {
  it('maps a verified Google owner and preserves its identity namespace', async () => {
    expect(await verifyGoogleIdentity(await token({}, { typ: 'JWT' }), google())).toEqual({ learnerId: 'learner-one', issuer, subject: 'google-owner', email: 'owner@example.test', provider: 'google' });
  });
  it.each([
    { iss: 'https://evil.test' }, { aud: 'other-client' }, { sub: 'other-user' },
    { email: 'other@example.test' }, { email_verified: false }, { email_verified: 'true' },
    { nonce: 'replayed-nonce' }, { exp: now }, { exp: 'future' }, { iat: now + 1 },
    { iat: undefined }, { azp: 'another-client' }, { sub: '' }, { aud: ['teach-client', 'another-client'] }, { nbf: now + 1 },
  ])('denies invalid owner claims %j', async patch => {
    await expect(verifyGoogleIdentity(await token(patch), google())).rejects.toThrow('Identity verification failed');
  });
  it.each([{ alg: 'none' }, { alg: 'HS256' }, { kid: 'unknown' }, { crit: ['unknown'] }, { jku: 'https://evil.test/keys' }, { jwk: {} }, { x5u: 'https://evil.test/key' }, { typ: 'not-a-JWT' }])('denies unsafe headers %j', async header => {
    await expect(verifyGoogleIdentity(await token({}, header), google())).rejects.toThrow('Identity verification failed');
  });
  it('rejects invalid signatures, malformed and over-limit tokens', async () => {
    const valid = await token();
    const [head, body, sig] = valid.split('.');
    await expect(verifyGoogleIdentity(`${head}.${body}.${sig?.[0] === 'A' ? 'B' : 'A'}${sig?.slice(1)}`, google())).rejects.toThrow();
    for (const invalid of ['', 'abc.def', 'a.b.c', '.'.repeat(17000), valid + '=']) await expect(verifyGoogleIdentity(invalid, google())).rejects.toThrow('Identity verification failed');
  });
  it('rejects duplicate, private or non-signing trusted key entries', async () => {
    const key = keys.keys[0]!;
    for (const jwks of [{ keys: [key, key] }, { keys: [{ ...key, d: 'private' }] }, { keys: [{ ...key, use: 'enc' }] }, { keys: [{ ...key, alg: 'RS512' }] }, { keys: [{ ...key, kty: 'EC' }] }, { keys: [{ ...key, key_ops: ['sign'] }] }, { keys: [{ ...key, n: 'AA' }] }]) {
      await expect(verifyGoogleIdentity(await token(), { ...google(), jwks })).rejects.toThrow('Identity verification failed');
    }
  });
  it('checks configuration instead of accepting missing owner constraints', async () => {
    for (const patch of [{ nonce: '' }, { subject: '' }, { email: '' }, { learnerId: '' }, { now: NaN }, { issuer: 'http://accounts.google.com' }]) await expect(verifyGoogleIdentity(await token(), { ...google(), ...patch })).rejects.toThrow();
  });
  it('maps Access email without confusing Access subject with Google subject', async () => {
    const accessIssuer = 'https://teach.cloudflareaccess.com';
    const options = { jwks: keys, issuer: accessIssuer, audience: 'control-audience', email: 'owner@example.test', learnerId: 'learner-one', now };
    const jwt = await token({ iss: accessIssuer, aud: ['control-audience'], sub: 'different-access-subject', email_verified: undefined, nonce: undefined });
    expect(await verifyAccessIdentity(jwt, options)).toMatchObject({ provider: 'access', subject: 'different-access-subject', learnerId: 'learner-one' });
    await expect(verifyAccessIdentity(jwt, { ...options, audience: 'wrong' })).rejects.toThrow();
    await expect(verifyAccessIdentity(jwt, { ...options, email: 'not-owner@example.test' })).rejects.toThrow();
    await expect(verifyGoogleIdentity(jwt, google())).rejects.toThrow();
  });
});
