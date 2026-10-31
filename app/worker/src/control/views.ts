import type { MergeProposal } from './merge.ts';
export const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>`&#${char.charCodeAt(0)};`);
export function page(title:string,body:string){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)} · Teach</title></head><body><main><h1>${escapeHtml(title)}</h1>${body}<p><a href="/control">Back to controls</a></p></main></body></html>`;}
export function actionForm(action:string,csrf:string,payload:unknown,label:string){return `<form method="post" action="${escapeHtml(action)}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="payload" value="${escapeHtml(JSON.stringify(payload))}"><button type="submit">${escapeHtml(label)}</button></form>`;}
interface Concept {readonly id:string;readonly title:string;readonly version:number;}
export function mergeContext(proposal:MergeProposal,concepts:readonly Concept[],consequences:string){
 const source=concepts.find(concept=>concept.id===proposal.action.source_id);const target=concepts.find(concept=>concept.id===proposal.action.target_id);
 return `<p>The source concept will redirect to the target.</p><dl><dt>Source</dt><dd>${escapeHtml(source?.title??proposal.action.source_id)} (version ${proposal.expected[proposal.action.source_id]})</dd><dt>Target</dt><dd>${escapeHtml(target?.title??proposal.action.target_id)} (version ${proposal.expected[proposal.action.target_id]})</dd></dl><p>${escapeHtml(consequences)}</p>`;
}
export function mergeReview(proposal:MergeProposal,concepts:readonly Concept[],consequences:string,csrf:string){return page('Review concept merge',mergeContext(proposal,concepts,consequences)+actionForm('/control/approve',csrf,proposal,'Approve this proposal'));}
export function mergeConfirmed(proposal:MergeProposal,concepts:readonly Concept[],consequences:string,csrf:string,approvalId:string){
 const payload={...proposal,approvalId,requestId:crypto.randomUUID()};
 return page('Confirm concept merge',mergeContext(proposal,concepts,consequences)+'<p>This approval expires in ten minutes. Continue to save the merge.</p>'+actionForm('/control/merge',csrf,payload,'Merge concepts'));
}
export function mergeOutcome(saved:boolean,csrf:string,payload:unknown,message:string){return page(saved?'Merge saved':'Merge not confirmed',`<p>${escapeHtml(message)}</p><p>If the result was interrupted, use this same request to check or retry safely.</p>`+actionForm('/control/merge',csrf,payload,'Check or retry this merge'));}
