import { DefaultScheduler, Rating } from 'ts-fsrs';
import { FSRS7_DEFAULT_WEIGHTS } from 'ts-fsrs/models/fsrs-7';
import { assertProjectionScope, effectiveEvidence, evidenceStrength } from './evidence.ts';
import { DomainError } from './errors.ts';
import { instant } from './time.ts';
import type { Correction, Evidence, Level } from './types.ts';

export interface SchedulerManifest {
  readonly rulesVersion: 1;
  readonly engine: 'ts-fsrs';
  readonly engineVersion: '6.0.0';
  readonly model: 'FSRS-7';
  readonly parameters: {
    readonly request_retention: number;
    readonly enable_fuzz: boolean;
    readonly maximum_interval: number;
    readonly w: readonly number[];
  };
}

export function createSchedulerManifest(): SchedulerManifest {
  return { rulesVersion: 1, engine: 'ts-fsrs', engineVersion: '6.0.0', model: 'FSRS-7',
    parameters: { request_retention: 0.9, enable_fuzz: false, maximum_interval: 36_500, w: [...FSRS7_DEFAULT_WEIGHTS] } };
}

export function schedulerRating(record: Evidence): 'Good' | 'Again' | 'Hard' | null {
  const strength = evidenceStrength(record);
  if (record.schedulingEligible === false) return null;
  if (strength === 'strong') return 'Good';
  if (strength === 'miss') return 'Again';
  if (strength === 'practice') return 'Hard';
  return null;
}

export interface ScheduleProjection {
  readonly card: Readonly<Record<string, unknown>>;
  readonly logs: readonly Readonly<Record<string, unknown>>[];
  readonly dueAt: string;
  readonly lastRatedSeq: number;
  readonly ratingCount: number;
  readonly manifest: SchedulerManifest;
}

export interface ScheduleOptions { readonly conceptId?: string; readonly level?: Level; readonly manifest?: SchedulerManifest; }

function validateManifest(manifest: SchedulerManifest): void {
  if (manifest.rulesVersion !== 1 || manifest.engine !== 'ts-fsrs' || manifest.engineVersion !== '6.0.0' || manifest.model !== 'FSRS-7') {
    throw new DomainError('Unsupported scheduler manifest');
  }
  if (manifest.parameters.enable_fuzz !== false) throw new DomainError('Random schedule fuzzing is disabled in rules v1');
}

export async function replaySchedule(
  evidence: readonly Evidence[], corrections: readonly Correction[] = [], options: ScheduleOptions = {},
): Promise<ScheduleProjection | null> {
  const manifest = options.manifest ?? createSchedulerManifest();
  validateManifest(manifest);
  const records = effectiveEvidence(evidence, corrections).records.filter(record =>
    (!options.conceptId || options.conceptId === record.conceptId) && (!options.level || options.level === record.level));
  assertProjectionScope(records);
  const acceptedRecords = records.filter(record => schedulerRating(record) !== null).map(record => {
    if (record.acceptedAt === undefined) throw new DomainError('Acceptance time required for scheduling evidence');
    return { ...record, acceptedAt: record.acceptedAt };
  }).sort((a, b) => instant(a.acceptedAt) - instant(b.acceptedAt) || a.seq - b.seq);
  const scheduler = await DefaultScheduler({ version: 'FSRS-7', weights: [...manifest.parameters.w],
    desiredRetention: manifest.parameters.request_retention, enableFuzz: false, maximumInterval: manifest.parameters.maximum_interval });
  let card: ReturnType<typeof scheduler.newCard> | undefined;
  let logs: readonly ReturnType<typeof scheduler.review>['revlog'][] = [];
  let lastRatedSeq = 0;
  let lastTime = 0;
  for (const record of acceptedRecords) {
    const rating = schedulerRating(record);
    if (!rating || (!card && rating !== 'Good')) continue;
    const now = new Date(Math.max(lastTime, instant(record.acceptedAt)));
    const current = card ?? scheduler.newCard({ cardId: `${record.conceptId}:${record.level}`, now });
    const result = scheduler.review({ card: current, grade: Rating[rating], now });
    card = result.card; logs = [...logs, result.revlog]; lastTime = now.getTime(); lastRatedSeq = record.seq;
  }
  if (!card) return null;
  return JSON.parse(JSON.stringify({ card, logs, dueAt: card.dueAt.toISOString(), lastRatedSeq, ratingCount: logs.length, manifest }));
}
