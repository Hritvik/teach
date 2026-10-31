import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=new URL('../app/worker/migrations/',import.meta.url);
/** Development/test-only migration loader; production uses reviewed Wrangler D1 migrations. */
export async function applyLocalMigrations(db:D1Database):Promise<void>{
 const hasMeta=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").first();
 if(hasMeta){const meta=await db.prepare('SELECT schema_version FROM meta WHERE singleton=1').first<{schema_version:number}>();if(meta?.schema_version!==1)throw new Error('Forward-only migration requires a compatible runtime');}
 await db.prepare('CREATE TABLE IF NOT EXISTS __teach_local_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL)').run();
 const names=(await readdir(folder)).filter(name=>/^\d{4}_[a-z_]+\.sql$/.test(name)).sort();
 for(const name of names){
  const sql=await readFile(new URL(name,folder),'utf8');const hash=createHash('sha256').update(sql).digest('hex');
  const recorded=await db.prepare('SELECT sha256 FROM __teach_local_migrations WHERE name=?').bind(name).first<{sha256:string}>();
  if(recorded){if(recorded.sha256!==hash)throw new Error('Applied migration content changed');continue;}
  const statements=name==='0001_foundation.sql'&&hasMeta?[]:sql.split(';').filter(part=>part.trim()).map(part=>db.prepare(part));
  await db.batch([...statements,db.prepare('INSERT INTO __teach_local_migrations(name,sha256) VALUES(?,?)').bind(name,hash)]);
 }
}
