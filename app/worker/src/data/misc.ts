import type { Context, Plan, SqlEffect } from './types';
import { entity, update } from './sql';
import { invalid } from './errors';
import { planConcept } from './entities';
export async function planMisc(ctx: Context): Promise<Plan> {
  if (ctx.envelope.operation === 'set_balance') return { effects: [{ sql: 'UPDATE learners SET balance_urgent_pct=? WHERE id=? AND __GUARD__', args: [Number(ctx.envelope.data.urgent_pct), ctx.actor.learner_id] }], data: { ids: [ctx.actor.learner_id] } };
  if (ctx.envelope.operation === 'archive_candidate') {
    const effects: SqlEffect[] = []; const ids = ctx.envelope.data.concept_ids as string[];
    for (const id of ids) {
      await entity(ctx, 'concepts', id, true);
      if (await ctx.db.prepare('SELECT 1 FROM aims WHERE learner_id=? AND concept_id=? AND active=1').bind(ctx.actor.learner_id, id).first()) invalid('A concept with an aim is not an unaccepted candidate');
      effects.push(update('concepts', id, { archived: 1 }));
    }
    return { effects, data: { ids }, graphChanged: true };
  }
  if (ctx.envelope.operation === 'propose_candidates') {
    const plans = await Promise.all((ctx.envelope.data.concepts as Record<string, unknown>[]).map(data => planConcept({ ...ctx, envelope: { ...ctx.envelope, data } })));
    return { effects: plans.flatMap(plan => plan.effects), data: { ids: plans.flatMap(plan => plan.data.ids ?? []) }, graphChanged: true };
  }
  invalid('Unsupported write operation');
}
