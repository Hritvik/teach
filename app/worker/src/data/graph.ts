import { assertAcyclic, closeGoal, mergeConcepts, type Aim, type Graph, type Level, type Link } from '@teach/domain';
import type { Context, Plan, Row, SqlEffect } from './types';
import { canonicalConcept, common, entity, insert, rows, SEQ, update } from './sql';
import { DataError, invalid } from './errors';
import { projectionEffects } from './projections';
import { planConcept } from './entities';
export async function loadGraph(ctx: Pick<Context, 'db' | 'actor'>): Promise<{ graph: Graph; aimRows: Row[]; linkRows: Row[] }> {
  const [concepts, aims, links] = await Promise.all([rows(ctx.db, 'SELECT id,merged_into FROM concepts WHERE learner_id=?', [ctx.actor.learner_id]), rows(ctx.db, 'SELECT * FROM aims WHERE learner_id=? AND active=1', [ctx.actor.learner_id]), rows(ctx.db, 'SELECT * FROM links WHERE learner_id=?', [ctx.actor.learner_id])]);
  return { graph: { concepts: concepts.map(c => ({ id: String(c.id), ...(c.merged_into ? { mergedInto: String(c.merged_into) } : {}) })), links: links.map(l => ({ fromId: String(l.from_id), toId: String(l.to_id), kind: l.kind as Link['kind'] })), aims: aims.map(toAim) }, aimRows: aims, linkRows: links };
}
function toAim(row: Row): Aim { return { id: String(row.id), conceptId: String(row.concept_id), ownerKind: row.owner_kind as Aim['ownerKind'], ownerId: String(row.owner_id), level: Number(row.level) as Level, parked: Boolean(row.parked), createdSeq: Number(row.created_seq) }; }
function confirmed(ctx: Context): void {
  const approval = ctx.actor.confirmation;
  if (!approval || approval.id !== ctx.envelope.data.confirmation_id || approval.operation !== ctx.envelope.operation) throw new DataError('FORBIDDEN', 'A trusted learner confirmation is required');
}
export async function planLink(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data; const from = await canonicalConcept(ctx, String(data.from_id)); const to = await canonicalConcept(ctx, String(data.to_id));
  const [fromId, toId] = data.kind === 'relates' && String(from.id) > String(to.id) ? [String(to.id), String(from.id)] : [String(from.id), String(to.id)];
  if (fromId === toId) invalid('Self links are not permitted');
  const { graph, linkRows } = await loadGraph(ctx); const link: Link = { fromId, toId, kind: data.kind as Link['kind'] };
  if (ctx.envelope.operation === 'link') {
    const existing = linkRows.find(row => row.from_id === fromId && row.to_id === toId && row.kind === link.kind);
    if (existing) return { effects: [], data: { ids: [String(existing.id)], versions: { [String(existing.id)]: Number(existing.version) } } };
    assertAcyclic([...graph.links, link]);
    const id = ctx.newId('ln');
    return { effects: [insert('links', { ...common(ctx, id), from_id: fromId, to_id: toId, kind: link.kind }, 'ON CONFLICT(learner_id,from_id,to_id,kind) DO NOTHING')], data: { ids: [id] }, graphChanged: true };
  }
  return { effects: [{ sql: 'DELETE FROM links WHERE learner_id=? AND from_id=? AND to_id=? AND kind=? AND __GUARD__', args: [ctx.actor.learner_id, fromId, toId, link.kind] }], data: { ids: [] }, graphChanged: true };
}
function freshAim(ctx: Context, aim: Aim): SqlEffect { return insert('aims', { ...common(ctx, ctx.newId('ai')), concept_id: aim.conceptId, owner_kind: aim.ownerKind, owner_id: aim.ownerId, level: aim.level, parked: aim.parked ? 1 : 0 }); }
function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'topic';
}
/** Queue a future topic as a concept plus a parked aim, optionally linked, in one transaction. */
export async function planQueueTopic(ctx: Context): Promise<Plan> {
  const data = ctx.envelope.data; const effects: SqlEffect[] = [];
  let conceptId: string;
  if (typeof data.concept_id === 'string') {
    const existing = await canonicalConcept(ctx, data.concept_id);
    if (existing.archived) invalid('Cannot queue an archived concept');
    conceptId = String(existing.id);
  } else {
    const topic = String(data.topic);
    const title = String(data.title ?? topic);
    const realm = String(data.realm ?? 'general'); const area = String(data.area ?? 'general'); const slug = String(data.slug ?? slugify(title));
    const existing = await ctx.db.prepare('SELECT * FROM concepts WHERE learner_id=? AND realm=? AND area=? AND slug=? AND merged_into IS NULL').bind(ctx.actor.learner_id, realm, area, slug).first<Row>();
    if (existing) {
      if (existing.archived) invalid('Cannot queue an archived concept');
      conceptId = String(existing.id);
    } else {
      const conceptPlan = await planConcept({ ...ctx, envelope: { ...ctx.envelope, data: {
        realm, area, slug, title, purpose: String(data.purpose ?? data.question ?? topic), origin: 'frontier', anchor_ids: [],
      } } });
      const created = conceptPlan.data.ids?.[0];
      if (!created) invalid('Concept identity was not created');
      conceptId = String(created); effects.push(...conceptPlan.effects);
    }
  }
  const goalId = typeof data.goal_id === 'string' ? data.goal_id : undefined;
  const ownerKind = goalId ? 'goal' : 'learner'; const ownerId = goalId ?? ctx.actor.learner_id;
  if (goalId) { const goal = await entity(ctx, 'goals', goalId); if (goal.state !== 'active') invalid('Cannot queue a topic for a closed goal'); }
  const existingAim = await ctx.db.prepare('SELECT * FROM aims WHERE learner_id=? AND concept_id=? AND owner_kind=? AND owner_id=? AND active=1').bind(ctx.actor.learner_id, conceptId, ownerKind, ownerId).first<Row>();
  let aimId: string; let aimCreated = false;
  if (existingAim) aimId = String(existingAim.id);
  else {
    aimId = ctx.newId('ai'); aimCreated = true;
    effects.push(insert('aims', { ...common(ctx, aimId), concept_id: conceptId, owner_kind: ownerKind, owner_id: ownerId, level: 1, parked: 1 }));
  }
  const links = Array.isArray(data.links) ? data.links as Row[] : [];
  const { graph, linkRows } = await loadGraph(ctx); const created: Link[] = [];
  for (const link of links) {
    const to = await canonicalConcept(ctx, String(link.to_id));
    if (to.archived) invalid('Cannot link an archived concept');
    let [fromId, toId] = [conceptId, String(to.id)];
    if (link.kind === 'relates' && fromId > toId) { [fromId, toId] = [toId, fromId]; }
    if (fromId === toId) invalid('Self links are not permitted');
    const kind = link.kind as Link['kind'];
    if (linkRows.some(row => row.from_id === fromId && row.to_id === toId && row.kind === kind)) continue;
    assertAcyclic([...graph.links, ...created, { fromId, toId, kind }]);
    created.push({ fromId, toId, kind });
    effects.push(insert('links', { ...common(ctx, ctx.newId('ln')), from_id: fromId, to_id: toId, kind }, 'ON CONFLICT(learner_id,from_id,to_id,kind) DO NOTHING'));
  }
  return { effects, data: { ids: [conceptId, aimId], concept_id: conceptId, aim_id: aimId, aim_created: aimCreated, parked: existingAim ? Boolean(existingAim.parked) : true, links: created.map(link => ({ from_id: link.fromId, to_id: link.toId, kind: link.kind })) }, graphChanged: true };
}
export async function planMerge(ctx: Context): Promise<Plan> {
  confirmed(ctx); const data = ctx.envelope.data;
  const source = await entity(ctx, 'concepts', String(data.source_id)); const target = await entity(ctx, 'concepts', String(data.target_id));
  if (source.version !== data.expected_source_version || target.version !== data.expected_target_version) throw new DataError('VERSION_CONFLICT', 'Merge target versions changed');
  if (source.merged_into || target.merged_into) invalid('Merge proposals must identify canonical concepts');
  const loaded = await loadGraph(ctx); const merged = mergeConcepts(loaded.graph, String(source.id), String(target.id));
  const effects: SqlEffect[] = [update('concepts', String(source.id), { merged_into: String(target.id) }), { sql: 'DELETE FROM links WHERE learner_id=? AND __GUARD__', args: [ctx.actor.learner_id] }];
  for (const link of merged.links) effects.push(insert('links', { ...common(ctx, ctx.newId('ln')), from_id: link.fromId, to_id: link.toId, kind: link.kind }));
  const affected = loaded.aimRows.filter(a => a.concept_id === source.id || a.concept_id === target.id);
  for (const row of affected) effects.push(update('aims', String(row.id), { active: 0 }));
  for (const aim of merged.aims.filter(a => a.conceptId === target.id)) effects.push(freshAim(ctx, aim));
  effects.push(...await projectionEffects(ctx, [], [], merged.concepts));
  return { effects, data: { ids: [String(source.id), String(target.id)], redirect: { from: source.id, to: target.id }, retained_aims: affected.length }, audit: { prior_aims: affected, prior_links: loaded.linkRows }, graphChanged: true, projectionChanged: true };
}
export async function planClose(ctx: Context): Promise<Plan> {
  confirmed(ctx); const data = ctx.envelope.data; const goal = await entity(ctx, 'goals', String(data.goal_id), true);
  if (goal.state !== 'active') invalid('Goal is already closed');
  const { graph, aimRows } = await loadGraph(ctx);
  const decisions = (data.decisions as Row[]).map(d => ({ aimId: String(d.aim_id), action: d.action as 'keep' | 'lower' | 'drop', ...(d.new_level ? { newLevel: Number(d.new_level) as Level } : {}) }));
  const closed = closeGoal(graph.aims, String(goal.id), ctx.actor.learner_id, decisions);
  const concepts = new Set(graph.aims.filter(a => a.ownerKind === 'goal' && a.ownerId === goal.id).map(a => a.conceptId));
  const affected = aimRows.filter(a => a.owner_kind === 'goal' && a.owner_id === goal.id || a.owner_kind === 'learner' && concepts.has(String(a.concept_id)));
  const effects = affected.map(a => update('aims', String(a.id), { active: 0 }));
  for (const aim of closed.aims.filter(a => a.ownerKind === 'learner' && concepts.has(a.conceptId))) effects.push(freshAim(ctx, aim));
  effects.push(update('goals', String(goal.id), { state: 'closed', last_touched_at: ctx.now }));
  effects.push({ sql: 'UPDATE goals SET closed_seq=__SEQ__ WHERE id=? AND __GUARD__', args: [String(goal.id)] });
  return { effects, data: { ids: [String(goal.id)], versions: { [String(goal.id)]: Number(goal.version) + 1 } }, audit: { prior_aims: affected }, graphChanged: true };
}
