import { z } from 'zod';
import type { Envelope, Row } from './types';
import { invalid } from './errors';
const text = z.string().min(1).max(16384);
const id = z.string().regex(/^[a-z]+_[0-9a-f-]{36}$/i);
const level = z.number().int().min(1).max(4);
const json = z.record(z.string(), z.unknown());
const envelopeSchema = z.object({ protocol_version: z.number().int(), rules_version: z.number().int(), recovery_generation: z.number().int().positive(), request_id: z.string().uuid(), operation: z.string().min(1).max(80), reason: z.string().min(1).max(1024), expected: z.record(z.string(), z.number().int().nonnegative()).default({}), session_id: id.optional(), data: json }).strict();
const concept = z.object({ id: id.optional(), realm: text, area: text, slug: text, title: text, purpose: text, origin: z.enum(['goal', 'inquiry', 'lesson', 'frontier', 'seed']), anchor_ids: z.array(id).max(100).default([]) }).strict();
const linkKind = z.enum(['requires', 'instantiates', 'deepens', 'relates']);
const aim = z.object({ id: id.optional(), concept_id: id, owner_kind: z.enum(['learner', 'goal']), owner_id: id, level, parked: z.boolean() }).strict();
const goal = z.object({ id: id.optional(), title: text, source: json, urgent: z.boolean().default(false), due_at: z.string().datetime().nullable().optional() }).strict();
const record = z.object({ kind: z.enum(['exposure', 'inquiry', 'self_rating', 'observed']), concept_id: id, level, source: json, occurred_at: z.string().datetime(), content: text.optional(), confidence: z.enum(['sure', 'think', 'guess', 'unknown']).default('unknown'), help: json.default({}) }).strict();
const point=z.strictObject({point_id:z.string().min(1).max(128),criterion:text,required:z.boolean(),anchor_ids:z.array(id).max(64)});
const reviewLease=z.strictObject({occurrence_id:id,lease_generation:z.number().int().positive(),schedule_revision:z.number().int().positive()});
const answer=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('free_text'),text:z.string().max(16384)}),z.strictObject({kind:z.literal('mcq_single'),option_id:z.string().min(1).max(64)}),z.strictObject({kind:z.literal('predict_scalar'),value:z.union([z.string().max(16384),z.number().finite(),z.boolean(),z.null()])})]);
const assessmentSchemas:Record<string,z.ZodType>={
 submit_to_inbox:z.strictObject({inquiry_id:id,what_would_resolve:text}),
 resolve_inbox_entry:z.strictObject({inquiry_id:id,answer:text,anchor_ids:z.array(id).min(1).max(64)}),
 anchor_capture:z.strictObject({url:z.string().max(4096),locator:z.strictObject({kind:z.literal('lines'),start:z.number().int().positive(),end:z.number().int().positive()}),sourceVersion:z.string().min(1).max(1024)}),
 item_add:z.strictObject({item_id:id.optional(),concept_id:id,level,type:z.enum(['free_text','mcq_single','predict_scalar']),stem:text,essential_context:z.string().max(16384),assessment_form:z.enum(['production','recognition']),key_points:z.array(point).min(1).max(16),distractors:z.array(z.string().max(16384)).max(6).default([]),exact_key:json.nullable().default(null)}),
 item_verify:z.strictObject({item_id:id,item_version:z.number().int().positive()}),
 item_retire:z.strictObject({item_id:id,item_version:z.number().int().positive(),reason:text}),
 item_next:z.strictObject({concept_id:id.optional(),level:level.optional(),purpose:z.enum(['placement','lesson','review']),session_id:id,takeover:z.boolean().optional()}),
 answer:z.strictObject({attempt_id:id,item_id:id,item_version:z.number().int().positive(),answer,confidence:z.enum(['sure','think','guess','unknown']),help:z.strictObject({content_hint:z.boolean().default(false),answer_revealed:z.boolean().default(false)}).default({content_hint:false,answer_revealed:false}),review_lease:reviewLease.optional()}),
 dispute_answer:z.strictObject({attempt_id:id,expected_effective_revision:z.number().int().nonnegative(),reason:text}),
};
const internalSchemas:Record<string,z.ZodType>={_complete_assessment:z.strictObject({job_id:id,job_revision:z.number().int().positive(),dispatch_id:z.string().min(1).max(128),result:json,provenance:json})};
const schemas: Record<string, z.ZodType> = {
  ...assessmentSchemas,
  session_start: z.object({ resume_session_id: id.optional(), goal_ids: z.array(id).max(50).default([]) }).strict(),
  session_end: z.object({ session_id: id, exit_ticket: json.optional(), muddiest_point: text.optional(), what_helped: text.optional() }).strict(),
  concept_upsert: concept,
  queue_topic: z.object({
    concept_id: id.optional(), topic: text.optional(), question: text.optional(),
    realm: text.optional(), area: text.optional(), slug: text.optional(), title: text.optional(), purpose: text.optional(),
    goal_id: id.optional(), links: z.array(z.object({ to_id: id, kind: linkKind })).max(20).default([]),
  }).strict().refine(value => value.concept_id !== undefined || value.topic !== undefined, { message: 'Provide topic or concept_id' }),
  set_aim: aim,
  park_aim: z.object({ id }).strict(), unpark_aim: z.object({ id }).strict(),
  goal_create: goal, goal_update: goal.extend({ id }).strict(),
  log_inquiry: z.object({ text, concept_ids: z.array(id).max(100), answer: z.unknown().optional(), unresolved: z.boolean().default(false) }).strict(),
  record: z.object({ records: z.array(record).min(1).max(25) }).strict(),
  link: z.object({ from_id: id, to_id: id, kind: linkKind }).strict(),
  unlink: z.object({ from_id: id, to_id: id, kind: linkKind }).strict(),
  amend: z.object({ root_record_id: id, expected_effective_revision: z.number().int().nonnegative(), replacement: json, reason: text }).strict(),
  retract: z.object({ root_record_id: id, expected_effective_revision: z.number().int().nonnegative(), reason: text }).strict(),
  set_balance: z.object({ urgent_pct: z.number().int().min(0).max(100) }).strict(),
  write_learner_note: z.object({ id: id.optional(), kind: text, text }).strict(),
  archive_candidate: z.object({ concept_ids: z.array(id).min(1).max(100) }).strict(),
  propose_candidates: z.object({ concepts: z.array(concept.omit({ id: true })).min(1).max(10) }).strict(),
  concept_merge: z.object({ source_id: id, target_id: id, expected_source_version: z.number().int().positive(), expected_target_version: z.number().int().positive(), confirmation_id: text }).strict(),
  goal_close: z.object({ goal_id: id, decisions: z.array(z.object({ aim_id: id, action: z.enum(['keep', 'lower', 'drop']), new_level: level.optional() }).strict()), confirmation_id: text }).strict(),
};
function assertJson(value: unknown, depth = 0): void {
  if (depth > 20) invalid('JSON nesting is too deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach(entry => assertJson(entry, depth + 1)); return; }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) { Object.values(value).forEach(entry => assertJson(entry, depth + 1)); return; }
  invalid('Only JSON values are accepted');
}
function zodDetail(error: z.ZodError): string {
  const issues = error.issues.slice(0, 5).map(issue => `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`);
  return issues.length ? `: ${issues.join('; ')}` : '';
}
export function parseEnvelope(input: unknown, internal=false): Envelope {
  assertJson(input);
  if (new TextEncoder().encode(JSON.stringify(input)).length > 65536) invalid('Request exceeds 64 KiB');
  const parsed = envelopeSchema.safeParse(input); if (!parsed.success) invalid(`Invalid write envelope${zodDetail(parsed.error)}`);
  const schema = internal ? internalSchemas[parsed.data.operation] : schemas[parsed.data.operation]; if (!schema) invalid('Unsupported write operation');
  const data = schema.safeParse(parsed.data.data); if (!data.success) invalid(`Invalid operation data${zodDetail(data.error)}`);
  if(parsed.data.operation==='answer'){const answer=(data.data as Row).answer as Row;const content=answer.kind==='free_text'?answer.text:answer;if(new TextEncoder().encode(typeof content==='string'?content:JSON.stringify(content)).length>16384)invalid('Answer exceeds 16 KiB');}
  const { session_id, ...base } = parsed.data;
  return { ...base, ...(session_id ? { session_id } : {}), data: data.data as Row };
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Row)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function semanticHash(envelope: Envelope): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(envelope)));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const readFields: Record<string, z.ZodType> = {
  limit: z.number().int().min(1).max(100), cursor: z.string().max(512),
  concept_id: id, owner_id: id, goal_id: id, record_id: id, item_id:id,attempt_id:id, id,
  query: z.string().max(16384), realm: text, kind: text, level,
  state: z.enum(['open', 'active', 'closed', 'abandoned']), slot: z.enum(['urgent', 'growth']),
  view: text, select: z.array(text).min(1).max(20), filters: json,
};
export function parseRead(input: unknown, fields: readonly string[]): Row {
  assertJson(input);
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Read input must be an object');
  if (new TextEncoder().encode(JSON.stringify(input)).length > 65536) invalid('Read request exceeds 64 KiB');
  const row = input as Row;
  for (const [key, value] of Object.entries(row)) {
    if (!fields.includes(key) || !readFields[key]?.safeParse(value).success) invalid('Invalid or unknown read field');
  }
  return row;
}
