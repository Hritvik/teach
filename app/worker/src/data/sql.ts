import type { Context, Row, SqlEffect } from './types';
import { DataError, invalid } from './errors';
export const SEQ = Symbol('event sequence');
type Value = string | number | null | typeof SEQ;
export function insert(table: string, record: Readonly<Record<string, Value>>, suffix = ''): SqlEffect {
  const entries = Object.entries(record);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(',')}) SELECT ${entries.map(([, value]) => value === SEQ ? '__SEQ__' : '?').join(',')} WHERE __GUARD__ ${suffix}`, args: entries.flatMap(([, value]) => value === SEQ ? [] : [value]) };
}
export function update(table: string, id: string, values: Readonly<Record<string, string | number | null>>): SqlEffect {
  return { sql: `UPDATE ${table} SET ${Object.keys(values).map(key => `${key}=?`).join(',')},version=version+1,updated_seq=__SEQ__ WHERE id=? AND __GUARD__`, args: [...Object.values(values), id] };
}
export async function rows(db: D1Database, sql: string, args: readonly (string | number | null)[] = []): Promise<Row[]> {
  return (await db.prepare(sql).bind(...args).all<Row>()).results;
}
type EntityContext = Pick<Context, 'db' | 'actor'> & Partial<Pick<Context, 'envelope'>>;
export async function entity(ctx: EntityContext, table: string, id: string, requireVersion = false): Promise<Row> {
  const row = await ctx.db.prepare(`SELECT * FROM ${table} WHERE id=? AND learner_id=?`).bind(id, ctx.actor.learner_id).first<Row>();
  if (!row) invalid('Referenced record does not exist');
  const expected = ctx.envelope?.expected[id];
  if ((requireVersion && expected === undefined) || (expected !== undefined && expected !== row.version)) throw new DataError('VERSION_CONFLICT', 'Record version changed or expected version is missing', { [id]: Number(row.version) });
  return row;
}
export async function canonicalConcept(ctx: EntityContext, conceptId: string): Promise<Row> {
  let current = conceptId;
  const seen = new Set<string>();
  for (;;) {
    if (seen.has(current)) invalid('Invalid concept redirect cycle'); seen.add(current);
    const record = await entity(ctx, 'concepts', current);
    if (!record.merged_into) return record;
    current = String(record.merged_into);
  }
}
export async function session(ctx: Context, id = ctx.envelope.session_id, own = true, allowClosed = false): Promise<Row> {
  if (!id) invalid('This operation requires a session');
  const row = await entity(ctx, 'sessions', id);
  if (!allowClosed && row.state !== 'open') invalid('Session is closed');
  if (own && !await ctx.db.prepare('SELECT 1 FROM session_agents WHERE session_id=? AND connection_id=?').bind(id, ctx.actor.connection_id).first()) throw new DataError('FORBIDDEN', 'Resume this session before writing its records');
  return row;
}
export function common(ctx: Context, id: string) { return { id, learner_id: ctx.actor.learner_id, version: 1, created_seq: SEQ, updated_seq: SEQ } as const; }
export function localDay(at: string, timezone: string): string { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at)); }
