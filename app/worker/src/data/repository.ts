import {planInbox} from './assessment-inbox.ts';
import {ZodError} from 'zod';
import {planItem,planItemNext,planAnswer,planDispute,planAssessmentCompletion} from './assessment.ts';
import {planAnchorCapture} from './assessment-source.ts';
import type {SourceCaptureInput,CapturedSource} from '../grading/source.ts';
import { DomainError } from '@teach/domain';
import type { Admission, Context, Envelope, Meta, Plan, Result, Row, Success } from './types';
import { DataError, failure } from './errors';
import { parseEnvelope, semanticHash } from './validation';
import { planAim, planConcept, planGoal, planNote, planSession } from './entities';
import { planCorrection, planInquiry, planRecords } from './learning';
import { planClose, planLink, planMerge, planQueueTopic } from './graph';
import { planMisc } from './misc';
import { readOperation } from './reads';
export interface RepositoryOptions { readonly now?: () => Date; readonly id?: (prefix: string) => string; readonly captureSource?: (input:SourceCaptureInput)=>Promise<CapturedSource>; }
export async function metadata(db: D1Database): Promise<Meta> {
  const meta = await db.prepare('SELECT * FROM meta WHERE singleton=1').first<Meta>();
  if (!meta || meta.schema_version !== 1 || meta.rules_version !== 1 || meta.protocol_version !== 1) throw new DataError('INCOMPATIBLE_VERSION', 'Learning database requires a compatible runtime and migrations');
  return meta;
}
function checkVersion(envelope: Envelope, actor: Admission, meta: Meta) {
  if (envelope.protocol_version !== 1 || envelope.rules_version !== 1) throw new DataError('INCOMPATIBLE_VERSION', 'Unsupported protocol or rules version');
  if (envelope.recovery_generation !== actor.generation || actor.generation !== meta.generation) throw new DataError('STALE_GENERATION', 'Reorient after recovery or maintenance before writing');
  if (!meta.write_enabled) throw new DataError('MAINTENANCE', 'Learning writes are temporarily paused');
}
function requiredScope(operation: string): string {
  return ['session_start', 'session_end', 'log_inquiry', 'record', 'amend', 'retract','item_next','answer','dispute_answer','submit_to_inbox','resolve_inbox_entry'].includes(operation) ? 'teach:learn' : 'teach:organize';
}
async function plan(ctx: Context): Promise<Plan> {
  const op = ctx.envelope.operation;
  if(op==='submit_to_inbox'||op==='resolve_inbox_entry')return planInbox(ctx);
  if(op==='anchor_capture')return planAnchorCapture(ctx);
  if(['item_add','item_verify','item_retire'].includes(op))return planItem(ctx);
  if(op==='item_next')return planItemNext(ctx);
  if(op==='answer')return planAnswer(ctx);
  if(op==='dispute_answer')return planDispute(ctx);
  if(op==='_complete_assessment')return planAssessmentCompletion(ctx);
  if (op === 'session_start' || op === 'session_end') return planSession(ctx);
  if (op === 'concept_upsert') return planConcept(ctx);
  if (op === 'queue_topic') return planQueueTopic(ctx);
  if (['set_aim', 'park_aim', 'unpark_aim'].includes(op)) return planAim(ctx);
  if (op === 'goal_create' || op === 'goal_update') return planGoal(ctx);
  if (op === 'write_learner_note') return planNote(ctx);
  if (op === 'log_inquiry') return planInquiry(ctx);
  if (op === 'record') return planRecords(ctx);
  if (op === 'amend' || op === 'retract') return planCorrection(ctx);
  if (op === 'link' || op === 'unlink') return planLink(ctx);
  if (op === 'concept_merge') return planMerge(ctx);
  if (op === 'goal_close') return planClose(ctx);
  return planMisc(ctx);
}
async function existingReceipt(db: D1Database, actor: Admission, e: Envelope, hash: string): Promise<Success | null> {
  const receipt = await db.prepare('SELECT semantic_sha256,result_json FROM operation_receipts WHERE learner_id=? AND generation=? AND request_id=? AND EXISTS(SELECT 1 FROM meta WHERE singleton=1 AND generation=? AND write_enabled=1 AND schema_version=1)').bind(actor.learner_id, e.recovery_generation, e.request_id, actor.generation).first<{ semantic_sha256: string; result_json: string }>();
  if (!receipt) return null;
  if (receipt.semantic_sha256 !== hash) throw new DataError('IDEMPOTENCY_MISMATCH', 'Request identity was already used for different content');
  const result = JSON.parse(receipt.result_json) as Success;
  return { ...result, meta: { ...result.meta, replayed: true } };
}
function statements(ctx: Context, built: Plan, hash: string): D1PreparedStatement[] {
  const { envelope: e, actor, db, meta } = ctx;
  const identity = [actor.learner_id, e.recovery_generation, e.request_id] as const;
  const guard = 'EXISTS(SELECT 1 FROM write_guards WHERE learner_id=? AND generation=? AND request_id=? AND valid=1 AND consumed=0)';
  const seq = '(SELECT seq FROM event_log WHERE learner_id=? AND generation=? AND request_id=?)';
  const compile = (sql: string, own: readonly (string | number | null)[]) => {
    let index = 0; const bound: (string | number | null)[] = [];
    const expanded = sql.replace(/__GUARD__|__SEQ__|\?/g, token => {
      if (token === '?') { bound.push(own[index++]!); return '?'; }
      bound.push(...identity); return token === '__GUARD__' ? guard : seq;
    });
    return db.prepare(expanded).bind(...bound);
  };
  const start = db.prepare('INSERT OR IGNORE INTO write_guards(learner_id,generation,request_id,valid,consumed) SELECT ?,?,?,1,0 FROM meta WHERE singleton=1 AND generation=? AND write_enabled=1 AND schema_version=1 AND rules_version=1 AND protocol_version=1 AND meta_revision=? AND NOT EXISTS(SELECT 1 FROM operation_receipts WHERE learner_id=? AND generation=? AND request_id=?)'+(built.precondition?' AND ('+built.precondition.sql+')':'')).bind(...identity, actor.generation, meta.meta_revision, ...identity,...(built.precondition?.args??[]));
  const event = compile('INSERT INTO event_log(event_id,learner_id,generation,request_id,operation,actor_json,reason,received_at,payload_json) SELECT ?,?,?,?,?,?,?,?,? WHERE __GUARD__', [ctx.newId('ev'), ...identity, e.operation, JSON.stringify({ connection_id: actor.connection_id }), e.reason, ctx.now, JSON.stringify({ data: e.data, ...(built.audit ? { prior: built.audit } : {}) })]);
  const effects = built.effects.map(effect => compile(effect.sql, effect.args));
  const advance = compile('UPDATE meta SET meta_revision=meta_revision+1,graph_revision=graph_revision+?,projection_revision=projection_revision+? WHERE singleton=1 AND __GUARD__', [built.graphChanged ? 1 : 0, built.projectionChanged ? 1 : 0]);
  const receipt = compile("INSERT INTO operation_receipts(learner_id,generation,request_id,operation,semantic_sha256,result_json,committed_seq) SELECT ?,?,?,?,?,json_object('ok',json('true'),'data',json(?),'meta',json_object('request_id',?,'recovery_generation',?,'as_of_seq',__SEQ__,'rules_version',1,'projection_revision',(SELECT projection_revision FROM meta),'replayed',json('false'))),__SEQ__ WHERE __GUARD__", [...identity, e.operation, hash, JSON.stringify(built.data), e.request_id, e.recovery_generation]);
  const consume = compile('UPDATE write_guards SET consumed=1 WHERE learner_id=? AND generation=? AND request_id=? AND __GUARD__', identity);
  const result = db.prepare('SELECT result_json,semantic_sha256 FROM operation_receipts WHERE learner_id=? AND generation=? AND request_id=? AND EXISTS(SELECT 1 FROM meta WHERE singleton=1 AND generation=? AND write_enabled=1 AND schema_version=1 AND rules_version=1 AND protocol_version=1)').bind(...identity, actor.generation);
  return [start, event, ...effects, advance, receipt, consume, result];
}
export function createRepository(db: D1Database, options: RepositoryOptions = {}) {
  const now = options.now ?? (() => new Date()); const newId = options.id ?? (prefix => `${prefix}_${crypto.randomUUID()}`);
  async function execute(input: unknown, actor: Admission, internal=false): Promise<Result> {
    let e: Envelope | undefined;
    try {
      e = parseEnvelope(input,internal);
      if (!internal && !actor.scopes.includes(requiredScope(e.operation))) throw new DataError('FORBIDDEN', 'This connection lacks the required capability');
      if (!/^[a-z]+_[0-9a-f-]{36}$/i.test(actor.learner_id)) throw new DataError('FORBIDDEN', 'Invalid authenticated learner');
      const hash = await semanticHash(e);
      let captured:Promise<CapturedSource>|undefined;const captureSource=options.captureSource?(value:SourceCaptureInput)=>captured??=(options.captureSource!(value)):undefined;
      for (let attempt = 0; attempt < 32; attempt++) {
        const meta = await metadata(db); checkVersion(e, actor, meta);
        const replay = await existingReceipt(db, actor, e, hash); if (replay) return replay;
        const nextSeq = Number(await db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS n FROM event_log').first('n'));
        const ctx: Context = { db, actor, envelope: e, now: now().toISOString(), newId, meta, nextSeq, ...(captureSource?{captureSource}:{}) };
        const built = await plan(ctx);
        const committed = await db.batch<Row>(statements(ctx, built, hash));
        const final = committed.at(-1)?.results?.[0];
        if (final) {
          if (final.semantic_sha256 !== hash) throw new DataError('IDEMPOTENCY_MISMATCH', 'Request identity was used for different content');
          const saved = JSON.parse(String(final.result_json)) as Success;
          return { ...saved, meta: { ...saved.meta, replayed: committed[0]!.meta.changes !== 1 } };
        }
      }
      throw new DataError('DEPENDENCY_UNAVAILABLE', 'Concurrent writes require a retry with the same request identity');
    } catch (error) { return failure(error instanceof DomainError ? new DataError('INVALID_INPUT', error.message) : error instanceof ZodError ? new DataError('INVALID_INPUT','Invalid assessment content or result') : error, e?.request_id); }
  }
  async function read(operation: string, input: unknown, actor: Admission): Promise<Result> {
    try {
      if (!actor.scopes.includes('teach:read')) throw new DataError('FORBIDDEN', 'This connection cannot read learning state');
      for (let attempt = 0; attempt < 8; attempt++) {
        const meta = await metadata(db);
        if (meta.generation !== actor.generation) throw new DataError('STALE_GENERATION', 'Reorient after recovery or maintenance');
        const data = await readOperation(db, operation, input, actor, now().toISOString());
        const seq = Number(await db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM event_log').first('n'));
        const after = await metadata(db);
        if (after.generation !== actor.generation) throw new DataError('STALE_GENERATION', 'Reorient after recovery or maintenance');
        if (after.meta_revision !== meta.meta_revision) continue;
        return { ok: true, data, meta: { recovery_generation: meta.generation, as_of_seq: seq, projection_revision: meta.projection_revision, rules_version: 1, replayed: false } };
      }
      throw new DataError('DEPENDENCY_UNAVAILABLE', 'Concurrent writes require a read retry');
    } catch (error) { return failure(error); }
  }
  return { execute:(input:unknown,actor:Admission)=>execute(input,actor), executeInternal:(input:unknown,actor:Admission)=>execute(input,actor,true), read };
}
