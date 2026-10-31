import { z } from 'zod';
import { createRepository } from '../data/index.ts';
import type { HostedBindings,HostedConfig } from '../hosted.ts';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const action=z.strictObject({operation:z.literal('concept_merge'),source_id:id,target_id:id});
export const proposalSchema=z.strictObject({action,generation:z.number().int().positive(),expected:z.record(id,z.number().int().positive())});
export const executionSchema=proposalSchema.extend({approvalId:z.uuid(),requestId:z.uuid()});
export type MergeProposal=z.infer<typeof proposalSchema>;
export function canonical(value:unknown):string{if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;return JSON.stringify(value);}
export async function actionHash(config:HostedConfig,proposal:MergeProposal){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical({learnerId:config.learnerId,...proposal}))))].map(value=>value.toString(16).padStart(2,'0')).join('');}
export function validTargets(proposal:MergeProposal){const {source_id:source,target_id:target}=proposal.action;return source!==target&&Object.keys(proposal.expected).length===2&&!!proposal.expected[source]&&!!proposal.expected[target];}
export async function mergePreview(db:D1Database,config:HostedConfig,sourceId:string,targetId:string){
 if(!id.safeParse(sourceId).success||!id.safeParse(targetId).success||sourceId===targetId)return null;
 const records=await db.prepare('SELECT id,title,version,merged_into,archived FROM concepts WHERE learner_id=? AND id IN (?,?) ORDER BY id').bind(config.learnerId,sourceId,targetId).all<{id:string;title:string;version:number;merged_into:string|null;archived:number}>();
 if(records.results.length!==2||records.results.some(record=>record.merged_into!==null||record.archived===1))return null;
 const metadata=await db.prepare('SELECT generation FROM meta WHERE singleton=1').first<{generation:number}>();if(!metadata||!Number.isSafeInteger(metadata.generation))return null;
 const source=records.results.find(record=>record.id===sourceId)!;const target=records.results.find(record=>record.id===targetId)!;
 return {generation:metadata.generation,action:{operation:'concept_merge' as const,source_id:source.id,target_id:target.id},expected:{[source.id]:source.version,[target.id]:target.version},concepts:[source,target],consequences:'The source redirects to the target. Learning history is retained, aims are combined and graph links are rebuilt.'};
}
export async function executeMerge(env:HostedBindings,config:HostedConfig,input:z.infer<typeof executionSchema>){
 const ledger=env.SECURITY_LEDGER.get(env.SECURITY_LEDGER.idFromName(config.learnerId));
 const proposal={action:input.action,generation:input.generation,expected:input.expected};
 const consumed=await ledger.consumeApproval({approvalId:input.approvalId,actionHash:await actionHash(config,proposal),targetVersions:input.expected,generation:input.generation,requestId:input.requestId});
 if(!consumed.ok)return consumed;
 return createRepository(env.LEARNING_DB).execute({protocol_version:1,rules_version:1,recovery_generation:input.generation,request_id:input.requestId,operation:'concept_merge',reason:'Learner approved concept merge in Teach controls',expected:input.expected,data:{source_id:input.action.source_id,target_id:input.action.target_id,expected_source_version:input.expected[input.action.source_id],expected_target_version:input.expected[input.action.target_id],confirmation_id:input.approvalId}},
 {learner_id:config.learnerId,connection_id:'browser-control',generation:input.generation,scopes:['teach:read','teach:organize'],confirmation:{id:input.approvalId,operation:'concept_merge'}});
}
