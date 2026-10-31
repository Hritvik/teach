import { DomainError } from './errors.ts';
import { assertAcyclic, resolveConceptId } from './graph.ts';
import type { Aim, AimDecision, Graph, Link } from './types.ts';
function coalesceAims(aims: readonly Aim[]): Aim[] {
  const key = (aim: Aim) => JSON.stringify([aim.conceptId, aim.ownerKind, aim.ownerId]);
  return [...new Set(aims.map(key))].map(group => {
    const same = aims.filter(aim => key(aim) === group);
    return { ...same[0]!, level: Math.max(...same.map(aim => aim.level)) as Aim['level'], parked: same.every(aim => aim.parked) };
  });
}
function canonicalLinks(links: readonly Link[], canonical: (id: string) => string): Link[] {
  const mapped = links.map(link => ({ ...link, fromId: canonical(link.fromId), toId: canonical(link.toId) })).filter(link => link.fromId !== link.toId)
    .map(link => link.kind === 'relates' && link.fromId > link.toId ? { ...link, fromId: link.toId, toId: link.fromId } : link);
  return [...new Map(mapped.map(link => [JSON.stringify(link), link])).values()];
}
export function mergeConcepts(graph: Graph, sourceId: string, targetId: string) {
  const source = resolveConceptId(sourceId, graph.concepts); const target = resolveConceptId(targetId, graph.concepts);
  if (source === target) throw new DomainError('Cannot merge a concept with itself');
  const concepts = graph.concepts.map(concept => concept.id === source ? { ...concept, mergedInto: target } : { ...concept });
  const canonical = (id: string) => resolveConceptId(id, concepts);
  const links = canonicalLinks(graph.links, canonical); assertAcyclic(links);
  return { concepts, links, aims: coalesceAims(graph.aims.map(aim => ({ ...aim, conceptId: canonical(aim.conceptId) }))), aimHistory: graph.aims.map(aim => ({ ...aim })) };
}
function decideAim(aim: Aim, learnerId: string, decision: AimDecision): Aim[] {
  if (decision.action === 'drop') return [];
  if (decision.action === 'lower' && (!decision.newLevel || decision.newLevel > aim.level || decision.newLevel < 1)) throw new DomainError('Lowered aim must stay within its old level');
  return [{ ...aim, ownerKind: 'learner', ownerId: learnerId, level: decision.action === 'lower' ? decision.newLevel! : aim.level }];
}
export function closeGoal(aims: readonly Aim[], goalId: string, learnerId: string, decisions: readonly AimDecision[]) {
  const owned = aims.filter(aim => aim.ownerKind === 'goal' && aim.ownerId === goalId); const decisionIds = decisions.map(decision => decision.aimId);
  if (new Set(decisionIds).size !== decisionIds.length || decisions.length !== owned.length || decisions.some(decision => !owned.some(aim => aim.id === decision.aimId))) throw new DomainError('Every goal-owned aim needs exactly one decision');
  const others = aims.filter(aim => aim.ownerKind !== 'goal' || aim.ownerId !== goalId);
  const retained = owned.flatMap(aim => decideAim(aim, learnerId, decisions.find(decision => decision.aimId === aim.id)!));
  return { aims: coalesceAims([...others, ...retained]), aimHistory: aims.map(aim => ({ ...aim })) };
}
