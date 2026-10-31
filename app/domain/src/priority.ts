import { effectiveAims, frontier, prerequisiteEdges, unmetAims } from './graph.ts';
import { instant } from './time.ts';
import type { Aim, ConceptMastery, Level, Link } from './types.ts';
export interface PriorityGoal { readonly id: string; readonly state: 'active' | 'closed' | 'abandoned'; readonly urgent: boolean; readonly dueAt?: string; }
export interface PriorityInput {
  readonly aims: readonly Aim[]; readonly links: readonly Link[]; readonly mastery: readonly ConceptMastery[];
  readonly goals: readonly PriorityGoal[]; readonly now: string; readonly slot: 'urgent' | 'growth';
  readonly recentInquiries?: readonly { readonly conceptId: string; readonly at: string }[];
  readonly misconceptionConceptIds?: readonly string[]; readonly staleConceptIds?: readonly string[];
}
const mastered = (entry: ConceptMastery) => ['Solid', 'Secure'].includes(entry.state) && !entry.provisional;
export function goalReadiness(goalId: string, aims: readonly Aim[], mastery: readonly ConceptMastery[]) {
  const targets = aims.filter(aim => !aim.parked && aim.ownerKind === 'goal' && aim.ownerId === goalId);
  const matches = (aim: Aim) => mastery.filter(entry => entry.conceptId === aim.conceptId && entry.level === aim.level);
  return { met: targets.filter(aim => matches(aim).some(mastered)).length, total: targets.length,
    provisional: targets.some(aim => matches(aim).some(entry => entry.provisional)) };
}
function urgency(goal: PriorityGoal, now: number): number {
  if (!goal.dueAt) return 1;
  const days = (instant(goal.dueAt) - now) / 86400000;
  return days < 0 ? 4 : days <= 7 ? 3 : days <= 21 ? 2 : 1;
}
function slotWeight(input: PriorityInput, owners: readonly Aim[], now: number): number {
  if (input.slot === 'urgent') return owners.reduce((sum, aim) => {
    const goal = input.goals.find(goal => goal.id === aim.ownerId && aim.ownerKind === 'goal');
    return sum + (goal?.urgent ? urgency(goal, now) * (aim.level <= 2 ? 1 : aim.level - 1) : 0);
  }, 0);
  const eligible = owners.some(aim => aim.ownerKind === 'learner' || input.goals.some(goal => goal.id === aim.ownerId && !goal.urgent));
  if (!eligible) return 0;
  const interested = input.recentInquiries?.some(inquiry => inquiry.conceptId === owners[0]?.conceptId && instant(inquiry.at) <= now && instant(inquiry.at) >= now - 30 * 86400000);
  return 1 + Number(Boolean(interested));
}
export function rankFrontier(input: PriorityInput): { conceptId: string; aimLevel: Level; score: number; why: string }[] {
  const now = instant(input.now);
  const activeIds = input.goals.filter(goal => goal.state === 'active').map(goal => goal.id);
  const candidates = frontier(input.aims, input.links, input.mastery, activeIds);
  const pending = unmetAims(input.aims, input.mastery);
  const aims = effectiveAims(pending, activeIds);
  const edges = prerequisiteEdges(input.links);
  const ranked = aims.filter(aim => candidates.includes(aim.conceptId)).flatMap(aim => {
    const owners = pending.filter(owner => owner.conceptId === aim.conceptId && !owner.parked && (owner.ownerKind === 'learner' || activeIds.includes(owner.ownerId)));
    const weight = slotWeight(input, owners, now);
    if (!weight) return [];
    const lower = input.mastery.filter(entry => entry.conceptId === aim.conceptId && entry.level < aim.level && mastered(entry));
    const gap = Math.max(1, aim.level - Math.max(0, ...lower.map(entry => entry.level)));
    const unblocked = new Set(edges.filter(edge => edge.toId === aim.conceptId).map(edge => edge.fromId)).size;
    const score = gap * weight * (1 + .25 * unblocked) + 2 * Number(input.misconceptionConceptIds?.includes(aim.conceptId) ?? false) + Number(input.staleConceptIds?.includes(aim.conceptId) ?? false);
    return [{ conceptId: aim.conceptId, aimLevel: aim.level, score, why: `${input.slot} aim; gap ${gap}`, creationSeq: Math.min(...owners.map(owner => owner.createdSeq ?? 0)) }];
  });
  return ranked.sort((a, b) => b.score - a.score || a.creationSeq - b.creationSeq || a.conceptId.localeCompare(b.conceptId)).map(({ creationSeq: _, ...entry }) => entry);
}
