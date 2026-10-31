import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.length === 1 && args[0] === '--check-only';
if (args.length > 0 && !checkOnly) {
  throw new Error('Usage: npm run deploy [-- --check-only]');
}
process.chdir(root);

const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const config = 'app/worker/wrangler.capture.jsonc';
const approval = '.state/deploy/capture-approval.json';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed with exit ${result.status}`);
  }
}

function output(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed with exit ${result.status}`);
  }
  return result.stdout.trim();
}

if (output('git', ['status', '--porcelain']) !== '') {
  throw new Error('The working tree is dirty. Commit or stash before deploying.');
}

console.log('1/5 · Typecheck and tests');
run('npm', ['run', 'check']);

console.log('2/5 · Build the capture bundle');
run('npm', ['run', 'build:capture']);

console.log('3/5 · Match the reviewed capture release evidence');
run('npm', ['run', 'release:check:capture', '--', approval]);

if (checkOnly) {
  console.log('Capture release checks passed. No migrations or deployment performed.');
  process.exit(0);
}

console.log('4/5 · Apply additive D1 migrations');
run(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'teach-capture', '--remote', '--config', config]);

console.log('5/5 · Deploy the capture Worker');
run(process.execPath, [wrangler, 'deploy', '--config', config]);

console.log('Verifying the deployed surface');
run(process.execPath, ['scripts/verify-deploy.mjs']);
