import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evidenceFromRow, loadEvidenceRows } from '../src/data/projections';
import { replaySchedule } from '@teach/domain';
import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { createRepository, initialise, type Admission, type Envelope, type Success } from '../src/data/index';

let mf: Miniflare;
let db: D1Database;
let repo: ReturnType<typeof createRepository>;
const learner = 'l_11111111-1111-4111-8111-111111111111';
const actor: Admission = { learner_id: learner, connection_id: 'test-grant', generation: 1, scopes: ['teach:read', 'teach:learn', 'teach:organize'] };
const time = '2026-10-29T10:00:00.000Z';
const envelope = (operation: string, data: Record<string, unknown>, rest: Partial<Envelope> = {}): Envelope => ({ protocol_version: 1, rules_version: 1, recovery_generation: 1, request_id: crypto.randomUUID(), operation, reason: 'Synthetic local test', expected: {}, data, ...rest });
const success = (result: Awaited<ReturnType<typeof repo.execute>>): Success => { if (!result.ok) throw new Error(JSON.stringify(result)); return result; };
const id = (result: Success): string => { const value = result.data.ids?.[0]; if (!value) throw new Error('Missing id'); return value; };
const concept = () => repo.execute(envelope('concept_upsert', { realm: 'cs', area: 'concurrency', slug: 'locks', title: 'Locks', purpose: 'Coordinate access', origin: 'inquiry', anchor_ids: [] }), actor).then(success);

beforeEach(async () => {
  mf = new Miniflare({ workers: [{ config: {
    name: 'data-test', compatibilityDate: '2026-10-01',
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: 'export default {fetch(){return new Response("test")}}' } } },
    env: { LEARNING_DB: { type: 'd1', id: crypto.randomUUID() } },
  } }] });
  db = await mf.getD1Database('LEARNING_DB');
  const schema = await readFile(new URL('../migrations/0001_foundation.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  await initialise(db, { learnerId: learner, generation: 1, timezone: 'Asia/Kolkata' });
  repo = createRepository(db, { now: () => new Date(time) });
});
afterEach(async () => { await mf?.dispose(); });

