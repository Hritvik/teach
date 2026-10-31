import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
if (process.argv.length !== 2) throw new Error('This build accepts no entrypoint overrides');
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['app/worker/src/production.ts'], bundle: true, format: 'esm', platform: 'browser',
  target: 'es2023', outfile: 'dist/worker.mjs', external: ['cloudflare:workers'] });
const source = await readFile('dist/worker.mjs', 'utf8');
if (/TEACH_DEV_|synthetic-development|development-token/.test(source)) throw new Error('Development identity leaked into production bundle');
console.log('Production entry built; hosted access requires private configuration and release approval.');
