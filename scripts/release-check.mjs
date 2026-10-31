import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateRelease } from '../app/worker/src/release.ts';
import { resolve, relative } from 'node:path';
if(process.argv.length!==3)throw new Error('Usage: npm run release:check -- /private/path/reviewed-release.json');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(resolve(dir,e.name)):resolve(dir,e.name)))).flat();}
const paths=[...await files('app'),...await files('scripts'),...await files('tests'),...await files('evals'),...['package.json','package-lock.json','tsconfig.json','vitest.config.ts'].map(p=>resolve(p))].sort();
const entries=await Promise.all(paths.map(async path=>[relative(process.cwd(),path),digest(await readFile(path))]));
const bundle=await readFile('dist/worker.mjs');
if(/TEACH_DEV_|synthetic-development|development-token/.test(bundle.toString()))throw new Error('Development code in release');
const migrations=Object.fromEntries(entries.filter(([path])=>path.startsWith('app/worker/migrations/')).map(([path,sha])=>[path.slice('app/worker/migrations/'.length),sha]));
const current={sourceHash:digest(JSON.stringify(entries)),bundleHash:digest(bundle),migrations};
const approval=JSON.parse(await readFile(process.argv[2],'utf8'));
if(approval.inspect===true){console.log(JSON.stringify(current,null,2));throw new Error('Inspection only; no release approved');}
validateRelease(approval,current);
console.log('Reviewed release evidence matches this source tree and bundle. No deployment performed.');
