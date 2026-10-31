import type {Context,Plan,Row,SqlEffect} from './types.ts';
import {common,insert,update} from './sql.ts';
import {DataError} from './errors.ts';
import type {SourceCaptureInput} from '../grading/source.ts';
export async function planAnchorCapture(ctx:Context):Promise<Plan>{
 if(!ctx.captureSource)throw new DataError('DEPENDENCY_UNAVAILABLE','Trusted source capture is not configured');
 const input=ctx.envelope.data as unknown as SourceCaptureInput;const capture=await ctx.captureSource(input);
 const old=await ctx.db.prepare('SELECT * FROM anchors WHERE learner_id=? AND source_uri=? AND locator_json=?').bind(ctx.actor.learner_id,capture.canonicalUrl,JSON.stringify(capture.locator)).first<Row>();
 const same=old&&old.sha256===capture.passageHash&&old.source_version===capture.sourceVersion&&old.state==='verified';
 if(same)return {effects:[],data:{ids:[String(old.id)],anchor_id:old.id,anchor_version:old.version,state:'verified'}};
 const anchorId=old?String(old.id):ctx.newId('a');const version=old?Number(old.version)+1:1;
 const values={kind:'passage',source_uri:capture.canonicalUrl,source_version:capture.sourceVersion,locator_json:JSON.stringify(capture.locator),quoted_text:capture.passage,sha256:capture.passageHash,state:'verified',checked_at:capture.capturedAt};
 const effects:SqlEffect[]=[old?update('anchors',anchorId,values):insert('anchors',{...common(ctx,anchorId),...values}),insert('source_captures',{...common(ctx,ctx.newId('sc')),anchor_id:anchorId,anchor_version:version,source_uri:capture.canonicalUrl,source_version:capture.sourceVersion,locator_json:JSON.stringify(capture.locator),captured_text:capture.passage,sha256:capture.passageHash,captured_at:capture.capturedAt,fetch_provenance_json:JSON.stringify({...capture.provenance,sourceHash:capture.sourceHash})})];
 if(old)effects.push({sql:"UPDATE items SET state='held',current_verification_id=NULL,version=version+1,updated_seq=__SEQ__ WHERE learner_id=? AND state<>'retired' AND EXISTS(SELECT 1 FROM item_versions iv,json_each(iv.key_points_json) p,json_each(json_extract(p.value,'$.anchor_ids')) a WHERE iv.item_id=items.id AND iv.item_version=items.current_item_version AND a.value=?) AND __GUARD__",args:[ctx.actor.learner_id,anchorId]});
 return {effects,data:{ids:[anchorId],anchor_id:anchorId,anchor_version:version,state:'verified'}};
}
