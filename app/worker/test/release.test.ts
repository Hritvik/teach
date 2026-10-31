import { describe,it,expect } from 'vitest';
import { validateRelease } from '../src/release.ts';
const hash='a'.repeat(64);
const evidence={sourceHash:hash,bundleHash:hash,migrations:{'0001_foundation.sql':hash},checks:{typecheck:true,tests:true,coverage:true,audit:true},reviewedMigrations:true,hostedClientsVerified:true,operatorApproved:true};
describe('release gate',()=>{
 it('requires exact source/bundle/migration evidence and explicit rollout approval',()=>{
  expect(()=>validateRelease(evidence,{sourceHash:hash,bundleHash:hash,migrations:{'0001_foundation.sql':hash}})).not.toThrow();
  for(const key of ['sourceHash','bundleHash'])expect(()=>validateRelease({...evidence,[key]:'b'.repeat(64)},{sourceHash:hash,bundleHash:hash,migrations:evidence.migrations})).toThrow();
  for(const key of ['reviewedMigrations','hostedClientsVerified','operatorApproved'])expect(()=>validateRelease({...evidence,[key]:false},{sourceHash:hash,bundleHash:hash,migrations:evidence.migrations})).toThrow();
  expect(()=>validateRelease(evidence,{sourceHash:hash,bundleHash:hash,migrations:{}})).toThrow();
  expect(()=>validateRelease({...evidence,checks:{...evidence.checks,audit:false}},{sourceHash:hash,bundleHash:hash,migrations:evidence.migrations})).toThrow();
  expect(()=>validateRelease({}, {sourceHash:hash,bundleHash:hash,migrations:{}})).toThrow();
 });
});
