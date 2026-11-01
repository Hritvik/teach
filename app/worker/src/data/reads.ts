import {assessmentInsights} from './assessment-insights.ts';
import {assessmentRead} from './assessment.ts';
import { frontier, rankFrontier, goalReadiness, type ConceptMastery, type PriorityGoal } from '@teach/domain';
import type { Admission, Context, DataPayload, Row } from './types';
import { rows, canonicalConcept } from './sql';
import { DataError, invalid } from './errors';
import { parseRead } from './validation';
import { loadGraph } from './graph';
const fields: Record<string, readonly string[]> = {
  whoami: [], protocol: [],calibration:['concept_id','realm','level','limit','cursor'],misconceptions:['concept_id','realm','level','limit','cursor'],attempt_status:['attempt_id'],item_status:['item_id'], concept_get: ['concept_id'], concept_search: ['query', 'realm', 'limit', 'cursor'],
  mastery: ['concept_id', 'realm', 'level', 'limit', 'cursor'], frontier: ['limit', 'cursor'], next: ['limit', 'cursor', 'slot'], needs_you: ['limit', 'cursor'],
  neighbors: ['concept_id', 'limit', 'cursor'], aims: ['owner_id', 'goal_id', 'realm', 'limit', 'cursor'], gaps: ['owner_id', 'goal_id', 'realm', 'limit', 'cursor'], future: ['realm', 'limit', 'cursor'],
  goal_get: ['id'], goal_list: ['state', 'limit', 'cursor'], sessions: ['state', 'limit', 'cursor'],
  history: ['record_id', 'limit', 'cursor'], learner_notes: ['kind', 'limit', 'cursor'], inbox: ['limit', 'cursor'],
  query: ['view', 'select', 'filters', 'limit', 'cursor'],
};
function page(data: Row) {
  const limit = data.limit ?? 25; if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 100) invalid('Limit must be between 1 and 100');
  let offset = 0;
  if (data.cursor !== undefined) { try { offset = Number(atob(String(data.cursor))); } catch { invalid('Invalid pagination cursor'); } }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) invalid('Invalid pagination cursor');
  return { limit: Number(limit), offset };
}
function paged(result: readonly Row[], data: Row): DataPayload {
  const { limit, offset } = page(data); const selected = result.slice(offset, offset + limit);
  return { rows: selected, next_cursor: result.length > offset + limit ? btoa(String(offset + limit)) : null };
}
async function mastery(db: D1Database, actor: Admission, input: Row): Promise<Row[]> {
  const concepts = await rows(db, 'SELECT id FROM concepts WHERE learner_id=? AND merged_into IS NULL AND archived=0 AND (? IS NULL OR realm=?) ORDER BY created_seq,id', [actor.learner_id, typeof input.realm === 'string' ? input.realm : null, typeof input.realm === 'string' ? input.realm : null]);
  const current = await rows(db, 'SELECT * FROM mastery_projection WHERE learner_id=?', [actor.learner_id]);
  return concepts.flatMap(c => [1, 2, 3, 4].map(level => current.find(m => m.concept_id === c.id && m.level === level) ?? { learner_id: actor.learner_id, concept_id: c.id, level, state: 'Unknown', stale: 0, fading: 0, provisional: 0, as_of_seq: 0, rules_version: 1, projection_revision: 0 })).filter(row => (!input.concept_id || row.concept_id === input.concept_id) && (!input.level || row.level === input.level));
}
async function inbox(db: D1Database, actor: Admission): Promise<Row[]> {
  const originals = await rows(db, "SELECT * FROM inquiries WHERE learner_id=? AND state='inbox' ORDER BY created_seq,id", [actor.learner_id]);
  const corrections = await rows(db, 'SELECT root_record_id,action,replacement_json,effective_revision FROM record_corrections WHERE learner_id=? ORDER BY effective_revision', [actor.learner_id]);
  return originals.flatMap(original => {
    const chain = corrections.filter(c => c.root_record_id === original.id);
    if (chain.some(c => c.action === 'retract')) return [];
    return [chain.reduce((current, correction) => ({ ...current, ...JSON.parse(String(correction.replacement_json)), effective_revision: correction.effective_revision }), { ...original, effective_revision: 0 })];
  });
}
async function query(db: D1Database, actor: Admission, data: Row): Promise<DataPayload> {
  const views: Record<string, readonly string[]> = { v_concepts: ['id', 'realm', 'area', 'slug', 'title', 'purpose', 'origin', 'archived', 'merged_into', 'version'], v_aims: ['id', 'concept_id', 'owner_kind', 'owner_id', 'level', 'parked', 'active', 'version'], v_mastery: ['concept_id', 'level', 'state', 'stale', 'fading', 'provisional', 'as_of_seq', 'rules_version', 'projection_revision'], v_goals: ['id', 'title', 'state', 'urgent', 'due_at', 'version'] };
  const view = typeof data.view === 'string' ? data.view : ''; const allowed = views[view];
  if (!allowed || !Array.isArray(data.select) || data.select.length < 1 || data.select.length > 20 || !data.select.every(c => typeof c === 'string' && allowed.includes(c))) invalid('Only curated view fields may be selected');
  const filters = data.filters ?? {};
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) invalid('Filters must be an object');
  const entries = Object.entries(filters);
  if (entries.some(([column, value]) => !allowed.includes(column) || value !== null && !['string', 'number', 'boolean'].includes(typeof value))) invalid('Invalid view filter');
  const { limit, offset } = page(data);
  const sql = `SELECT ${(data.select as string[]).join(',')} FROM ${view} WHERE learner_id=?${entries.map(([c]) => ` AND ${c} IS ?`).join('')} LIMIT ? OFFSET ?`;
  const result = await rows(db, sql, [actor.learner_id, ...entries.map(([, v]) => typeof v === 'boolean' ? Number(v) : v as string | number | null), limit + 1, offset]);
  return { rows: result.slice(0, limit), next_cursor: result.length > limit ? btoa(String(offset + limit)) : null };
}
export async function readOperation(db: D1Database, operation: string, input: unknown, actor: Admission, now: string): Promise<DataPayload> {
  const allowed = fields[operation]; if (!allowed) invalid('Unsupported read operation');
  const data = parseRead(input, allowed); page(data);
  if (!await db.prepare('SELECT 1 FROM learners WHERE id=?').bind(actor.learner_id).first()) throw new DataError('FORBIDDEN', 'Unknown learner');
  const ctx: Pick<Context, 'db' | 'actor'> = { db, actor };
  if(operation==='calibration'||operation==='misconceptions'){const result=await assessmentInsights(db,operation,data,actor);return {...result,...paged(result.rows??[],data)};}
  if(operation==='attempt_status'||operation==='item_status')return assessmentRead(db,operation,data,actor);
  if (operation === 'whoami') return { learner_id: actor.learner_id, connection_id: actor.connection_id, scopes: [...actor.scopes], timezone: await db.prepare('SELECT timezone FROM learners WHERE id=?').bind(actor.learner_id).first('timezone') };
  if (operation === 'protocol') return { protocol_version: 1, rules_version: 1, state: 'local-foundation', shared_grading: 'not-enabled', no_client_grade_assertion: true };
  if (operation === 'query') return query(db, actor, data);
  if (operation === 'concept_search') return paged(await rows(db, 'SELECT id,realm,area,slug,title,purpose,origin,version,archived FROM concepts WHERE learner_id=? AND merged_into IS NULL AND (? IS NULL OR realm=?) AND (title LIKE ? ESCAPE \'\\\' OR purpose LIKE ? ESCAPE \'\\\') ORDER BY created_seq,id', [actor.learner_id, typeof data.realm === 'string' ? data.realm : null, typeof data.realm === 'string' ? data.realm : null, `%${String(data.query ?? '').replace(/[\\%_]/g, '\\$&')}%`, `%${String(data.query ?? '').replace(/[\\%_]/g, '\\$&')}%`]), data);
  if (operation === 'concept_get' || operation === 'neighbors') {
    if (typeof data.concept_id !== 'string') invalid('concept_id is required');
    const c = await canonicalConcept(ctx, data.concept_id);
    const links = await rows(db, 'SELECT * FROM links WHERE learner_id=? AND (from_id=? OR to_id=?)', [actor.learner_id, String(c.id), String(c.id)]);
    return operation === 'neighbors' ? paged(links, data) : { concept: c, mastery: await mastery(db, actor, { concept_id: c.id }), links };
  }
  if (operation === 'mastery') return paged(await mastery(db, actor, data), data);
  if (operation === 'aims' || operation === 'gaps') {
    const aims = await rows(db, 'SELECT a.* FROM aims a LEFT JOIN goals g ON a.owner_kind=\'goal\' AND g.id=a.owner_id WHERE a.learner_id=? AND a.active=1 AND (a.owner_kind=\'learner\' OR g.state=\'active\') ORDER BY a.created_seq,a.id', [actor.learner_id]);
    const states = await mastery(db, actor, data.realm ? { realm: data.realm } : {});
    return paged(aims.filter(a => (!data.realm || states.some(m => m.concept_id === a.concept_id)) && (!data.owner_id || a.owner_id === data.owner_id) && (!data.goal_id || a.owner_id === data.goal_id) && (operation !== 'gaps' || !a.parked && !states.some(m => m.concept_id === a.concept_id && m.level === a.level && ['Solid', 'Secure'].includes(String(m.state)) && !m.provisional))), data);
  }
  if (operation === 'future') {
    const realm = typeof data.realm === 'string' ? data.realm : null;
    return paged(await rows(db, 'SELECT a.id AS aim_id,a.concept_id,c.title,c.realm,c.area,c.slug,a.owner_kind,a.owner_id,a.level,a.parked,a.created_seq,a.version FROM aims a JOIN concepts c ON c.id=a.concept_id LEFT JOIN goals g ON a.owner_kind=\'goal\' AND g.id=a.owner_id WHERE a.learner_id=? AND a.active=1 AND a.parked=1 AND c.archived=0 AND (a.owner_kind=\'learner\' OR g.state=\'active\') AND (? IS NULL OR c.realm=?) ORDER BY a.created_seq,a.id', [actor.learner_id, realm, realm]), data);
  }
  if (operation === 'frontier' || operation === 'next') {
    const { graph } = await loadGraph(ctx); const states = await mastery(db, actor, {});
    const goalRows = await rows(db, 'SELECT id,state,urgent,due_at FROM goals WHERE learner_id=?', [actor.learner_id]);
    const goals: PriorityGoal[] = goalRows.map(g => ({ id: String(g.id), state: g.state as PriorityGoal['state'], urgent: Boolean(g.urgent), ...(g.due_at ? { dueAt: String(g.due_at) } : {}) }));
    const domainStates = states.map(s => ({ conceptId: String(s.concept_id), level: Number(s.level) as ConceptMastery['level'], state: s.state as ConceptMastery['state'], provisional: Boolean(s.provisional) }));
    if (operation === 'next') {
      if (data.slot !== undefined && !['urgent', 'growth'].includes(String(data.slot))) invalid('Unknown scheduling slot');
      const inquiries = await rows(db, 'SELECT ic.concept_id,ev.received_at AS captured_at FROM inquiries i JOIN inquiry_concepts ic ON ic.inquiry_id=i.id JOIN event_log ev ON ev.seq=i.created_seq WHERE i.learner_id=? AND NOT EXISTS(SELECT 1 FROM record_corrections rc WHERE rc.learner_id=i.learner_id AND rc.root_record_id=i.id AND rc.action=\'retract\')', [actor.learner_id]);
      return paged(rankFrontier({ aims: graph.aims, links: graph.links, mastery: domainStates, goals, now, slot: data.slot === 'urgent' ? 'urgent' : 'growth', recentInquiries: inquiries.map(i => ({ conceptId: String(i.concept_id), at: String(i.captured_at) })) }).map(r => ({ concept_id: r.conceptId, aim_level: r.aimLevel, score: r.score, why: r.why })), data);
    }
    const frontierIds = frontier(graph.aims, graph.links, domainStates, goals.filter(g => g.state === 'active').map(g => g.id));
    return paged(frontierIds.map(concept_id => ({ concept_id, why: 'An unparked aim is unmet and prerequisites are demonstrated' })), data);
  }
  if (operation === 'needs_you') return { ...paged(await inbox(db, actor), data), due_reviews: await rows(db, 'SELECT concept_id,level,due_at FROM review_schedules WHERE learner_id=? AND due_at<=? ORDER BY due_at', [actor.learner_id, now]) };
  if (operation === 'goal_list' || operation === 'goal_get') {
    if (operation === 'goal_get' && typeof data.id !== 'string') invalid('id is required');
    const goals = await rows(db, 'SELECT * FROM goals WHERE learner_id=? AND (? IS NULL OR id=?) AND (? IS NULL OR state=?) ORDER BY created_seq,id', [actor.learner_id, data.id ? String(data.id) : null, data.id ? String(data.id) : null, data.state ? String(data.state) : null, data.state ? String(data.state) : null]);
    if (operation === 'goal_get' && !goals.length) invalid('Goal does not exist');
    const { graph } = await loadGraph(ctx); const states = await mastery(db, actor, {});
    const domainStates = states.map(s => ({ conceptId: String(s.concept_id), level: Number(s.level) as ConceptMastery['level'], state: s.state as ConceptMastery['state'], provisional: Boolean(s.provisional) }));
    const enriched = goals.map(g => ({ ...g, readiness: goalReadiness(String(g.id), graph.aims, domainStates) }));
    return operation === 'goal_get' ? { goal: enriched[0] } : paged(enriched, data);
  }
  if (operation === 'sessions') return paged(await rows(db, 'SELECT * FROM sessions WHERE learner_id=? AND (? IS NULL OR state=?) ORDER BY created_seq,id', [actor.learner_id, data.state ? String(data.state) : null, data.state ? String(data.state) : null]), data);
  if (operation === 'learner_notes') return paged(await rows(db, 'SELECT * FROM learner_notes WHERE learner_id=? AND (? IS NULL OR kind=?) ORDER BY created_seq,id', [actor.learner_id, data.kind ? String(data.kind) : null, data.kind ? String(data.kind) : null]), data);
  if (operation === 'history') {
    if (typeof data.record_id !== 'string') invalid('record_id is required');
    return paged(await rows(db, 'SELECT * FROM record_corrections WHERE learner_id=? AND root_record_id=? ORDER BY effective_revision', [actor.learner_id, data.record_id]), data);
  }
  return paged(await inbox(db, actor), data);
}
