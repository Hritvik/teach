import { describe,it,expect } from 'vitest';
import { exactKeySchema,evaluateExactAnswer,visibleExactKey } from '../src/grading/exact.ts';
const key={kind:'mcq_single',options:[{option_id:'A',label:'yes'},{option_id:'B',label:'no'}],correct_option_id:'A'} as const;
describe('trusted exact-key evaluator',()=>{
 it('grades only known exact choices and never exposes the hidden choice',()=>{
  expect(evaluateExactAnswer(key,{kind:'mcq_single',option_id:'A'})).toBe('correct');
  expect(evaluateExactAnswer(key,{kind:'mcq_single',option_id:'B'})).toBe('wrong');
  expect(visibleExactKey(key)).toEqual({kind:'mcq_single',options:key.options});
  for(const answer of [{kind:'mcq_single',option_id:'a'},{kind:'mcq_single',option_id:'C'},{kind:'mcq_single',option_id:'A',correct:true},{kind:'predict_scalar',value:'A'}])expect(()=>evaluateExactAnswer(key,answer)).toThrow();
 });
 it('rejects ambiguous, duplicate and oversized choice keys',()=>{
  for(const value of [{...key,correct_option_id:'C'},{...key,options:[key.options[0],key.options[0]]},{...key,options:[key.options[0]]},{...key,options:Array(7).fill(key.options[0])},{...key,options:[{option_id:'bad id',label:'bad'},key.options[1]]},{...key,verified:true}])expect(exactKeySchema.safeParse(value).success).toBe(false);
 });
 it('uses type-strict scalar equality without string normalization or numeric coercion',()=>{
  for(const [expected,value,grade] of [[1,1,'correct'],[1,'1','wrong'],[true,'true','wrong'],[null,null,'correct'],[-0,0,'correct'],['é','é','wrong'],['A ','A','wrong'],['Case','case','wrong'],[1.25,1.25,'correct']] as const)expect(evaluateExactAnswer({kind:'predict_scalar',expected},{kind:'predict_scalar',value})).toBe(grade);
  expect(visibleExactKey({kind:'predict_scalar',expected:'secret'})).toEqual({kind:'predict_scalar'});
 });
 it('rejects invalid numeric/scalar objects and extra answer fields',()=>{
  for(const value of [NaN,Infinity,Number.MAX_SAFE_INTEGER+1,{},[],undefined,'é'.repeat(8193)]){
   expect(()=>evaluateExactAnswer({kind:'predict_scalar',expected:0},{kind:'predict_scalar',value})).toThrow();
   expect(exactKeySchema.safeParse({kind:'predict_scalar',expected:value}).success).toBe(false);
  }
  expect(()=>evaluateExactAnswer({kind:'predict_scalar',expected:0},{kind:'predict_scalar',value:0,extra:1})).toThrow();
 });
});
