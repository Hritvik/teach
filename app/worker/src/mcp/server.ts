import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { createRepository, type Admission, type Result } from '../data/index.ts';
import type { RepositoryOptions } from '../data/repository.ts';
import { protocol, captureProtocol } from './protocol.ts';

export const readTools = ['whoami','protocol','concept_get','concept_search','mastery','frontier','next',
  'needs_you','calibration','misconceptions','attempt_status','item_status','budget_status','neighbors','aims','gaps','goal_get','goal_list','sessions','history','learner_notes','inbox','query'] as const;
export const writeTools = ['session_start','session_end','concept_upsert','set_aim','park_aim','unpark_aim',
  'goal_create','goal_update','goal_close','log_inquiry','record','link','unlink','amend','retract',
  'anchor_capture','item_add','item_verify','item_retire','item_next','answer','dispute_answer','submit_to_inbox','resolve_inbox_entry','set_balance','write_learner_note','archive_candidate','propose_candidates','concept_merge'] as const;

export const captureReadTools = ['whoami','protocol','concept_get','concept_search','frontier','neighbors',
  'aims','gaps','goal_get','goal_list','sessions','history','learner_notes','inbox','query'] as const;
export const captureWriteTools = ['session_start','session_end','concept_upsert','set_aim','park_aim','unpark_aim',
  'goal_create','goal_update','log_inquiry','record','link','unlink','amend','retract','submit_to_inbox',
  'resolve_inbox_entry','set_balance','write_learner_note','archive_candidate','propose_candidates'] as const;

const input = z.strictObject({
  concept_id: z.string().optional(), attempt_id: z.string().optional(), item_id: z.string().optional(), query: z.string().max(1024).optional(), realm: z.string().optional(),
  area: z.string().optional(), level: z.number().int().min(1).max(4).optional(), id: z.string().optional(),
  goal_id: z.string().optional(), owner_id: z.string().optional(), kind: z.string().optional(),
  state: z.string().optional(), record_id: z.string().optional(), cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(), slot: z.enum(['urgent','growth']).optional(),
  view: z.string().optional(), select: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});
const envelope = {
  protocol_version: z.literal(1), rules_version: z.literal(1), recovery_generation: z.number().int().positive(),
  request_id: z.uuid(), reason: z.string().min(1).max(1024), expected: z.record(z.string(), z.number().int().positive()),
  session_id: z.string().optional(), data: z.record(z.string(), z.unknown()),
};
function output(result: Result) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    structuredContent: { ...result }, ...(!result.ok ? { isError: true } : {}) };
}
export interface McpOptions extends RepositoryOptions { readonly budgetStatus?:()=>Promise<unknown>; readonly releaseMode?:'capture'|'full'; }
export function mcpHandler(db: D1Database, admission: Admission, options:McpOptions={}) {
  if(options.releaseMode!==undefined&&options.releaseMode!=='capture'&&options.releaseMode!=='full')throw new Error('Unsupported release mode');
  const captureOnly=options.releaseMode==='capture';
  const instructions=captureOnly?captureProtocol:protocol;
  const reads=captureOnly?captureReadTools:readTools;
  const writes=captureOnly?captureWriteTools:writeTools;
  const repo = createRepository(db,options);
  return createMcpHandler(() => {
    const server = new McpServer({ name: 'teach', version: '0.1.0' }, { instructions });
    server.registerResource('tutor-protocol', 'teach://protocol', { mimeType: 'text/plain' }, async uri => ({
      contents: [{ uri: uri.href, mimeType: 'text/plain', text: instructions }],
    }));
    for (const name of reads) server.registerTool(name, { description: `Read Teach ${name}; no state changes.`, inputSchema: input,
      annotations: { readOnlyHint: true, destructiveHint: false } }, async args => {
      if(captureOnly&&name==='query'&&args.view==='v_mastery')return output({ok:false,error:{code:'FORBIDDEN',message:'Assessment views are unavailable in the capture release',retryable:false},meta:{}});
      if(name==='budget_status'){
        const current=await repo.read('whoami',{},admission);
        return output(!current.ok?current:options.budgetStatus?{...current,data:{budget:await options.budgetStatus()}}:{ok:false,error:{code:'DEPENDENCY_UNAVAILABLE',message:'Budget authority is not configured',retryable:false},meta:{}});
      }
      if (name === 'protocol') return { content: [{ type: 'text', text: instructions }] };
      return output(await repo.read(name, args, admission));
    });
    for (const name of writes) server.registerTool(name, { description: `Apply ${name} with a stable request identity and version checks.`,
      inputSchema: z.strictObject({ ...envelope, operation: z.literal(name) }),
      annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: name === 'concept_merge' || name === 'retract' },
    }, async args => {
      if(captureOnly&&(name==='amend'||name==='retract')&&typeof args.data.root_record_id==='string'){
        try{
          const assessed=await db.prepare("SELECT 1 FROM evidence WHERE learner_id=? AND id=? AND (attempt_id IS NOT NULL OR content_grade<>'na')").bind(admission.learner_id,args.data.root_record_id).first();
          if(assessed)return output({ok:false,error:{code:'FORBIDDEN',message:'Assessed records cannot be changed in the capture release',retryable:false},meta:{}});
        }catch{return output({ok:false,error:{code:'DEPENDENCY_UNAVAILABLE',message:'Record authority could not be checked',retryable:true},meta:{}});}
      }
      return output(await repo.execute(args, admission));
    });
    return server;
  });
}
