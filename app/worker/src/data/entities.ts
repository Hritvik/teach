import type { Context, Plan, Row, SqlEffect } from './types';
import { common, insert, update, entity, canonicalConcept, session } from './sql';
import { invalid, DataError } from './errors';
function value(row: Row, key: string): string { return String(row[key]); }
export async function planSession(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data;
  if (ctx.envelope.operation === 'session_end') {
    const current = await session(ctx, value(data, 'session_id'));
    await entity(ctx, 'sessions', String(current.id), true);
    return { effects: [update('sessions', String(current.id), { state: 'closed', ended_at: ctx.now, exit_ticket_json: data.exit_ticket ? JSON.stringify(data.exit_ticket) : null, muddiest_point: data.muddiest_point ? String(data.muddiest_point) : null, what_helped: data.what_helped ? String(data.what_helped) : null })], data: { ids: [String(current.id)], versions: { [String(current.id)]: Number(current.version) + 1 } } };
  }
  const existing = data.resume_session_id ? await session(ctx, value(data, 'resume_session_id'), false) : null;
  const id = existing ? String(existing.id) : ctx.newId('s');
  const goalIds = data.goal_ids as string[];
  for (const goal of goalIds) await entity(ctx, 'goals', goal);
  const effects = existing ? [] : [insert('sessions', { ...common(ctx, id), state: 'open', started_at: ctx.now })];
  effects.push(insert('session_agents', { session_id: id, connection_id: ctx.actor.connection_id, reported_agent: ctx.actor.connection_id, joined_at: ctx.now }, 'ON CONFLICT(session_id,connection_id) DO NOTHING'));
  for (const goal of goalIds) effects.push(insert('session_goals', { session_id: id, goal_id: goal }, 'ON CONFLICT(session_id,goal_id) DO NOTHING'));
  return { effects, data: { ids: [id], versions: { [id]: existing ? Number(existing.version) : 1 } } };
}
export async function planConcept(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data; const id = data.id ? value(data, 'id') : ctx.newId('c');
  const previous = data.id ? await entity(ctx, 'concepts', id, true) : null;
  if (previous?.merged_into) invalid('Edit the canonical concept, not a merged redirect');
  const values = { realm: value(data, 'realm'), area: value(data, 'area'), slug: value(data, 'slug'), title: value(data, 'title'), purpose: value(data, 'purpose'), origin: value(data, 'origin') };
  const effects: SqlEffect[] = [previous ? update('concepts', id, values) : insert('concepts', { ...common(ctx, id), ...values })];
  for (const anchorId of data.anchor_ids as string[]) { await entity(ctx, 'anchors', anchorId); effects.push(insert('concept_anchors', { concept_id: id, anchor_id: anchorId }, 'ON CONFLICT DO NOTHING')); }
  return { effects, data: { ids: [id], versions: { [id]: previous ? Number(previous.version) + 1 : 1 } }, graphChanged: true };
}
export async function planAim(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data;
  if (['park_aim', 'unpark_aim'].includes(ctx.envelope.operation)) {
    const old = await entity(ctx, 'aims', value(data, 'id'), true);
    return { effects: [update('aims', String(old.id), { parked: ctx.envelope.operation === 'park_aim' ? 1 : 0 })], data: { ids: [String(old.id)], versions: { [String(old.id)]: Number(old.version) + 1 } }, graphChanged: true };
  }
  const c = await canonicalConcept(ctx, value(data, 'concept_id'));
  if (c.archived) invalid('Cannot set an aim on an archived candidate');
  if (data.owner_kind === 'learner' && data.owner_id !== ctx.actor.learner_id) throw new DataError('FORBIDDEN', 'Aim owner must be the authenticated learner');
  if (data.owner_kind === 'goal' && (await entity(ctx, 'goals', value(data, 'owner_id'))).state !== 'active') invalid('Cannot set an aim on a closed goal');
  const match = await ctx.db.prepare('SELECT * FROM aims WHERE learner_id=? AND concept_id=? AND owner_kind=? AND owner_id=? AND active=1').bind(ctx.actor.learner_id, String(c.id), String(data.owner_kind), String(data.owner_id)).first<Row>();
  if (data.id && match && data.id !== match.id) invalid('An active owner aim already exists');
  const old = data.id || match ? await entity(ctx, 'aims', String(data.id ?? match?.id), true) : null;
  if (old && (old.owner_kind !== data.owner_kind || old.owner_id !== data.owner_id || old.concept_id !== c.id)) invalid('Aim identity cannot be reassigned');
  const id = old ? String(old.id) : ctx.newId('ai');
  const values = { concept_id: String(c.id), owner_kind: String(data.owner_kind), owner_id: String(data.owner_id), level: Number(data.level), parked: data.parked ? 1 : 0 };
  return { effects: [old ? update('aims', id, values) : insert('aims', { ...common(ctx, id), ...values })], data: { ids: [id], versions: { [id]: old ? Number(old.version) + 1 : 1 } }, graphChanged: true };
}
export async function planGoal(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data; const old = data.id ? await entity(ctx, 'goals', value(data, 'id'), true) : null;
  if (old && old.state !== 'active') invalid('Cannot edit a closed goal');
  const id = old ? String(old.id) : ctx.newId('g');
  const values = { title: value(data, 'title'), source_json: JSON.stringify(data.source), urgent: data.urgent ? 1 : 0, due_at: data.due_at ? String(data.due_at) : null, last_touched_at: ctx.now };
  return { effects: [old ? update('goals', id, values) : insert('goals', { ...common(ctx, id), ...values })], data: { ids: [id], versions: { [id]: old ? Number(old.version) + 1 : 1 } }, graphChanged: true };
}
export async function planNote(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data; const old = data.id ? await entity(ctx, 'learner_notes', value(data, 'id'), true) : null;
  const id = old ? String(old.id) : ctx.newId('n'); const values = { kind: value(data, 'kind'), text: value(data, 'text') };
  return { effects: [old ? update('learner_notes', id, values) : insert('learner_notes', { ...common(ctx, id), ...values })], data: { ids: [id], versions: { [id]: old ? Number(old.version) + 1 : 1 } } };
}
