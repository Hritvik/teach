import type { Context, Plan, Row, SqlEffect } from './types';
import { canonicalConcept, common, entity, insert, localDay, rows, SEQ, session } from './sql';
import { DataError, invalid } from './errors';
import { projectionEffects } from './projections';
async function makeEvidence(ctx: Context, record: Row, sessionId: string): Promise<Row> {
  const concept = await canonicalConcept(ctx, String(record.concept_id));
  const at = String(record.occurred_at); if (new Date(at).getTime() > new Date(ctx.now).getTime() + 300000) invalid('Observation cannot be in the future');
  const learner = await ctx.db.prepare('SELECT timezone FROM learners WHERE id=?').bind(ctx.actor.learner_id).first<{ timezone: string }>();
  if (!learner) throw new DataError('FORBIDDEN', 'Unknown learner');
  return { id: ctx.newId('e'), learner_id: ctx.actor.learner_id, version: 1, created_seq: ctx.nextSeq, updated_seq: ctx.nextSeq, seq: ctx.nextSeq, concept_id: String(concept.id), level: Number(record.level), session_id: sessionId, kind: String(record.kind), content_grade: 'na', strength: ['inquiry', 'exposure'].includes(String(record.kind)) ? 'exposure' : 'unresolved', confidence: String(record.confidence ?? 'unknown'), help_json: JSON.stringify(record.help ?? {}), occurred_at: at, accepted_at: ctx.now, timezone: learner.timezone, local_day: localDay(at, learner.timezone), source_json: JSON.stringify(record.source), content: record.content ? String(record.content) : null, rules_version: 1 };
}
function evidenceInsert(record: Row): SqlEffect {
  const values = record as Record<string, string | number | null>;
  return insert('evidence', { ...values, seq: SEQ, created_seq: SEQ, updated_seq: SEQ });
}
export async function planRecords(ctx: Context): Promise<Plan> {
  const sitting = await session(ctx);
  const records = await Promise.all((ctx.envelope.data.records as Row[]).map(record => makeEvidence(ctx, record, String(sitting.id))));
  return { effects: [...records.map(evidenceInsert), ...await projectionEffects(ctx, records)], data: { ids: records.map(record => String(record.id)) }, projectionChanged: true };
}
export async function planInquiry(ctx: Context): Promise<Plan> {
  const sitting = await session(ctx); const id = ctx.newId('inq'); const data = ctx.envelope.data;
  const concepts = await Promise.all((data.concept_ids as string[]).map(c => canonicalConcept(ctx, c)));
  const unique = [...new Set(concepts.map(c => String(c.id)))];
  const records = await Promise.all(unique.map(concept_id => makeEvidence(ctx, { kind: 'inquiry', concept_id, level: 1, occurred_at: ctx.now, source: { inquiry_id: id }, content: String(data.text) }, String(sitting.id))));
  const effects = [insert('inquiries', { ...common(ctx, id), session_id: String(sitting.id), text: String(data.text), state: data.unresolved ? 'inbox' : 'answered', answer_json: data.answer === undefined ? null : JSON.stringify(data.answer) }), ...unique.map(c => insert('inquiry_concepts', { inquiry_id: id, concept_id: c })), ...records.map(evidenceInsert), ...await projectionEffects(ctx, records)];
  return { effects, data: { ids: [id] }, projectionChanged: true };
}
async function correctionRoot(ctx: Context, id: string): Promise<{ table: string; row: Row }> {
  for (const table of ['inquiries', 'evidence']) {
    const row = await ctx.db.prepare(`SELECT * FROM ${table} WHERE id=? AND learner_id=?`).bind(id, ctx.actor.learner_id).first<Row>();
    if (!row) continue;
    await session(ctx, String(row.session_id), true, true);
    if (ctx.envelope.operation === 'retract' && table === 'evidence' && !['inquiry', 'exposure'].includes(String(row.kind))) throw new DataError('FORBIDDEN', 'Only an unassessed inquiry or exposure can be withdrawn through ordinary learning access');
    if (ctx.envelope.operation === 'retract' && table === 'evidence' && row.attempt_id) throw new DataError('FORBIDDEN', 'Assessed evidence requires independent regrading or learner control');
    return { table, row };
  }
  invalid('No correctable observation was found');
}
export async function planCorrection(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data; const id = String(data.root_record_id); const root = await correctionRoot(ctx, id);
  const revision = Number(await ctx.db.prepare('SELECT COALESCE(MAX(effective_revision),0) AS revision FROM record_corrections WHERE root_record_id=?').bind(id).first('revision'));
  if (revision !== data.expected_effective_revision) throw new DataError('VERSION_CONFLICT', 'Correction revision changed', { [id]: revision });
  const replacement = ctx.envelope.operation === 'retract' ? {} : data.replacement as Row;
  const allowed = root.table === 'inquiries' ? ['text'] : root.row.attempt_id ? ['confidence', 'help'] : ['content', 'confidence', 'help'];
  if (Object.keys(replacement).some(key => !allowed.includes(key))) invalid('These correction fields are not permitted');
  if (replacement.text !== undefined && (typeof replacement.text !== 'string' || !replacement.text)) invalid('Corrected text must be a nonempty string');
  if (replacement.content !== undefined && typeof replacement.content !== 'string') invalid('Corrected content must be text');
  if (replacement.confidence !== undefined && !['sure', 'think', 'guess', 'unknown'].includes(String(replacement.confidence))) invalid('Invalid confidence');
  if (replacement.help !== undefined) {
    if (!replacement.help || typeof replacement.help !== 'object' || Array.isArray(replacement.help)
      || Object.entries(replacement.help).some(([key,value]) => !['content_hint','answer_revealed'].includes(key) || typeof value !== 'boolean')) invalid('Invalid help metadata');
  }
  const correction: Row = { id: ctx.newId('rc'), learner_id: ctx.actor.learner_id, version: 1, created_seq: ctx.nextSeq, updated_seq: ctx.nextSeq, root_record_id: id, expected_effective_revision: revision, effective_revision: revision + 1, action: ctx.envelope.operation, replacement_json: JSON.stringify(replacement), reason: String(data.reason), seq: ctx.nextSeq };
  const extra: Row[] = [];
  if (root.table === 'inquiries' && ctx.envelope.operation === 'retract') {
    const children = await rows(ctx.db, 'SELECT id FROM evidence WHERE learner_id=? AND json_extract(source_json,\'$.inquiry_id\')=?', [ctx.actor.learner_id, id]);
    for (const child of children) {
      const old = Number(await ctx.db.prepare('SELECT COALESCE(MAX(effective_revision),0) AS revision FROM record_corrections WHERE root_record_id=?').bind(String(child.id)).first('revision'));
      extra.push({ ...correction, id: ctx.newId('rc'), root_record_id: child.id, expected_effective_revision: old, effective_revision: old + 1 });
    }
  }
  const corrections = [correction, ...extra];
  return { effects: [...corrections.map(row => insert('record_corrections', { ...row as Record<string, string | number | null>, created_seq: SEQ, updated_seq: SEQ, seq: SEQ })), ...await projectionEffects(ctx, [], corrections)], data: { ids: [String(correction.id)], effective_revision: revision + 1 }, projectionChanged: true };
}
