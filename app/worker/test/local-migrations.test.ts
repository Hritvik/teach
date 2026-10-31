import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {runtime} from '../../../tests/runtime.ts';
import {applyLocalMigrations} from '../../../scripts/local-migrations.ts';
let instance:Awaited<ReturnType<typeof runtime>>;
beforeAll(async()=>{instance=await runtime();});afterAll(async()=>{await instance?.mf.dispose();});
describe('local additive migration loader',()=>{
 it('applies assessment migration exactly once and rejects changed or future versions',async()=>{
  const db=instance.env.LEARNING_DB;
  expect(await db.prepare("SELECT name FROM sqlite_master WHERE name='item_offers'").first('name')).toBe('item_offers');
  await applyLocalMigrations(db);
  expect(await db.prepare('SELECT COUNT(*) AS n FROM __teach_local_migrations').first('n')).toBe(2);
  await db.prepare("UPDATE __teach_local_migrations SET sha256='wrong' WHERE name='0002_assessment.sql'").run();
  await expect(applyLocalMigrations(db)).rejects.toThrow('Applied migration content changed');
  await db.prepare('UPDATE meta SET schema_version=2').run();
  await expect(applyLocalMigrations(db)).rejects.toThrow('Forward-only');
 });
});
