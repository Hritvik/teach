import {effectiveEvidence} from '@teach/domain';
import {loadEvidenceRows,evidenceFromRow,correctionFromRow} from './projections.ts';
import {rows} from './sql.ts';
import type {Admission,Row,DataPayload} from './types.ts';
export async function assessmentInsights(db:D1Database,operation:string,data:Row,actor:Admission):Promise<DataPayload>{
 const concepts=await rows(db,'SELECT id FROM concepts WHERE learner_id=? AND (? IS NULL OR realm=?)',[actor.learner_id,typeof data.realm==='string'?data.realm:null,typeof data.realm==='string'?data.realm:null]);
 const conceptIds=new Set(concepts.map(concept=>String(concept.id)));
 if(operation==='misconceptions'){
  const values=await rows(db,'SELECT m.*,e.level AS level FROM misconceptions m LEFT JOIN evidence e ON e.id=m.created_from_record_id AND e.learner_id=m.learner_id WHERE m.learner_id=? ORDER BY m.created_seq,m.id',[actor.learner_id]);
  const selected=values.filter(value=>conceptIds.has(String(value.concept_id))&&(!data.concept_id||value.concept_id===data.concept_id)&&(!data.level||value.level===data.level));
  return {rows:selected.map(value=>({...value,provenance:'grader_hypothesis',provisional:true})),description:'Hypotheses for a follow-up probe, not established diagnoses.'};
 }
 const source=await loadEvidenceRows(db,actor.learner_id);const corrections=await rows(db,'SELECT * FROM record_corrections WHERE learner_id=? ORDER BY seq,effective_revision',[actor.learner_id]);
 const effective=effectiveEvidence(source.map(evidenceFromRow),corrections.filter(correction=>source.some(record=>record.id===correction.root_record_id)).map(correctionFromRow));
 const relevant=(record:ReturnType<typeof evidenceFromRow>)=>conceptIds.has(record.conceptId)&&(!data.concept_id||record.conceptId===data.concept_id)&&(!data.level||record.level===data.level)&&['answer','prediction','teachback'].includes(record.kind)&&record.contentGrade!=='na';
 const records=effective.records.filter(relevant);const disputed=effective.disputed.filter(relevant);
 const values=['sure','think','guess','unknown'].map(confidence=>{const selected=records.filter(record=>record.confidence===confidence);return {confidence,assessed_count:selected.length,correct:selected.filter(record=>record.contentGrade==='correct').length,partial:selected.filter(record=>record.contentGrade==='partial').length,wrong:selected.filter(record=>record.contentGrade==='wrong').length,provisional_count:disputed.filter(record=>record.confidence===confidence).length};});
 return {rows:values,description:'Descriptive content-grade counts by reported confidence. Disputed assessments appear only in provisional_count.'};
}
