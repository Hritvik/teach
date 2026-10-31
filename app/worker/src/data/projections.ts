import { deriveMastery, replaySchedule, resolveConceptId, type Concept, type Correction, type Evidence, type Level, type SchedulerManifest } from '@teach/domain';
import type { Context, Row, SqlEffect } from './types';
import { insert, rows, SEQ } from './sql';
const evidenceKinds = new Set(['answer', 'prediction', 'teachback', 'inquiry', 'exposure', 'self_rating', 'observed', 'inferred']);
export function evidenceFromRow(row: Row): Evidence {
  const help = JSON.parse(String(row.help_json ?? '{}')) as Row;
  return { id: String(row.id), seq: Number(row.seq), conceptId: String(row.concept_id), level: Number(row.level) as Level, kind: evidenceKinds.has(String(row.kind)) ? row.kind as Evidence['kind'] : 'exposure', contentGrade: row.content_grade as Evidence['contentGrade'], confidence: row.confidence as Evidence['confidence'], occurredAt: String(row.occurred_at), acceptedAt: String(row.accepted_at), ...(row.attempt_id && ['production', 'recognition'].includes(String(row.assessment_form)) ? { assessmentForm: row.assessment_form as NonNullable<Evidence['assessmentForm']> } : {}), localDay: String(row.local_day), contentHint: help.content_hint === true, answerRevealed: help.answer_revealed === true, schedulingEligible: row.scheduling_eligible !== 0 };
}
export function correctionFromRow(row: Row): Correction {
  const replacement = JSON.parse(String(row.replacement_json)) as Row;
  const help = replacement.help && typeof replacement.help === 'object' ? replacement.help as Row : {};
  const domainReplacement = { ...(replacement.content_grade !== undefined ? {contentGrade:replacement.content_grade as Evidence['contentGrade']} : {}), ...(replacement.confidence !== undefined ? { confidence: replacement.confidence as Evidence['confidence'] } : {}), ...(help.content_hint !== undefined ? { contentHint: help.content_hint === true } : {}), ...(help.answer_revealed !== undefined ? { answerRevealed: help.answer_revealed === true } : {}) };
  return { rootRecordId: String(row.root_record_id), expectedEffectiveRevision: Number(row.expected_effective_revision), effectiveRevision: Number(row.effective_revision), action: row.action as Correction['action'], ...(['retract', 'dispute'].includes(String(row.action)) ? {} : { replacement: domainReplacement }), seq: Number(row.seq) };
}
export async function loadEvidenceRows(db: D1Database, learnerId: string): Promise<Row[]> {
  return rows(db, 'SELECT e.*,COALESCE(a.accepted_at,e.accepted_at) AS accepted_at,iv.assessment_form FROM evidence e LEFT JOIN attempts a ON a.id=e.attempt_id AND a.learner_id=e.learner_id LEFT JOIN item_versions iv ON iv.item_id=a.item_id AND iv.item_version=a.item_version WHERE e.learner_id=? ORDER BY e.seq,e.id', [learnerId]);
}
export async function projectionEffects(ctx: Context, additions: readonly Row[] = [], correctionAdditions: readonly Row[] = [], conceptOverrides: readonly Concept[] = []): Promise<readonly SqlEffect[]> {
  const existing = await loadEvidenceRows(ctx.db, ctx.actor.learner_id);
  const correctionRows = await rows(ctx.db, 'SELECT * FROM record_corrections WHERE learner_id=? ORDER BY seq,effective_revision', [ctx.actor.learner_id]);
  const conceptRows = await rows(ctx.db, 'SELECT id,merged_into FROM concepts WHERE learner_id=?', [ctx.actor.learner_id]);
  const concepts = conceptOverrides.length ? conceptOverrides : conceptRows.map(c => ({ id: String(c.id), ...(c.merged_into ? { mergedInto: String(c.merged_into) } : {}) }));
  const evidence = [...existing, ...additions].map(evidenceFromRow).map(e => ({ ...e, conceptId: resolveConceptId(e.conceptId, concepts) }));
  const corrections = [...correctionRows, ...correctionAdditions].filter(row => evidence.some(e => e.id === row.root_record_id)).map(correctionFromRow);
  const pairs = [...new Set(evidence.map(e => `${e.conceptId}:${e.level}`))];
  const manifestRow = await ctx.db.prepare('SELECT parameters_json FROM rules_manifests WHERE id=?').bind(ctx.envelope.rules_version).first<{parameters_json:string}>();
  if (!manifestRow) throw new Error('Pinned scheduler manifest is unavailable');
  const manifest = JSON.parse(manifestRow.parameters_json) as SchedulerManifest;
  const oldSchedules = await rows(ctx.db, 'SELECT * FROM review_schedules WHERE learner_id=?', [ctx.actor.learner_id]);
  const scheduleEffects: SqlEffect[] = [];
  const retained = new Set<string>();
  // A reissued stale lease can retain practice/miss evidence but never a new strong day,
  // including after a later confidence correction. Immutable assessment form enforces that cap.
  const masteryEvidence = evidence.map(record => record.schedulingEligible === false ? {...record,assessmentForm:'recognition' as const} : record);
  const masteryEffects = [{ sql: 'DELETE FROM mastery_projection WHERE learner_id=? AND __GUARD__', args: [ctx.actor.learner_id] }, ...pairs.map((pair, index) => {
    const split = pairs[index]!.lastIndexOf(':'); const concept = pairs[index]!.slice(0, split); const level = Number(pairs[index]!.slice(split + 1)) as Level;
    const projection = deriveMastery(masteryEvidence, corrections, { conceptId: concept, level });
    const record = { learner_id: ctx.actor.learner_id, version: 1, created_seq: SEQ, updated_seq: SEQ, concept_id: concept, level, state: projection.state, strong_days_json: JSON.stringify(projection.strongDays), stale: projection.stale ? 1 : 0, fading: projection.fading ? 1 : 0, provisional: projection.provisional ? 1 : 0, as_of_seq: SEQ, rules_version: 1, projection_revision: ctx.meta.projection_revision + 1 } as const;
    return insert('mastery_projection', record, 'ON CONFLICT(concept_id,level) DO UPDATE SET version=mastery_projection.version+1,updated_seq=excluded.updated_seq,state=excluded.state,strong_days_json=excluded.strong_days_json,stale=excluded.stale,fading=excluded.fading,provisional=excluded.provisional,as_of_seq=excluded.as_of_seq,rules_version=excluded.rules_version,projection_revision=excluded.projection_revision');
  })];
  for (const pair of pairs) {
    const split = pair.lastIndexOf(':'); const concept = pair.slice(0,split); const level = Number(pair.slice(split+1)) as Level;
    const projected = await replaySchedule(evidence,corrections,{conceptId:concept,level,manifest});
    if (!projected) continue;
    retained.add(pair);
    const previous = oldSchedules.find(row=>row.concept_id===concept&&row.level===level);
    const card = JSON.stringify({card:projected.card,logs:projected.logs,manifest:projected.manifest});
    if(previous?.card_json===card&&Number(previous.last_rated_seq)===projected.lastRatedSeq) continue;
    const revision = Number(previous?.schedule_revision??0)+1;
    scheduleEffects.push({sql:"UPDATE review_occurrences SET state='superseded',version=version+1,updated_seq=__SEQ__ WHERE learner_id=? AND concept_id=? AND level=? AND state IN ('open','reserved') AND __GUARD__",args:[ctx.actor.learner_id,concept,level]});
    scheduleEffects.push(insert('review_schedules',{learner_id:ctx.actor.learner_id,version:1,created_seq:SEQ,updated_seq:SEQ,concept_id:concept,level,scheduler_manifest_id:ctx.envelope.rules_version,card_json:card,last_rated_seq:additions.some(row=>Number(row.seq)===ctx.nextSeq&&Number(row.seq)===projected.lastRatedSeq)?SEQ:projected.lastRatedSeq,due_at:projected.dueAt,schedule_revision:revision,suppressed_session_id:null},'ON CONFLICT(concept_id,level) DO UPDATE SET version=review_schedules.version+1,updated_seq=excluded.updated_seq,scheduler_manifest_id=excluded.scheduler_manifest_id,card_json=excluded.card_json,last_rated_seq=excluded.last_rated_seq,due_at=excluded.due_at,schedule_revision=excluded.schedule_revision,suppressed_session_id=NULL'));
  }
  for(const old of oldSchedules){
    if(retained.has(`${old.concept_id}:${old.level}`))continue;
    scheduleEffects.push({sql:"UPDATE review_occurrences SET state='superseded',version=version+1,updated_seq=__SEQ__ WHERE learner_id=? AND concept_id=? AND level=? AND state IN ('open','reserved') AND __GUARD__",args:[ctx.actor.learner_id,String(old.concept_id),Number(old.level)]});
    scheduleEffects.push({sql:'DELETE FROM review_schedules WHERE learner_id=? AND concept_id=? AND level=? AND __GUARD__',args:[ctx.actor.learner_id,String(old.concept_id),Number(old.level)]});
  }
  return [...masteryEffects,...scheduleEffects];
}
