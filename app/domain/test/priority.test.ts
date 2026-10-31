import { describe, expect, it } from 'vitest';
import { goalReadiness, rankFrontier } from '../src/priority.ts';
import type { Aim } from '../src/types.ts';
const aim=(overrides:Partial<Aim>={}):Aim=>({id:'ai_1',conceptId:'c_1',ownerKind:'learner',ownerId:'l_1',level:3,parked:false,...overrides});

describe('honest readiness',()=>{
  it('counts a goal active targets rather than average or highest-depth score',()=>{
    const aims=[aim({ownerKind:'goal',ownerId:'g_1'}),aim({id:'ai_2',conceptId:'c_2',ownerKind:'goal',ownerId:'g_1',level:2,parked:true})];
    expect(goalReadiness('g_1',aims,[{conceptId:'c_1',level:3,state:'Solid'}])).toEqual({met:1,total:1,provisional:false});
    expect(goalReadiness('g_1',aims,[{conceptId:'c_1',level:4,state:'Secure'}]).met).toBe(0);
  });
  it('a disputed mastered target cannot certify readiness',()=>{
    expect(goalReadiness('g_1',[aim({ownerKind:'goal',ownerId:'g_1'})],[{conceptId:'c_1',level:3,state:'Secure',provisional:true}])).toEqual({met:0,total:1,provisional:true});
    expect(goalReadiness('empty',[],[])).toEqual({met:0,total:0,provisional:false});
  });
});

describe('versioned next-concept priority',()=>{
  const now='2026-10-29T10:00:00Z';
  it('does not zero a missing lower-level aim because Transfer was demonstrated',()=>{
    const result=rankFrontier({aims:[aim({level:2})],links:[],mastery:[{conceptId:'c_1',level:4,state:'Secure'}],goals:[],now,slot:'growth'});
    expect(result).toEqual([expect.objectContaining({conceptId:'c_1',aimLevel:2,score:2})]);
  });
  it('ranks urgent goals by date and target weight, with stable ties',()=>{
    const result=rankFrontier({aims:[aim({ownerKind:'goal',ownerId:'g_1',level:4}),aim({id:'ai_2',conceptId:'c_2',ownerKind:'goal',ownerId:'g_2',level:4})],links:[],mastery:[],
      goals:[{id:'g_1',state:'active',urgent:true,dueAt:'2026-10-28T10:00:00Z'},{id:'g_2',state:'active',urgent:true,dueAt:'2026-11-29T10:00:00Z'}],now,slot:'urgent'});
    expect(result.map(r=>r.score)).toEqual([48,12]);
    expect(result.map(r=>r.conceptId)).toEqual(['c_1','c_2']);
  });
  it('adds inquiry interest, unblocked concepts and explicit flags without selecting met targets',()=>{
    const result=rankFrontier({aims:[aim({level:2})],links:[{fromId:'advanced',toId:'c_1',kind:'requires'}],mastery:[],goals:[],now,slot:'growth',
      recentInquiries:[{conceptId:'c_1',at:'2026-10-28T10:00:00Z'}],misconceptionConceptIds:['c_1'],staleConceptIds:['c_1']});
    expect(result[0]).toMatchObject({score:8});
  });
  it('does not schedule parked, closed-goal or urgent-only aims into growth',()=>{
    expect(rankFrontier({aims:[aim({parked:true})],links:[],mastery:[],goals:[],now,slot:'growth'})).toEqual([]);
    expect(rankFrontier({aims:[aim({ownerKind:'goal',ownerId:'g_1'})],links:[],mastery:[],goals:[{id:'g_1',state:'closed',urgent:true}],now,slot:'urgent'})).toEqual([]);
    expect(rankFrontier({aims:[aim({ownerKind:'goal',ownerId:'g_1'})],links:[],mastery:[],goals:[{id:'g_1',state:'active',urgent:true}],now,slot:'growth'})).toEqual([]);
  });
});

it('retains a lower unmet goal when a higher goal is already mastered',()=>{
 const aims=[aim({ownerKind:'goal',ownerId:'g_low',level:2}),aim({id:'ai_high',ownerKind:'goal',ownerId:'g_high',level:4})];
 const mastery=[{conceptId:'c_1',level:4 as const,state:'Secure' as const}];
 expect(goalReadiness('g_low',aims,mastery).met).toBe(0);
 expect(rankFrontier({aims,links:[],mastery,goals:[{id:'g_low',state:'active',urgent:false},{id:'g_high',state:'active',urgent:false}],now:'2026-10-29T10:00:00Z',slot:'growth'})).toEqual([expect.objectContaining({conceptId:'c_1',aimLevel:2})]);
});