describe('real D1 learning repository', () => {
  it('removes retracted inquiry interest from growth ranking', async () => {
    const sitting = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const c = id(await concept());
    success(await repo.execute(envelope('set_aim', { concept_id: c, owner_kind: 'learner', owner_id: learner, level: 2, parked: false }), actor));
    const inquiry = id(success(await repo.execute(envelope('log_inquiry', { text: 'Why ownership?', concept_ids: [c] }, { session_id: sitting }), actor)));
    expect(success(await repo.read('next', { slot: 'growth' }, actor)).data.rows).toEqual([expect.objectContaining({ concept_id: c, score: 4 })]);
    success(await repo.execute(envelope('retract', { root_record_id: inquiry, expected_effective_revision: 0, reason: 'Withdrawn' }), actor));
    expect(success(await repo.read('next', { slot: 'growth' }, actor)).data.rows).toEqual([expect.objectContaining({ concept_id: c, score: 2 })]);
  });

  it('requires an explicit goal identity when reading one goal', async () => {
    success(await repo.execute(envelope('goal_create', { title: 'Understand locks', source: {} }), actor));
    expect(await repo.read('goal_get', {}, actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('rejects an aim on an archived candidate without making an invisible frontier entry', async () => {
    const c = id(await concept());
    success(await repo.execute(envelope('archive_candidate', { concept_ids: [c] }, { expected: { [c]: 1 } }), actor));
    expect(await repo.execute(envelope('set_aim', { concept_id: c, owner_kind: 'learner', owner_id: learner, level: 2, parked: false }), actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM aims WHERE concept_id=?').bind(c).first('n')).toBe(0);
    expect(success(await repo.read('frontier', {}, actor)).data.rows).toEqual([]);
  });

  it('saves a goal-free session, inquiry and learner-owned aim', async () => {
    const session = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const c = id(await concept());
    const aim = success(await repo.execute(envelope('set_aim', { concept_id: c, owner_kind: 'learner', owner_id: learner, level: 2, parked: false }), actor));
    expect(aim.data.ids).toHaveLength(1);
    success(await repo.execute(envelope('log_inquiry', { text: 'Why do locks need ownership?', concept_ids: [c] }, { session_id: session }), actor));
    const state = success(await repo.read('concept_get', { concept_id: c }, actor));
    expect(state.data.concept).toMatchObject({ id: c, title: 'Locks' });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM inquiries').first('n')).toBe(1);
  });

  it('replays a lost acknowledgement once and rejects changed content under its key', async () => {
    const request = envelope('session_start', {});
    const first = success(await repo.execute(request, actor));
    const retry = success(await repo.execute(request, actor));
    expect(retry.data).toEqual(first.data);
    expect(retry.meta.replayed).toBe(true);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM sessions').first('n')).toBe(1);
    const changed = await repo.execute({ ...request, reason: 'Different semantic content' }, actor);
    expect(changed).toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_MISMATCH' } });
  });

  it('allows only one concurrent optimistic metadata edit', async () => {
    const c = id(await concept());
    const edit = (title: string) => repo.execute(envelope('concept_upsert', { id: c, realm: 'cs', area: 'concurrency', slug: 'locks', title, purpose: 'Coordinate access', origin: 'inquiry', anchor_ids: [] }, { expected: { [c]: 1 } }), actor);
    const results = await Promise.all([edit('Mutex'), edit('Semaphore')]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok && r.error.code === 'VERSION_CONFLICT')).toHaveLength(1);
    expect(await db.prepare('SELECT version FROM concepts WHERE id=?').bind(c).first('version')).toBe(2);
  });

  it('does not replay private saved content through a stale recovery generation', async () => {
    const request = envelope('session_start', {});
    success(await repo.execute(request, actor));
    await db.prepare('UPDATE meta SET generation=2').run();
    expect(await repo.execute(request, actor)).toMatchObject({ ok: false, error: { code: 'STALE_GENERATION' } });
    expect(await repo.execute(request, { ...actor, generation: 2 })).toMatchObject({ ok: false, error: { code: 'STALE_GENERATION' } });
  });

  it('fences disabled storage without leaving an event or partial session', async () => {
    await db.prepare('UPDATE meta SET write_enabled=0').run();
    expect(await repo.execute(envelope('session_start', {}), actor)).toMatchObject({ ok: false, error: { code: 'MAINTENANCE' } });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM sessions').first('n')).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM event_log').first('n')).toBe(0);
  });

  it('requires scope and rejects unknown versions and forged identity fields', async () => {
    expect(await repo.execute(envelope('session_start', {}), { ...actor, scopes: ['teach:read'] })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await repo.execute(envelope('session_start', {}, { rules_version: 9 }), actor)).toMatchObject({ ok: false, error: { code: 'INCOMPATIBLE_VERSION' } });
    expect(await repo.execute({ ...envelope('session_start', {}), learner_id: learner }, actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('stores exposure as Exposed, never lets an external caller assert a grade', async () => {
    const c = id(await concept());
    const session = id(success(await repo.execute(envelope('session_start', {}), actor)));
    success(await repo.execute(envelope('record', { records: [{ kind: 'exposure', concept_id: c, level: 2, source: { kind: 'conversation' }, occurred_at: time }] }, { session_id: session }), actor));
    const state = success(await repo.read('mastery', { concept_id: c }, actor));
    expect(state.data.rows).toContainEqual(expect.objectContaining({ concept_id: c, level: 2, state: 'Exposed' }));
    expect(await repo.execute(envelope('record', { records: [{ kind: 'answer', concept_id: c, level: 2, content_grade: 'correct', strength: 'strong', source: {}, occurred_at: time }] }, { session_id: session }), actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('rejects prerequisite cycles atomically', async () => {
    const a = id(await concept()); const b = id(await concept());
    success(await repo.execute(envelope('link', { from_id: a, to_id: b, kind: 'requires' }), actor));
    expect(await repo.execute(envelope('link', { from_id: b, to_id: a, kind: 'requires' }), actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM links').first('n')).toBe(1);
  });

  it('cannot silently merge or close a goal without trusted confirmation', async () => {
    const a = id(await concept()); const b = id(await concept());
    expect(await repo.execute(envelope('concept_merge', { source_id: a, target_id: b, expected_source_version: 1, expected_target_version: 1, confirmation_id: 'forged' }), actor)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const goal = id(success(await repo.execute(envelope('goal_create', { title: 'Learn concurrency', source: {} }), actor)));
    expect(await repo.execute(envelope('goal_close', { goal_id: goal, decisions: [], confirmation_id: 'forged' }), actor)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('correction races accept one revision and cannot forge graded evidence', async () => {
    const session = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const inquiry = id(success(await repo.execute(envelope('log_inquiry', { text: 'Why locks?', concept_ids: [] }, { session_id: session }), actor)));
    const amend = (text: string) => repo.execute(envelope('amend', { root_record_id: inquiry, expected_effective_revision: 0, replacement: { text }, reason: 'Clarify question' }, { session_id: session }), actor);
    const results = await Promise.all([amend('Why exclusive locks?'), amend('Why shared locks?')]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(await repo.execute(envelope('amend', { root_record_id: inquiry, expected_effective_revision: 1, replacement: { content_grade: 'correct' }, reason: 'Pretend grade' }, { session_id: session }), actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM record_corrections').first('n')).toBe(1);
  });

  it('exposes only allowlisted prepared views, not SQL strings', async () => {
    await concept();
    const read = success(await repo.read('query', { view: 'v_concepts', select: ['id', 'title'], filters: { realm: 'cs' } }, actor));
    expect(read.data.rows).toHaveLength(1);
    expect(await repo.read('query', { view: 'v_concepts; DROP TABLE concepts', select: ['id'], filters: {} }, actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('refuses a database schema newer than this runtime', async () => {
    await db.prepare('UPDATE meta SET schema_version=2').run();
    expect(await repo.execute(envelope('session_start', {}), actor)).toMatchObject({ ok: false, error: { code: 'INCOMPATIBLE_VERSION' } });
  });
  it('keeps source evidence immutable while merging canonical concepts and coalescing aims', async () => {
    const sitting = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const source = id(await concept());
    const target = id(success(await repo.execute(envelope('concept_upsert', { realm: 'cs', area: 'concurrency', slug: 'mutex', title: 'Mutex', purpose: 'Mutual exclusion', origin: 'inquiry', anchor_ids: [] }), actor)));
    success(await repo.execute(envelope('set_aim', { concept_id: source, owner_kind: 'learner', owner_id: learner, level: 2, parked: false }), actor));
    success(await repo.execute(envelope('set_aim', { concept_id: target, owner_kind: 'learner', owner_id: learner, level: 3, parked: false }), actor));
    success(await repo.execute(envelope('record', { records: [{ kind: 'exposure', concept_id: source, level: 1, occurred_at: time, source: {} }] }, { session_id: sitting }), actor));
    const approval = { id: 'trusted-local-test', operation: 'concept_merge' };
    success(await repo.execute(envelope('concept_merge', { source_id: source, target_id: target, expected_source_version: 1, expected_target_version: 1, confirmation_id: approval.id }), { ...actor, confirmation: approval }));
    expect(await db.prepare('SELECT concept_id FROM evidence').first('concept_id')).toBe(source);
    expect(await db.prepare('SELECT merged_into FROM concepts WHERE id=?').bind(source).first('merged_into')).toBe(target);
    expect(await db.prepare('SELECT level FROM aims WHERE active=1').first('level')).toBe(3);
    const canonical = success(await repo.read('concept_get', { concept_id: source }, actor));
    expect(canonical.data.concept).toMatchObject({ id: target });
    expect(canonical.data.mastery).toEqual(expect.arrayContaining([expect.objectContaining({ level: 1, state: 'Exposed' })]));
  });

  it('ranks the growth frontier and reports goal readiness', async () => {
    const c = id(await concept());
    const goal = id(success(await repo.execute(envelope('goal_create', { title: 'Understand concurrency', source: {}, urgent: false }), actor)));
    success(await repo.execute(envelope('set_aim', { concept_id: c, owner_kind: 'goal', owner_id: goal, level: 2, parked: false }), actor));
    expect(success(await repo.read('next', { slot: 'growth' }, actor)).data.rows).toEqual([expect.objectContaining({ concept_id: c, aim_level: 2 })]);
    expect(success(await repo.read('goal_get', { id: goal }, actor)).data.goal).toMatchObject({ readiness: { met: 0, total: 1, provisional: false } });
  });

  it('keeps owner aims through explicit goal closure and supports metadata lifecycle', async () => {
    const g = id(success(await repo.execute(envelope('goal_create', { title: 'Concurrency', source: {}, urgent: true }), actor)));
    success(await repo.execute(envelope('goal_update', { id: g, title: 'Concurrency foundations', source: {}, urgent: false }, { expected: { [g]: 1 } }), actor));
    const c = id(await concept());
    const a = id(success(await repo.execute(envelope('set_aim', { concept_id: c, owner_kind: 'goal', owner_id: g, level: 2, parked: false }), actor)));
    success(await repo.execute(envelope('park_aim', { id: a }, { expected: { [a]: 1 } }), actor));
    success(await repo.execute(envelope('unpark_aim', { id: a }, { expected: { [a]: 2 } }), actor));
    const confirm = { id: 'trusted-close', operation: 'goal_close' };
    success(await repo.execute(envelope('goal_close', { goal_id: g, decisions: [{ aim_id: a, action: 'keep' }], confirmation_id: confirm.id }, { expected: { [g]: 2 } }), { ...actor, confirmation: confirm }));
    expect(await db.prepare('SELECT state FROM goals WHERE id=?').bind(g).first('state')).toBe('closed');
    expect(await db.prepare('SELECT owner_kind FROM aims WHERE active=1').first('owner_kind')).toBe('learner');
    success(await repo.execute(envelope('set_balance', { urgent_pct: 40 }), actor));
    const note = id(success(await repo.execute(envelope('write_learner_note', { kind: 'preference', text: 'Use examples' }), actor)));
    success(await repo.execute(envelope('write_learner_note', { id: note, kind: 'preference', text: 'Use concrete examples' }, { expected: { [note]: 1 } }), actor));
    expect(success(await repo.read('learner_notes', {}, actor)).data.rows).toEqual([expect.objectContaining({ text: 'Use concrete examples' })]);
    expect(success(await repo.read('goal_list', { state: 'closed' }, actor)).data.rows).toHaveLength(1);
    expect(success(await repo.read('aims', {}, actor)).data.rows).toHaveLength(1);
    expect(success(await repo.read('gaps', {}, actor)).data.rows).toHaveLength(1);
    expect(success(await repo.read('mastery', { realm: 'math' }, actor)).data.rows).toHaveLength(0);
    expect(success(await repo.read('aims', { realm: 'math' }, actor)).data.rows).toHaveLength(0);
    expect(success(await repo.read('frontier', {}, actor)).data.rows).toHaveLength(1);
  });

  it('preserves correction history while effective inbox and mastery exclude retractions', async () => {
    const sitting = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const c = id(await concept());
    const inquiry = id(success(await repo.execute(envelope('log_inquiry', { text: 'Original question', concept_ids: [c], unresolved: true }, { session_id: sitting }), actor)));
    success(await repo.execute(envelope('amend', { root_record_id: inquiry, expected_effective_revision: 0, replacement: { text: 'Corrected question' }, reason: 'Clarify' }), actor));
    expect(success(await repo.read('inbox', {}, actor)).data.rows).toEqual([expect.objectContaining({ text: 'Corrected question', effective_revision: 1 })]);
    expect(success(await repo.read('needs_you', {}, actor)).data.rows).toHaveLength(1);
    success(await repo.execute(envelope('retract', { root_record_id: inquiry, expected_effective_revision: 1, reason: 'Duplicate' }), actor));
    expect(success(await repo.read('inbox', {}, actor)).data.rows).toHaveLength(0);
    expect(success(await repo.read('history', { record_id: inquiry }, actor)).data.rows).toHaveLength(2);
    expect(success(await repo.read('mastery', { concept_id: c, level: 1 }, actor)).data.rows).toEqual([expect.objectContaining({ state: 'Unknown' })]);
    expect(await db.prepare('SELECT text FROM inquiries WHERE id=?').bind(inquiry).first('text')).toBe('Original question');
    success(await repo.execute(envelope('session_end', { session_id: sitting, exit_ticket: { learned: 'Locks' } }, { expected: { [sitting]: 1 } }), actor));
    expect(success(await repo.read('sessions', { state: 'closed' }, actor)).data.rows).toHaveLength(1);
  });

  it('supports shared session resume and prepared search, links and candidate lifecycle', async () => {
    const sitting = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const other = { ...actor, connection_id: 'other-grant' };
    expect(await repo.execute(envelope('log_inquiry', { text: 'Question', concept_ids: [] }, { session_id: sitting }), other)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(id(success(await repo.execute(envelope('session_start', { resume_session_id: sitting }), other)))).toBe(sitting);
    const c = id(await concept());
    const candidate = id(success(await repo.execute(envelope('propose_candidates', { concepts: [{ realm: 'cs', area: 'concurrency', slug: 'atomic', title: 'Atomic', purpose: 'Indivisible operations', origin: 'frontier' }] }), actor)));
    success(await repo.execute(envelope('link', { from_id: c, to_id: candidate, kind: 'relates' }), actor));
    expect(success(await repo.read('neighbors', { concept_id: c }, actor)).data.rows).toHaveLength(1);
    success(await repo.execute(envelope('unlink', { from_id: c, to_id: candidate, kind: 'relates' }), actor));
    success(await repo.execute(envelope('archive_candidate', { concept_ids: [candidate] }, { expected: { [candidate]: 1 } }), actor));
    expect(success(await repo.read('concept_search', { query: 'Locks', realm: 'cs' }, actor)).data.rows).toHaveLength(1);
    expect(success(await repo.read('query', { view: 'v_concepts', select: ['title'], filters: { archived: 0 } }, actor)).data.rows).toEqual([{ title: 'Locks' }]);
    expect(success(await repo.read('whoami', {}, actor)).data.learner_id).toBe(learner);
    expect(success(await repo.read('protocol', {}, actor)).data.no_client_grade_assertion).toBe(true);
  });

  it('rejects invalid references, corrections and pagination without state changes', async () => {
    const sitting = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const c = id(await concept());
    const e = id(success(await repo.execute(envelope('record', { records: [{ kind: 'observed', concept_id: c, level: 2, occurred_at: time, source: {}, content: 'Worked example', help: { content_hint: true, answer_revealed: true } }] }, { session_id: sitting }), actor)));
    success(await repo.execute(envelope('amend', { root_record_id: e, expected_effective_revision: 0, replacement: { confidence: 'think', help: { content_hint: false, answer_revealed: false }, content: 'Clearer explanation' }, reason: 'Correct explanation' }), actor));
    const invalidAmend = async (replacement: Record<string, unknown>) => expect(await repo.execute(envelope('amend', { root_record_id: e, expected_effective_revision: 1, replacement, reason: 'Invalid correction' }), actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    await invalidAmend({ confidence: 'certain' }); await invalidAmend({ content: 1 }); await invalidAmend({ help: [] });
    expect(await repo.read('mastery', { limit: 101 }, actor)).toMatchObject({ ok: false });
    expect(await repo.read('concept_search', { query: {} }, actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(await repo.read('mastery', { cursor: 'bad!' }, actor)).toMatchObject({ ok: false });
    expect(await repo.read('next', { slot: 'other' }, actor)).toMatchObject({ ok: false });
    expect(await repo.read('concept_get', {}, actor)).toMatchObject({ ok: false });
    expect(await repo.read('goal_get', { id: 'g_00000000-0000-4000-8000-000000000000' }, actor)).toMatchObject({ ok: false });
    expect(await repo.read('whoami', {}, { ...actor, scopes: [] })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await repo.read('whoami', {}, { ...actor, generation: 2 })).toMatchObject({ ok: false, error: { code: 'STALE_GENERATION' } });
    await initialise(db, { learnerId: learner });
    await expect(initialise(db, { learnerId: 'l_00000000-0000-4000-8000-000000000000' })).rejects.toThrow('another learner');
  });

  it('allows corrections to owned closed sessions and restricts ordinary withdrawal to inquiry or exposure', async () => {
    const sitting = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const c = id(await concept());
    const evidence = id(success(await repo.execute(envelope('record', { records: [{ kind: 'observed', concept_id: c, level: 1, occurred_at: time, source: {}, content: 'Observed behavior' }] }, { session_id: sitting }), actor)));
    success(await repo.execute(envelope('session_end', { session_id: sitting }, { expected: { [sitting]: 1 } }), actor));
    success(await repo.execute(envelope('amend', { root_record_id: evidence, expected_effective_revision: 0, replacement: { content: 'Clearer observation' }, reason: 'Clarify after session' }), actor));
    expect(await repo.execute(envelope('retract', { root_record_id: evidence, expected_effective_revision: 1, reason: 'Withdraw' }), actor)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('projects trusted grades using their bound immutable production item version', async () => {
    const sitting = id(success(await repo.execute(envelope('session_start', {}), actor)));
    const c = id(await concept());
    const item = `i_${crypto.randomUUID()}`, verification = `iv_${crypto.randomUUID()}`, attempt = `att_${crypto.randomUUID()}`, evidence = `e_${crypto.randomUUID()}`;
    await db.batch([
      db.prepare("INSERT INTO items(id,learner_id,concept_id,level,type) VALUES(?,?,?,?,?)").bind(item, learner, c, 1, 'short_answer'),
      db.prepare("INSERT INTO item_versions(item_id,item_version,stem,context_json,assessment_form,key_points_json,distractors_json,content_sha256) VALUES(?,1,'Explain ownership','{}','production','[]','[]','trusted-test-hash')").bind(item),
      db.prepare("INSERT INTO item_verifications(id,learner_id,item_id,item_version,capture_set_hash,prompt_version,state,result_json,verifier_provenance_json,seq,result_job_id) VALUES(?,?,?,1,'trusted-captures',1,'supported','{}','{}',2,'trusted-job')").bind(verification, learner, item),
      db.prepare("INSERT INTO attempts(id,learner_id,session_id,item_id,item_version,answer,confidence,help_json,occurred_at,accepted_at,timezone,local_day,state,verification_id) VALUES(?,?,?,?,1,'Ownership prevents invalid unlock','sure','{}',?,'2026-10-29T09:00:00.000Z','Asia/Kolkata','2026-10-28','graded',?)").bind(attempt, learner, sitting, item, '2026-10-28T10:00:00.000Z', verification),
      db.prepare("INSERT INTO evidence(id,learner_id,seq,concept_id,level,session_id,attempt_id,kind,content_grade,strength,confidence,help_json,occurred_at,accepted_at,timezone,local_day,source_json,rules_version) VALUES(?,?,2,?,1,?,?,'answer','correct','strong','sure','{}',?,'2026-10-29T10:00:00.000Z','Asia/Kolkata','2026-10-28','{}',1)").bind(evidence, learner, c, sitting, attempt, '2026-10-28T10:00:00.000Z'),
    ]);
    await expect(db.prepare("INSERT INTO evidence SELECT ?,learner_id,version,created_seq,updated_seq,seq,concept_id,level,session_id,attempt_id,kind,content_grade,strength,confidence,help_json,occurred_at,accepted_at,timezone,local_day,source_json,content,rules_version FROM evidence WHERE id=?").bind(`e_${crypto.randomUUID()}`, evidence).run()).rejects.toThrow();
    success(await repo.execute(envelope('record', { records: [{ kind: 'exposure', concept_id: c, level: 2, occurred_at: time, source: {} }] }, { session_id: sitting }), actor));
    expect(success(await repo.read('mastery', { concept_id: c, level: 1 }, actor)).data.rows).toEqual([expect.objectContaining({ state: 'Solid' })]);
    const trusted = (await loadEvidenceRows(db, learner)).map(evidenceFromRow).filter(e => e.level === 1);
    expect(trusted[0]).toMatchObject({ acceptedAt: '2026-10-29T09:00:00.000Z', occurredAt: '2026-10-28T10:00:00.000Z', assessmentForm: 'production' });
    const schedule = await replaySchedule(trusted, [], { conceptId: c, level: 1 });
    expect(schedule).not.toBeNull();
    expect(new Date(schedule!.dueAt).getTime()).toBeGreaterThan(new Date('2026-10-29T09:00:00.000Z').getTime());
    const historical = success(await repo.read('mastery', { concept_id: c, level: 1 }, actor)).data.rows![0]!;
    expect(JSON.parse(String(historical.strong_days_json))).toEqual(['2026-10-28']);
    expect(await repo.execute(envelope('record', { records: [{ kind: 'exposure', concept_id: c, level: 1, occurred_at: time, source: {}, assessment_form: 'production', content_grade: 'correct' }] }, { session_id: sitting }), actor)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

});
