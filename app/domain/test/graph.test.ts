import { describe, expect, it } from 'vitest';
import { assertAcyclic, closeGoal, effectiveAims, frontier, mergeConcepts, prerequisiteEdges,
  resolveConceptId, type Aim, type Concept, type Link } from '../src/index.ts';

const concept = (id: string, mergedInto?: string): Concept => ({ id, ...(mergedInto ? { mergedInto } : {}) });
const aim = (overrides: Partial<Aim> = {}): Aim => ({ id: 'ai_1', conceptId: 'c_1', ownerKind: 'learner', ownerId: 'l_1', level: 2, parked: false, ...overrides });
const requires = (fromId: string, toId: string): Link => ({ fromId, toId, kind: 'requires' });

describe('graph prerequisite boundaries', () => {
  it('requires points dependent to prerequisite, deepens reverses foundation to advanced', () => {
    expect(prerequisiteEdges([{ fromId: 'foundation', toId: 'advanced', kind: 'deepens' }])).toEqual([requires('advanced', 'foundation')]);
    expect(prerequisiteEdges([{ fromId: 'x', toId: 'y', kind: 'relates' }])).toEqual([]);
  });
  it('rejects cycles and self links but not symmetric relates or shared prerequisites', () => {
    expect(() => assertAcyclic([requires('a','b'), requires('b','a')])).toThrow();
    expect(() => assertAcyclic([requires('a','a')])).toThrow();
    expect(() => assertAcyclic([{ fromId:'a',toId:'b',kind:'deepens' }, requires('a','b')])).toThrow();
    expect(() => assertAcyclic([requires('a','c'), requires('b','c')])).not.toThrow();
  });
  it('resolves immutable redirects and refuses missing concepts or redirect cycles', () => {
    expect(resolveConceptId('a', [concept('a','b'),concept('b')])).toBe('b');
    expect(() => resolveConceptId('a',[concept('a','b'),concept('b','a')])).toThrow();
    expect(() => resolveConceptId('a',[concept('a','missing')])).toThrow();
    expect(() => resolveConceptId('missing',[])).toThrow();
  });
  it('selects highest active aim, ignoring parked and closed owners without destroying originals', () => {
    const aims = [aim(),aim({ id:'ai_2', ownerKind:'goal',ownerId:'g_1',level:4 }), aim({ id:'ai_3',level:3,parked:true })];
    expect(effectiveAims(aims, ['g_1'])).toEqual([{ conceptId:'c_1', level:4 }]);
    expect(effectiveAims(aims, [])).toEqual([{ conceptId:'c_1', level:2 }]);
    expect(aims).toHaveLength(3);
  });
  it('frontier excludes met aims and requires Solid at Mechanism rather than Recall', () => {
    const aims=[aim({conceptId:'advanced',level:3})]; const links=[requires('advanced','foundation')];
    expect(frontier(aims, links, [{conceptId:'foundation',level:1,state:'Secure'}])).toEqual([]);
    expect(frontier(aims, links, [{conceptId:'foundation',level:2,state:'Shaky'}])).toEqual([]);
    expect(frontier(aims, links, [{conceptId:'foundation',level:2,state:'Solid'}])).toEqual(['advanced']);
    expect(frontier(aims, links, [{conceptId:'foundation',level:2,state:'Solid'},{conceptId:'advanced',level:3,state:'Secure'}])).toEqual([]);
  });
  it('provisional prerequisite or target mastery cannot certify readiness', () => {
    expect(frontier([aim()], [], [{conceptId:'c_1',level:2,state:'Secure',provisional:true}])).toEqual(['c_1']);
    expect(frontier([aim({conceptId:'advanced'})], [requires('advanced','foundation')], [{conceptId:'foundation',level:2,state:'Secure',provisional:true}])).toEqual([]);
  });
});

describe('merge preservation', () => {
  it('keeps evidence identity outside graph while coalescing effective aims and parallel edges', () => {
    const graph = { concepts:[concept('a'),concept('b'),concept('p')], links:[requires('a','p'), requires('b','p')],
      aims:[aim({conceptId:'a',level:2}),aim({id:'ai_2',conceptId:'b',level:4,parked:true}),aim({id:'ai_3',conceptId:'b',ownerKind:'goal',ownerId:'g_1',level:3})] };
    const before=JSON.stringify(graph); const merged=mergeConcepts(graph,'a','b');
    expect(resolveConceptId('a',merged.concepts)).toBe('b');
    expect(merged.links).toEqual([requires('b','p')]);
    expect(merged.aims.filter(a=>a.ownerId==='l_1')).toEqual([expect.objectContaining({conceptId:'b',level:4,parked:false})]);
    expect(merged.aims.some(a=>a.ownerId==='g_1' && a.level===3)).toBe(true);
    expect(merged.aimHistory).toHaveLength(3);
    expect(JSON.stringify(graph)).toBe(before);
  });
  it('refuses a merge introducing a prerequisite cycle', () => {
    expect(()=>mergeConcepts({concepts:[concept('a'),concept('b'),concept('p')],links:[requires('a','p'),requires('p','b')],aims:[]},'a','b')).toThrow();
  });
  it('drops self edges after a valid merge and refuses merging a concept with itself', () => {
    expect(mergeConcepts({concepts:[concept('a'),concept('b')],links:[requires('a','b')],aims:[]},'a','b').links).toEqual([]);
    expect(()=>mergeConcepts({concepts:[concept('a')],links:[],aims:[]},'a','a')).toThrow();
  });
});

describe('goal closure', () => {
  it('requires one decision for every owned aim and rejects extras, duplicates and invalid lowering', () => {
    const aims=[aim({ownerKind:'goal',ownerId:'g_1'})];
    expect(()=>closeGoal(aims,'g_1','l_1',[])).toThrow();
    expect(()=>closeGoal(aims,'g_1','l_1',[{aimId:'bad',action:'drop'}])).toThrow();
    expect(()=>closeGoal(aims,'g_1','l_1',[{aimId:'ai_1',action:'lower',newLevel:3}])).toThrow();
    expect(()=>closeGoal(aims,'g_1','l_1',[{aimId:'ai_1',action:'keep'},{aimId:'ai_1',action:'drop'}])).toThrow();
  });
  it('transfers kept/lowered aims, coalesces learner aims by max level and drops only intent', () => {
    const aims=[aim({id:'old',level:4}),aim({ownerKind:'goal',ownerId:'g_1',level:3}),
      aim({id:'drop',conceptId:'c_2',ownerKind:'goal',ownerId:'g_1'}),
      aim({id:'lower',conceptId:'c_3',ownerKind:'goal',ownerId:'g_1',level:4}),
      aim({id:'other',conceptId:'c_4',ownerKind:'goal',ownerId:'g_2'})];
    const before=JSON.stringify(aims); const result=closeGoal(aims,'g_1','l_1',[{aimId:'ai_1',action:'keep'},{aimId:'drop',action:'drop'},{aimId:'lower',action:'lower',newLevel:2}]);
    expect(result.aims.find(a=>a.conceptId==='c_1')).toMatchObject({level:4,ownerKind:'learner'});
    expect(result.aims.find(a=>a.conceptId==='c_3')).toMatchObject({level:2,ownerKind:'learner'});
    expect(result.aims.find(a=>a.conceptId==='c_2')).toBeUndefined();
    expect(result.aims.find(a=>a.id==='other')).toBeDefined();
    expect(result.aimHistory).toHaveLength(aims.length);
    expect(JSON.stringify(aims)).toBe(before);
  });
});
