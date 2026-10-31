import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyLocalMigrations } from './local-migrations.ts';
if (process.argv.length !== 2) throw new Error('Development runner accepts no host/config overrides');
const root = resolve('.state');
await mkdir(root, { recursive: true, mode: 0o700 });
const tokenFile = resolve(root, 'development-token');
let token;
try { token = (await readFile(tokenFile, 'utf8')).trim(); }
catch (error) { if (error.code !== 'ENOENT') throw error; token = randomBytes(32).toString('hex'); await writeFile(tokenFile, token + '\n', { mode: 0o600 }); }
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid development token file; restore a private generated token');
await chmod(tokenFile, 0o600);
const [worker] = await Promise.all([
  build({ entryPoints: ['app/worker/src/dev.ts'], bundle: true, write: false, format: 'esm', platform: 'browser',
    target: 'es2023', external: ['cloudflare:workers'] }),
  build({ entryPoints: ['app/worker/src/data/index.ts'], bundle: true, format: 'esm', platform: 'node',
    outfile: resolve(root, 'bootstrap.mjs'), target: 'node26' }),
]);
const contents = worker.outputFiles[0]?.text;
if (!contents) throw new Error('Worker bundle missing');
const learnerId = 'l_11111111-1111-4111-8111-111111111111';
const grantId = 'synthetic-development';
const mf = new Miniflare({ ...convertV4MiniflareOptions({
  name: 'teach-development', modules: true, script: contents, compatibilityDate: '2026-10-01',
  compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 8788,
  d1Databases: { LEARNING_DB: 'teach-synthetic-development' },
  durableObjects: { SECURITY_LEDGER: { className: 'SecurityLedger', useSQLite: true } },
  bindings: { TEACH_DEV_TOKEN: token, TEACH_DEV_LEARNER: learnerId, TEACH_DEV_GRANT: grantId },
}), resourcePersistencePath: resolve(root, 'runtime') });
try {
  const bindings = await mf.getBindings();
  const db = bindings.LEARNING_DB;
  await applyLocalMigrations(db);
  const { initialise } = await import(pathToFileURL(resolve(root, 'bootstrap.mjs')).href);
  await initialise(db, { learnerId });
  const ledger = bindings.SECURITY_LEDGER.get(bindings.SECURITY_LEDGER.idFromName(learnerId));
  const bootstrapped = await ledger.bootstrap(learnerId, grantId, ['teach:read','teach:learn','teach:organize']);
  if (!bootstrapped.ok) throw new Error('Synthetic ledger bootstrap refused');
  console.log('Synthetic development MCP: http://127.0.0.1:8788/mcp');
  console.log(`Bearer token kept private in ${tokenFile}; do not commit or paste it into chats.`);
  console.log('Development/testing only; no remote resources or user tracker configured.');
} catch (error) { await mf.dispose(); throw error; }
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, async () => { await mf.dispose(); process.exit(0); });
