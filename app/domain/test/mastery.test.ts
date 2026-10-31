import { describe, expect, it } from 'vitest';
import { deriveMastery, effectiveEvidence, evidenceStrength, localDay, type Evidence, type Correction } from '../src/index.ts';

const observed = (overrides: Partial<Evidence> = {}): Evidence => ({
  id: 'e_1', seq: 1, conceptId: 'c_1', level: 2, kind: 'answer', contentGrade: 'correct',
  confidence: 'sure', occurredAt: '2026-10-27T10:00:00.000Z', localDay: '2026-10-27', assessmentForm: 'production',
  ...overrides,
});
const second = (overrides: Partial<Evidence> = {}) => observed({ id: 'e_2', seq: 2,
  occurredAt: '2026-10-28T10:00:00.000Z', localDay: '2026-10-28', ...overrides });
const correction = (overrides: Partial<Correction> = {}): Correction => ({
  rootRecordId: 'e_1', expectedEffectiveRevision: 0, effectiveRevision: 1, action: 'dispute', seq: 3, ...overrides,
});

describe('mastery from dated independent evidence', () => {
  it('starts unknown, while being taught establishes only Exposed', () => {
    expect(deriveMastery([]).state).toBe('Unknown');
    expect(deriveMastery([observed({ kind: 'exposure', contentGrade: 'na' })]).state).toBe('Exposed');
  });
  it('becomes Solid after one strong correct, Secure on a second local day', () => {
    expect(deriveMastery([observed()]).state).toBe('Solid');
    expect(deriveMastery([observed(), second()]).state).toBe('Secure');
    expect(deriveMastery([observed(), second()]).strongDays).toEqual(['2026-10-27', '2026-10-28']);
  });
  it('same-day repeats cannot manufacture Secure', () => {
    expect(deriveMastery([observed(), second({ localDay: '2026-10-27' })]).state).toBe('Solid');
  });
  it.each([{ confidence: 'guess' as const }, { confidence: 'unknown' as const },
    { contentHint: true }, { answerRevealed: true }, { assessmentForm: 'recognition' as const }])(
    'practice or unknown answers do not prove independence or erase demonstrated mastery: %j', (help) => {
      expect(deriveMastery([observed(help)]).state).toBe('Exposed');
      expect(deriveMastery([observed(), second(help)]).state).toBe('Solid');
    });
  it('a genuine miss clears previous strong days until new independent answers', () => {
    const miss = second({ contentGrade: 'partial' });
    expect(deriveMastery([observed(), miss]).state).toBe('Shaky');
    expect(deriveMastery([observed(), miss, second({ id: 'e_3', seq: 3, localDay: '2026-10-29', occurredAt: '2026-10-29T10:00:00Z' })]).state).toBe('Solid');
  });
  it('wrong content is a miss even with low or omitted confidence', () => {
    expect(evidenceStrength(observed({ contentGrade: 'wrong', confidence: 'unknown' }))).toBe('miss');
    expect(evidenceStrength(observed({ contentGrade: 'partial', confidence: 'guess' }))).toBe('miss');
  });
  it('inquiries, self-ratings, observed work and inferred support do not create strong performance', () => {
    for (const kind of ['inquiry', 'self_rating', 'observed', 'inferred'] as const) {
      expect(deriveMastery([observed({ kind })]).state).toBe('Exposed');
    }
  });
  it('sorts by occurred_at then server sequence without mutating input', () => {
    const first = observed(); const next = second(); const evidence = Object.freeze([Object.freeze(next), Object.freeze(first)]);
    expect(deriveMastery(evidence).state).toBe('Secure');
    expect(evidence[0]).toBe(next);
    expect(deriveMastery([second({ contentGrade: 'wrong', occurredAt: first.occurredAt }), first]).state).toBe('Shaky');
  });
  it('filters concept and level rather than transferring mastery from another concept or depth', () => {
    expect(deriveMastery([observed(), second({ conceptId: 'c_other' })], [], { conceptId: 'c_1', level: 2 }).state).toBe('Solid');
    expect(deriveMastery([observed({ level: 4 })], [], { conceptId: 'c_1', level: 2 }).state).toBe('Unknown');
  });
  it('stale and fading flags do not demote demonstrated understanding', () => {
    const result = deriveMastery([observed(), second()], [], { stale: true, now: '2026-11-10T00:00:00Z', dueAt: '2026-11-01T00:00:00Z', lastIntervalDays: 2 });
    expect(result).toMatchObject({ state: 'Secure', stale: true, fading: true });
    expect(deriveMastery([observed()], [], { now: '2026-11-05T00:00:00Z', dueAt: '2026-11-01T00:00:00Z', lastIntervalDays: 2 }).fading).toBe(false);
  });
  it('uses the saved learner-local day rather than grader completion or current timezone', () => {
    expect(localDay('2026-10-27T20:00:00Z', 'Asia/Kolkata')).toBe('2026-10-28');
    expect(localDay('2026-10-27T20:00:00Z', 'America/New_York')).toBe('2026-10-27');
  });
  it('rejects invalid timestamps and local-day labels before replay', () => {
    expect(() => deriveMastery([observed({ occurredAt: 'not-a-time' })])).toThrow();
    expect(() => deriveMastery([observed({ localDay: '2026-02-30' })])).toThrow();
    expect(() => localDay('invalid', 'Asia/Kolkata')).toThrow();
  });
});

