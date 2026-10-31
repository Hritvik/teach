import type {Context,Plan} from './types.ts';
import {entity,session,update} from './sql.ts';
import {captureSet} from './assessment-shared.ts';
import {invalid} from './errors.ts';
export async function planInbox(ctx:Context):Promise<Plan>{
 const data=ctx.envelope.data;const inquiry=await entity(ctx,'inquiries',String(data.inquiry_id),true);await session(ctx,String(inquiry.session_id),true,true);
 const withdrawn=await ctx.db.prepare("SELECT 1 FROM record_corrections WHERE root_record_id=? AND action='retract'").bind(String(inquiry.id)).first();if(withdrawn)invalid('A withdrawn inquiry cannot be reopened');
 if(ctx.envelope.operation==='submit_to_inbox')return {effects:[update('inquiries',String(inquiry.id),{state:'inbox',what_would_resolve:String(data.what_would_resolve)})],data:{ids:[String(inquiry.id)],state:'inbox',versions:{[String(inquiry.id)]:Number(inquiry.version)+1}}};
 if(inquiry.state!=='inbox')invalid('Only an open inbox entry can be resolved');
 await captureSet(ctx.db,ctx.actor.learner_id,[{anchor_ids:data.anchor_ids as string[]}]);
 return {effects:[update('inquiries',String(inquiry.id),{state:'answered',what_would_resolve:null,answer_json:JSON.stringify({text:data.answer,anchor_ids:data.anchor_ids})})],data:{ids:[String(inquiry.id)],state:'answered',versions:{[String(inquiry.id)]:Number(inquiry.version)+1}}};
}
