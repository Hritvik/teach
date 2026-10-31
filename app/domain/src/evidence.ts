import { DomainError } from './errors.ts';
import { instant, validateLocalDay } from './time.ts';
import type { Correction, Evidence, EvidenceStrength } from './types.ts';
export function evidenceStrength(record: Evidence): EvidenceStrength {
  if (!['answer', 'prediction', 'teachback'].includes(record.kind) || record.contentGrade === 'na') return 'exposure';
  if (record.contentGrade !== 'correct') return 'miss';
  if (record.confidence === 'unknown') return 'unresolved';
  if (record.confidence === 'guess' || record.contentHint || record.answerRevealed || record.assessmentForm !== 'production') return 'practice';
  return 'strong';
}
export function compareEvidence(a: Evidence, b: Evidence): number {
  return instant(a.occurredAt) - instant(b.occurredAt) || a.seq - b.seq;
}
function validateRecord(record: Evidence): Evidence {
  instant(record.occurredAt); validateLocalDay(record.localDay);
  if (record.acceptedAt !== undefined) instant(record.acceptedAt);
  if (!['sure', 'think', 'guess', 'unknown'].includes(record.confidence)
    || !['correct', 'partial', 'wrong', 'na'].includes(record.contentGrade)
    || !['answer', 'prediction', 'teachback', 'inquiry', 'exposure', 'self_rating', 'observed', 'inferred'].includes(record.kind)
    || (record.assessmentForm !== undefined && !['production', 'recognition'].includes(record.assessmentForm))
    || [record.contentHint, record.answerRevealed, record.schedulingEligible].some(value => value !== undefined && typeof value !== 'boolean')) {
    throw new DomainError('Invalid evidence assessment metadata');
  }
  if (!record.id || !record.conceptId || !Number.isInteger(record.seq) || record.seq < 1 || ![1, 2, 3, 4].includes(record.level)) {
    throw new DomainError('Invalid evidence identity, sequence or level');
  }
  return { ...record };
}
type EffectiveRecord = { readonly record: Evidence; readonly revision: number; readonly retracted: boolean; readonly disputed: boolean; readonly lastSeq: number };
function applyCorrection(state: Readonly<Record<string, EffectiveRecord>>, correction: Correction): Readonly<Record<string, EffectiveRecord>> {
  const root = state[correction.rootRecordId];
  if (!root) throw new DomainError('Correction root does not exist');
  if (!Number.isInteger(correction.seq) || correction.seq <= root.lastSeq) throw new DomainError('Correction sequence conflict');
  if (!['amend', 'retract', 'dispute', 'resolve'].includes(correction.action)) throw new DomainError('Invalid correction action');
  if (['retract', 'dispute'].includes(correction.action) && correction.replacement !== undefined) throw new DomainError('This correction cannot replace metadata');
  if (correction.expectedEffectiveRevision !== root.revision || correction.effectiveRevision !== root.revision + 1) throw new DomainError('Correction revision conflict');
  const allowed = correction.action === 'resolve' ? ['contentGrade', 'confidence', 'contentHint', 'answerRevealed'] : ['confidence', 'contentHint', 'answerRevealed'];
  if (Object.keys(correction.replacement ?? {}).some(key => !allowed.includes(key))) throw new DomainError('Immutable evidence field');
  if (correction.action === 'resolve' && (!root.disputed || root.retracted)) throw new DomainError('Only a disputed record can resolve');
  return { ...state, [correction.rootRecordId]: {
    record: validateRecord({ ...root.record, ...correction.replacement }), revision: correction.effectiveRevision, lastSeq: correction.seq,
    retracted: root.retracted || correction.action === 'retract',
    disputed: correction.action === 'dispute' || (root.disputed && correction.action !== 'resolve'),
  } };
}
export function effectiveEvidence(evidence: readonly Evidence[], corrections: readonly Correction[] = []) {
  if (new Set(evidence.map(record => record.id)).size !== evidence.length) throw new DomainError('Duplicate evidence identity');
  const initial: Readonly<Record<string, EffectiveRecord>> = Object.fromEntries(evidence.map(record => [record.id, { record: validateRecord(record), revision: 0, retracted: false, disputed: false, lastSeq: record.seq }]));
  const effective = [...corrections].sort((a, b) => a.seq - b.seq).reduce(applyCorrection, initial);
  return {
    records: Object.values(effective).filter(root => !root.retracted && !root.disputed).map(root => root.record).sort(compareEvidence),
    disputed: Object.values(effective).filter(root => root.disputed && !root.retracted).map(root => root.record),
    asOfSeq: Math.max(0, ...evidence.map(record => record.seq), ...corrections.map(record => record.seq)),
  };
}

export function assertProjectionScope(records: readonly Evidence[]): void {
  if (new Set(records.map(record => `${record.conceptId}:${record.level}`)).size > 1) {
    throw new DomainError('A projection must contain one concept and level');
  }
}
