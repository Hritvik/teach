import type { Failure } from './types';
export class DataError extends Error {
  constructor(readonly code: string, message: string, readonly currentVersions?: Readonly<Record<string, number>>) { super(message); }
}
export function invalid(message: string): never { throw new DataError('INVALID_INPUT', message); }
export function failure(error: unknown, requestId?: string): Failure {
  const safe = error instanceof DataError ? error : new DataError('DEPENDENCY_UNAVAILABLE', 'The learning store could not complete this operation');
  return { ok: false, error: { code: safe.code, message: safe.message, retryable: ['MAINTENANCE', 'DEPENDENCY_UNAVAILABLE'].includes(safe.code), ...(safe.currentVersions ? { current_versions: safe.currentVersions } : {}) }, meta: { ...(requestId ? { request_id: requestId } : {}) } };
}
