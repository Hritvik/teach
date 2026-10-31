import { assertProjectionScope, effectiveEvidence, evidenceStrength } from './evidence.ts';
import { DomainError } from './errors.ts';
import { instant } from './time.ts';
import type { Correction, Evidence, MasteryOptions, MasteryProjection, MasteryState } from './types.ts';
type Standing = { readonly state: MasteryState; readonly strongDays: readonly string[] };
const empty: Standing = { state: 'Unknown', strongDays: [] };
function observe(standing: Standing, record: Evidence): Standing {
  const strength = evidenceStrength(record);
  if (strength === 'miss') return { state: 'Shaky', strongDays: [] };
  if (strength === 'strong') {
    const strongDays = [...new Set([...standing.strongDays, record.localDay])].sort();
    return { state: strongDays.length >= 2 ? 'Secure' : 'Solid', strongDays };
  }
  return standing.state === 'Unknown' ? { ...standing, state: 'Exposed' } : standing;
}
function isFading(options: MasteryOptions): boolean {
  if (!options.now || !options.dueAt || options.lastIntervalDays === undefined) return false;
  if (!Number.isFinite(options.lastIntervalDays) || options.lastIntervalDays < 0) throw new DomainError('Invalid review interval');
  return instant(options.now) - instant(options.dueAt) > 2 * options.lastIntervalDays * 86_400_000;
}
export function deriveMastery(evidence: readonly Evidence[], corrections: readonly Correction[] = [], options: MasteryOptions = {}): MasteryProjection {
  const matches = (record: Evidence) => (!options.conceptId || record.conceptId === options.conceptId) && (!options.level || record.level === options.level);
  const effective = effectiveEvidence(evidence, corrections);
  assertProjectionScope([...effective.records, ...effective.disputed].filter(matches));
  const standing = effective.records.filter(matches).reduce(observe, empty);
  return { ...standing, provisional: effective.disputed.some(matches), stale: options.stale ?? false, fading: isFading(options), asOfSeq: effective.asOfSeq };
}
