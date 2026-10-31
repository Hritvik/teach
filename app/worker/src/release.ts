import { z } from 'zod';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const artifacts=z.object({sourceHash:hash,bundleHash:hash,migrations:z.record(z.string(),hash)});
const evidence=artifacts.extend({checks:z.object({typecheck:z.literal(true),tests:z.literal(true),coverage:z.literal(true),audit:z.literal(true)}),reviewedMigrations:z.literal(true),hostedClientsVerified:z.literal(true),operatorApproved:z.literal(true)}).strict();
export function validateRelease(input:unknown,current:unknown):void{
 const approved=evidence.parse(input);const actual=artifacts.parse(current);
 const names=Object.keys(actual.migrations).sort();
 if(approved.sourceHash!==actual.sourceHash||approved.bundleHash!==actual.bundleHash||JSON.stringify(Object.keys(approved.migrations).sort())!==JSON.stringify(names)||names.some(name=>actual.migrations[name]!==approved.migrations[name]))throw new Error('Release evidence is stale');
}
const captureArtifacts=artifacts.extend({releaseMode:z.literal('capture')});
const captureEvidence=captureArtifacts.extend({checks:z.object({typecheck:z.literal(true),tests:z.literal(true),coverage:z.literal(true),audit:z.literal(true)}),reviewedMigrations:z.literal(true),authReviewed:z.literal(true),captureIsolationVerified:z.literal(true),captureLocalVerified:z.literal(true),operatorApproved:z.literal(true)}).strict();
/** Capture rollout has its own gate; it cannot attest to the full assessment release. */
export function validateCaptureRelease(input:unknown,current:unknown):void{
 const approved=captureEvidence.parse(input);const actual=captureArtifacts.parse(current);
 const names=Object.keys(actual.migrations).sort();
 if(approved.sourceHash!==actual.sourceHash||approved.bundleHash!==actual.bundleHash||JSON.stringify(Object.keys(approved.migrations).sort())!==JSON.stringify(names)||names.some(name=>actual.migrations[name]!==approved.migrations[name]))throw new Error('Capture release evidence is stale');
}
