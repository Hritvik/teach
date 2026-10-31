import { z } from 'zod';
const optionId=z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const boundedText=z.string().max(16384).refine(value=>new TextEncoder().encode(value).length<=16384);
const scalar=z.union([boundedText,z.number().refine(value=>Number.isFinite(value)&&(!Number.isInteger(value)||Number.isSafeInteger(value))),z.boolean(),z.null()]);
const mcq=z.strictObject({kind:z.literal('mcq_single'),options:z.array(z.strictObject({option_id:optionId,label:boundedText.refine(value=>value.length>0)})).min(2).max(6),correct_option_id:optionId}).superRefine((key,ctx)=>{
 if(new Set(key.options.map(option=>option.option_id)).size!==key.options.length||!key.options.some(option=>option.option_id===key.correct_option_id))ctx.addIssue({code:'custom',message:'Choice IDs must be unique and include the correct choice'});
});
export const exactKeySchema=z.union([mcq,z.strictObject({kind:z.literal('predict_scalar'),expected:scalar})]);
export type ExactKey=z.infer<typeof exactKeySchema>;
export function parseExactKey(value:unknown):ExactKey{return exactKeySchema.parse(value);}
/** Internal only: callers must load an accepted verification for this immutable key before evaluating. */
export function evaluateExactAnswer(verifiedKey:unknown,answer:unknown):'correct'|'wrong'{
 const key=parseExactKey(verifiedKey);
 if(key.kind==='mcq_single'){
  const parsed=z.strictObject({kind:z.literal('mcq_single'),option_id:optionId}).parse(answer);
  if(!key.options.some(option=>option.option_id===parsed.option_id))throw new Error('Unknown answer choice');
  return parsed.option_id===key.correct_option_id?'correct':'wrong';
 }
 const parsed=z.strictObject({kind:z.literal('predict_scalar'),value:scalar}).parse(answer);
 return parsed.value===key.expected?'correct':'wrong';
}
export function visibleExactKey(verifiedKey:unknown){const key=parseExactKey(verifiedKey);return key.kind==='mcq_single'?{kind:key.kind,options:key.options.map(option=>({...option}))}:{kind:key.kind};}
