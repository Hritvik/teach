const origin = 'https://teach-mcp.hritvikdinkar.workers.dev';
const timeout = AbortSignal.timeout(15_000);

async function get(path) {
  return fetch(origin + path, { redirect: 'manual', signal: timeout });
}

const health = await get('/health');
if (health.status !== 200) {
  throw new Error(`/health returned ${health.status}, expected 200`);
}
const healthBody = await health.json();
if (healthBody?.status !== 'ok') {
  throw new Error(`/health returned ${JSON.stringify(healthBody)}, expected {"status":"ok"}`);
}

const mcp = await get('/mcp');
if (mcp.status !== 401) {
  throw new Error(`/mcp returned ${mcp.status}, expected 401 without a bearer token`);
}
const challenge = mcp.headers.get('www-authenticate') ?? '';
if (!challenge.includes('resource_metadata')) {
  throw new Error('/mcp did not advertise OAuth resource metadata');
}

const metadata = await get('/.well-known/oauth-protected-resource/mcp');
if (metadata.status !== 200) {
  throw new Error(`OAuth resource metadata returned ${metadata.status}, expected 200`);
}
const metadataBody = await metadata.json();
if (metadataBody?.resource !== `${origin}/mcp`) {
  throw new Error(`OAuth resource metadata names ${String(metadataBody?.resource)}, expected ${origin}/mcp`);
}

console.log(`Deployment verified: ${origin}`);
console.log('  /health        200 ok');
console.log('  /mcp           401 OAuth challenge');
console.log('  metadata       200 for /mcp');
