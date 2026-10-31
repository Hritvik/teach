import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { applyLocalMigrations } from '../scripts/local-migrations.ts';
import { fileURLToPath } from 'node:url';
import { initialise } from '../app/worker/src/data/index.ts';
import type { DevelopmentEnv } from '../app/worker/src/env.ts';

export const learnerId = 'l_11111111-1111-4111-8111-111111111111';
export const grantId = 'synthetic-development';
export const token = 'test-only-bearer-not-a-live-credential';
export async function runtime(persistRoot?: string) {
  const built = await build({
    entryPoints: [fileURLToPath(new URL('../app/worker/src/dev.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2023',
    external: ['cloudflare:workers'],
  });
  const contents = built.outputFiles[0]?.text;
  if (!contents) throw new Error('Worker build produced no output');
  const mf = new Miniflare({ ...convertV4MiniflareOptions({
    name: 'teach-test', modules: true, script: contents, compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: { LEARNING_DB: 'teach-synthetic' },
    durableObjects: { SECURITY_LEDGER: { className: 'SecurityLedger', useSQLite: true } },
    bindings: { TEACH_DEV_TOKEN: token, TEACH_DEV_LEARNER: learnerId, TEACH_DEV_GRANT: grantId },
  }), ...(persistRoot ? { resourcePersistencePath: persistRoot } : {}) });
  const env = await mf.getBindings<DevelopmentEnv>();
  await applyLocalMigrations(env.LEARNING_DB);
  await initialise(env.LEARNING_DB, { learnerId });
  const ledger = env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(learnerId));
  await ledger.bootstrap(learnerId, grantId, ['teach:read', 'teach:learn', 'teach:organize']);
  return { mf, env, ledger };
}
