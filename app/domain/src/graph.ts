import { DomainError } from './errors.ts';
import type { Aim, Concept, ConceptMastery, Level, Link } from './types.ts';
export function resolveConceptId(id: string, concepts: readonly Concept[]): string {
  const visit = (current: string, seen: readonly string[]): string => {
    if (seen.includes(current)) throw new DomainError('Concept redirect cycle');
    const concept = concepts.find(entry => entry.id === current);
    if (!concept) throw new DomainError('Concept does not exist');
    return concept.mergedInto ? visit(concept.mergedInto, [...seen, current]) : current;
  };
  return visit(id, []);
}
export function prerequisiteEdges(links: readonly Link[]): Link[] {
  return links.flatMap(link => link.kind === 'requires' ? [{ ...link }] : link.kind === 'deepens' ? [{ fromId: link.toId, toId: link.fromId, kind: 'requires' as const }] : []);
}
export function assertAcyclic(links: readonly Link[]): void {
  for (const link of links) if (link.fromId === link.toId) throw new DomainError('Self links are invalid');
  const edges = prerequisiteEdges(links);
  const visit = (id: string, path: readonly string[]): void => {
    if (path.includes(id)) throw new DomainError('Prerequisite cycle');
    for (const edge of edges.filter(edge => edge.fromId === id)) visit(edge.toId, [...path, id]);
  };
  for (const id of new Set(edges.map(edge => edge.fromId))) visit(id, []);
}
export function effectiveAims(aims: readonly Aim[], activeGoalIds: readonly string[] = []): { conceptId: string; level: Level }[] {
  const active = aims.filter(aim => !aim.parked && (aim.ownerKind === 'learner' || activeGoalIds.includes(aim.ownerId)));
  return [...new Set(active.map(aim => aim.conceptId))].map(conceptId => ({ conceptId, level: Math.max(...active.filter(aim => aim.conceptId === conceptId).map(aim => aim.level)) as Level }));
}
export function unmetAims(aims: readonly Aim[], mastery: readonly ConceptMastery[]): Aim[] {
  return aims.filter(aim => !mastery.some(record => record.conceptId === aim.conceptId && record.level === aim.level && ['Solid', 'Secure'].includes(record.state) && !record.provisional));
}
export function frontier(aims: readonly Aim[], links: readonly Link[], mastery: readonly ConceptMastery[], activeGoalIds: readonly string[] = []): string[] {
  assertAcyclic(links);
  const meets = (id: string, level: Level) => mastery.some(record => record.conceptId === id && record.level === level && ['Solid', 'Secure'].includes(record.state) && !record.provisional);
  const prerequisites = prerequisiteEdges(links);
  return effectiveAims(unmetAims(aims, mastery), activeGoalIds).filter(aim => !meets(aim.conceptId, aim.level) && prerequisites.filter(edge => edge.fromId === aim.conceptId).every(edge => meets(edge.toId, 2))).map(aim => aim.conceptId);
}
