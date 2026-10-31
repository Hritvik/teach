import {describe,it,expect} from 'vitest';
import {validateCaptureRelease} from '../src/release.ts';
const hash='a'.repeat(64);const actual={releaseMode:'capture',sourceHash:hash,bundleHash:hash,migrations:{'0001_foundation.sql':hash,'0002_assessment.sql':hash}};
const approved={...actual,checks:{typecheck:true,tests:true,coverage:true,audit:true},reviewedMigrations:true,authReviewed:true,captureIsolationVerified:true,captureLocalVerified:true,operatorApproved:true};
describe('capture-first release gate',()=>{
 it('accepts capture evidence without falsely certifying grading or every hosted client',()=>{
  expect(()=>validateCaptureRelease(approved,actual)).not.toThrow();
  for(const flag of ['authReviewed','captureIsolationVerified','captureLocalVerified','reviewedMigrations','operatorApproved'])expect(()=>validateCaptureRelease({...approved,[flag]:false},actual)).toThrow();
  expect(()=>validateCaptureRelease(approved,{...actual,releaseMode:'full'})).toThrow();
  expect(()=>validateCaptureRelease(approved,{...actual,bundleHash:'b'.repeat(64)})).toThrow();
 });
});
