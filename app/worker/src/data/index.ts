import { createSchedulerManifest } from '@teach/domain';
import { DataError } from './errors';
export * from './types';
export { createRepository } from './repository';
export async function initialise(db: D1Database, options: { readonly learnerId: string; readonly timezone?: string; readonly generation?: number }): Promise<void> {
  const meta = await db.prepare('SELECT schema_version,generation FROM meta WHERE singleton=1').first<{ schema_version: number; generation: number }>();
  if (!meta || meta.schema_version !== 1) throw new DataError('INCOMPATIBLE_VERSION', 'Migrate a compatible local database first');
  const existing = await db.prepare('SELECT id FROM learners LIMIT 1').first<{ id: string }>();
  if (existing && existing.id !== options.learnerId) throw new DataError('FORBIDDEN', 'This learning store belongs to another learner');
  if (existing) return;
  const timezone = options.timezone ?? 'Asia/Kolkata'; new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const manifest = createSchedulerManifest();
  await db.batch([
    db.prepare('INSERT INTO learners(id,timezone) VALUES(?,?)').bind(options.learnerId, timezone),
    db.prepare('INSERT INTO rules_manifests(id,rules_json,scheduler_engine,engine_build_hash,parameters_json) VALUES(1,?,?,?,?)').bind(JSON.stringify({ version: 1, strongDays: 2, balanceUrgent: 70 }), 'ts-fsrs@6.0.0', 'sha512-kX03GIEhXgBtUrgZuv7k7Aax8oYF3GCO0lASqJFw/8cvvI7qjE83J8IzFhHugux7//W0yquG7zidk3e9NRgEwg==', JSON.stringify(manifest)),
    db.prepare('UPDATE meta SET generation=? WHERE singleton=1 AND schema_version=1').bind(options.generation ?? 1),
  ]);
}

export {loadAssessmentJob} from './assessment.ts';
