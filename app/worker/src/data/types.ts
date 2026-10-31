import type {SourceCaptureInput,CapturedSource} from '../grading/source.ts';
export type Row = Record<string, unknown>;
export interface Admission {
  readonly learner_id: string;
  readonly connection_id: string;
  readonly generation: number;
  readonly scopes: readonly string[];
  readonly confirmation?: { readonly id: string; readonly operation: string };
}
export interface Envelope {
  readonly protocol_version: number;
  readonly rules_version: number;
  readonly recovery_generation: number;
  readonly request_id: string;
  readonly operation: string;
  readonly reason: string;
  readonly expected: Readonly<Record<string, number>>;
  readonly session_id?: string;
  readonly data: Row;
}
export interface DataPayload {
  readonly ids?: readonly string[];
  readonly versions?: Readonly<Record<string, number>>;
  readonly rows?: readonly Row[];
  readonly [key: string]: unknown;
}
export interface Success {
  readonly ok: true;
  readonly data: DataPayload;
  readonly meta: { readonly request_id?: string; readonly recovery_generation: number; readonly as_of_seq: number; readonly rules_version: number; readonly projection_revision: number; readonly replayed: boolean };
}
export interface Failure {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string; readonly retryable: boolean; readonly current_versions?: Readonly<Record<string, number>> };
  readonly meta: { readonly request_id?: string };
}
export type Result = Success | Failure;
export interface Meta {
  generation: number; write_enabled: number; schema_version: number; protocol_version: number; rules_version: number;
  graph_revision: number; projection_revision: number; meta_revision: number;
}
export interface Context {
  readonly db: D1Database;
  readonly actor: Admission;
  readonly envelope: Envelope;
  readonly now: string;
  readonly newId: (prefix: string) => string;
  readonly meta: Meta;
  readonly nextSeq: number;
  readonly captureSource?: (input:SourceCaptureInput)=>Promise<CapturedSource>;
}
export interface SqlEffect { readonly sql: string; readonly args: readonly (string | number | null)[]; }
export interface Plan { readonly effects: readonly SqlEffect[]; readonly data: DataPayload; readonly audit?: Row; readonly graphChanged?: boolean; readonly projectionChanged?: boolean; readonly precondition?:SqlEffect; }