describe('correction replay', () => {
  it('a disputed attempt is excluded and projection remains provisional', () => {
    expect(deriveMastery([observed(), second()], [correction()])).toMatchObject({ state: 'Solid', provisional: true });
  });
  it('regrading replaces the original performance rather than awarding another day', () => {
    const cs = [correction(), correction({ expectedEffectiveRevision: 1, effectiveRevision: 2, seq: 4,
      action: 'resolve', replacement: { contentGrade: 'wrong' } })];
    const result = deriveMastery([observed(), second()], cs);
    expect(result).toMatchObject({ state: 'Solid', strongDays: ['2026-10-28'], provisional: false });
    expect(effectiveEvidence([observed(), second()], cs).records).toHaveLength(2);
  });
  it('retraction preserves source arrays and removes only its root from effective evidence', () => {
    const roots = [observed(), second()]; const before = JSON.stringify(roots);
    expect(effectiveEvidence(roots, [correction({ action: 'retract' })]).records.map(r => r.id)).toEqual(['e_2']);
    expect(JSON.stringify(roots)).toBe(before);
  });
  it('rejects stale, duplicate or missing-root corrections and forged identity replacements', () => {
    expect(() => effectiveEvidence([observed()], [correction({ expectedEffectiveRevision: 1, effectiveRevision: 2 })])).toThrow();
    expect(() => effectiveEvidence([observed()], [correction(), correction()])).toThrow();
    expect(() => effectiveEvidence([], [correction()])).toThrow();
    expect(() => effectiveEvidence([observed()], [correction({ action: 'amend', replacement: { conceptId: 'c_evil' } })])).toThrow();
  });
  it('a confidence correction uses the original local day and affects strength only', () => {
    const result = deriveMastery([observed({ confidence: 'unknown' })], [correction({ action: 'amend', replacement: { confidence: 'think' } })]);
    expect(result).toMatchObject({ state: 'Solid', strongDays: ['2026-10-27'] });
  });
});

describe('validated replay inputs', () => {
  it('refuses malformed persisted enums rather than treating them as independent correct', () => {
    for (const fields of [{ confidence: 'certainly' }, { contentGrade: 'excellent' }, { kind: 'agent_guess' }, { assessmentForm: 'untrusted' }]) {
      const record: Evidence = JSON.parse(JSON.stringify({ ...observed(), ...fields }));
      expect(() => deriveMastery([record])).toThrow();
    }
  });
  it('requires ordered positive correction identities newer than their source', () => {
    expect(() => effectiveEvidence([observed()], [correction({seq:0})])).toThrow();
    expect(() => effectiveEvidence([observed()], [correction({seq:1})])).toThrow();
  });
  it('does not allow a non-resolution correction to relabel a grade or carry a replacement on retraction', () => {
    expect(() => effectiveEvidence([observed()], [correction({action:'amend',replacement:{contentGrade:'wrong'}})])).toThrow();
    expect(() => effectiveEvidence([observed()], [correction({action:'retract',replacement:{confidence:'think'}})])).toThrow();
  });
});

it('rejects a mixed projection instead of manufacturing mastery across concepts or levels',()=>{
  expect(()=>deriveMastery([observed(),second({conceptId:'c_2'})])).toThrow('one concept and level');
  expect(()=>deriveMastery([observed(),second({level:3})])).toThrow('one concept and level');
});

it('cannot turn recognition into independent production via correction or change acceptance time',()=>{
 const record=observed({assessmentForm:'recognition',acceptedAt:'2026-10-28T00:00:00Z'});
 expect(()=>effectiveEvidence([record],[correction(),correction({seq:4,expectedEffectiveRevision:1,effectiveRevision:2,action:'resolve',replacement:{assessmentForm:'production'}})])).toThrow('Immutable');
 expect(()=>effectiveEvidence([record],[correction({action:'amend',replacement:{acceptedAt:'2026-11-01T00:00:00Z'}})])).toThrow('Immutable');
 expect(deriveMastery([record]).strongDays).toEqual([]);
});

it('retains the saved learning day despite a later server acceptance time',()=>{
 expect(deriveMastery([observed({acceptedAt:'2026-11-01T00:00:00Z'})]).strongDays).toEqual(['2026-10-27']);
});
