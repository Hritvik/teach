import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { parseModelJobRequest,validateKeyVerification,verificationAccepted,validateContentGrade } from '../src/grading/model.ts';
const fixtureSchema=z.strictObject({id:z.string().min(1),description:z.string().min(1),request:z.unknown(),expected_result:z.unknown(),expected_outcome:z.enum(['verification_supported','verification_held','correct','partial','wrong','ungradable']),review_notes:z.string().min(1)});
const corpusSchema=z.strictObject({schema_version:z.literal(1),review_status:z.literal('pending_human_review'),source_policy:z.string().min(1),claims:z.string().min(1),cases:z.array(fixtureSchema).min(11)});
const corpus=corpusSchema.parse(JSON.parse(await readFile(new URL('../../../evals/grading-corpus.json',import.meta.url),'utf8')));
describe('synthetic grading corpus contract invariants',()=>{
 it('keeps review status explicit and includes all required scenarios without duplicate fixtures',()=>{
  expect(corpus.review_status).toBe('pending_human_review');
  expect(new Set(corpus.cases.map(fixture=>fixture.id)).size).toBe(corpus.cases.length);
  expect(corpus.cases.map(fixture=>fixture.id)).toEqual(expect.arrayContaining(['supported_key','unsupported_key','ambiguous_key','unsupported_exact_value','correct_answer','novel_valid_formulation','partial_answer','wrong_answer','instruction_injection','unassessable_answer','independent_regrade']));
 });
 for(const fixture of corpus.cases)it(`${fixture.id}: expected result obeys closed authority and aggregate rules`,async()=>{
  const request=parseModelJobRequest(fixture.request);
  for(const capture of request.captures){const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(capture.passage)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');expect(capture.capture_hash).toBe(actual);}
  if(request.purpose==='key_verify'){
   const result=validateKeyVerification(request,fixture.expected_result);
   expect(verificationAccepted(request,result)).toBe(fixture.expected_outcome==='verification_supported');
   expect(['verification_supported','verification_held']).toContain(fixture.expected_outcome);
  }else{
   const result=validateContentGrade(request,fixture.expected_result);
   expect(result.status==='ungradable'?'ungradable':result.grade).toBe(fixture.expected_outcome);
   expect(JSON.stringify(request)).not.toMatch(/original_grade|prior_verdict|confidence|session_transcript/);
  }
  expect(JSON.stringify(fixture.expected_result)).not.toMatch(/chain_of_thought|hidden_reasoning/);
 });
});
