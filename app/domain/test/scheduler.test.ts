import { describe, expect, it } from 'vitest';
import { createSchedulerManifest, replaySchedule, schedulerRating, type Correction, type Evidence } from '../src/index.ts';

const observed=(overrides:Partial<Evidence>={}):Evidence=>({id:'e_1',seq:1,conceptId:'c_1',level:2,kind:'answer',contentGrade:'correct',confidence:'sure',assessmentForm:'production',occurredAt:'2026-10-27T10:00:00.000Z',acceptedAt:'2026-10-27T10:00:00.000Z',localDay:'2026-10-27',...overrides});
const second=(overrides:Partial<Evidence>={})=>observed({id:'e_2',seq:2,occurredAt:'2026-10-28T10:00:00.000Z',acceptedAt:'2026-10-28T10:00:00.000Z',localDay:'2026-10-28',...overrides});

describe('versioned scheduler adapter',()=>{
  it('pins deterministic rules rather than depending on changing package defaults',()=>{
    const a=createSchedulerManifest();const b=createSchedulerManifest();
    expect(a).toEqual(b);
    expect(a).toMatchObject({rulesVersion:1,engine:'ts-fsrs',parameters:{request_retention:0.9,enable_fuzz:false,maximum_interval:36500}});
    expect(a.parameters.w.length).toBeGreaterThan(0);
  });
  it('maps assessment strength without using Easy or treating omissions as failures',()=>{
    expect(schedulerRating(observed())).toBe('Good');
    expect(schedulerRating(observed({confidence:'guess'}))).toBe('Hard');
    expect(schedulerRating(observed({contentHint:true}))).toBe('Hard');
    expect(schedulerRating(observed({assessmentForm:'recognition'}))).toBe('Hard');
    expect(schedulerRating(observed({contentGrade:'wrong'}))).toBe('Again');
    expect(schedulerRating(observed({contentGrade:'partial'}))).toBe('Again');
    expect(schedulerRating(observed({confidence:'unknown'}))).toBeNull();
    expect(schedulerRating(observed({kind:'exposure',contentGrade:'na'}))).toBeNull();
  });
  it('initialises only after Solid and stores complete serialisable state',async()=>{
    expect(await replaySchedule([observed({contentGrade:'wrong'})])).toBeNull();
    expect(await replaySchedule([observed({confidence:'guess'})])).toBeNull();
    const result=await replaySchedule([observed()]);
    expect(result).toMatchObject({lastRatedSeq:1,ratingCount:1});
    expect(new Date(result!.dueAt).getTime()).toBeGreaterThanOrEqual(Date.parse(observed().occurredAt));
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
  it('is deterministic across ordering/repeated calls, and practice may reschedule but not initialise',async()=>{
    const records=Object.freeze([Object.freeze(second({confidence:'guess'})),Object.freeze(observed())]);
    const schedule=await replaySchedule(records);
    expect(schedule).toEqual(await replaySchedule([...records].reverse()));
    expect(schedule).toMatchObject({lastRatedSeq:2,ratingCount:2});
  });
  it('unknown confidence changes neither scheduler state nor rated revision',async()=>{
    expect(await replaySchedule([observed(),second({confidence:'unknown'})])).toEqual(await replaySchedule([observed()]));
  });
  it('respects scheduling eligibility for expired or superseded review leases',async()=>{
    expect(await replaySchedule([observed(),second({schedulingEligible:false})])).toEqual(await replaySchedule([observed()]));
  });
  it('dispute replay excludes the attempt and a regrade rates its original time once',async()=>{
    const dispute:Correction={rootRecordId:'e_1',expectedEffectiveRevision:0,effectiveRevision:1,action:'dispute',seq:3};
    expect(await replaySchedule([observed()], [dispute])).toBeNull();
    const resolve:Correction={...dispute,expectedEffectiveRevision:1,effectiveRevision:2,action:'resolve',seq:4,replacement:{contentGrade:'correct'}};
    expect(await replaySchedule([observed(),second()],[dispute,resolve])).toEqual(await replaySchedule([observed(),second()]));
  });
  it('supports concept/level filters and does not mutate an explicit manifest',async()=>{
    const manifest=createSchedulerManifest();const before=JSON.stringify(manifest);
    const results=await replaySchedule([observed(),second({conceptId:'other'})],[],{conceptId:'c_1',level:2,manifest});
    expect(results).toEqual(await replaySchedule([observed()]));
    expect(JSON.stringify(manifest)).toBe(before);
  });
});

it('rejects combining review schedules from different concepts or depths',async()=>{
  await expect(replaySchedule([observed(),second({conceptId:'c_2'})])).rejects.toThrow('one concept and level');
});

it('schedules at immutable acceptance time, preserving original backfilled mastery day through regrade',async()=>{
 const record=observed({occurredAt:'2026-01-01T00:00:00Z',localDay:'2026-01-01',acceptedAt:'2026-10-27T10:00:00Z'});
 const schedule=await replaySchedule([record]);
 const equivalent=await replaySchedule([observed({occurredAt:'2026-10-27T10:00:00Z'})]);
 expect(schedule?.card).toEqual(equivalent?.card);
 expect(schedule?.logs[0]?.reviewTime).toBe('2026-10-27T10:00:00.000Z');
 const corrections:Correction[]=[{rootRecordId:'e_1',expectedEffectiveRevision:0,effectiveRevision:1,seq:2,action:'dispute'},{rootRecordId:'e_1',expectedEffectiveRevision:1,effectiveRevision:2,seq:3,action:'resolve',replacement:{contentGrade:'correct'}}];
 expect(await replaySchedule([record],corrections)).toEqual(schedule);
});

it('replays by acceptance rather than completion/backfill order and preserves sequence ties',async()=>{
 const earlier=observed({acceptedAt:'2026-10-27T10:00:00Z',occurredAt:'2026-10-29T10:00:00Z'});
 const later=second({acceptedAt:'2026-10-28T10:00:00Z',occurredAt:'2026-01-01T10:00:00Z',contentGrade:'wrong'});
 const schedule=await replaySchedule([later,earlier]);
 expect(schedule?.logs.map(log=>log.reviewTime)).toEqual(['2026-10-27T10:00:00.000Z','2026-10-28T10:00:00.000Z']);
 expect(schedule?.logs.map(log=>log.rating)).toEqual([3,1]);
});

it('rejects rateable evidence without immutable server acceptance time',async()=>{
 const {acceptedAt: _acceptedAt,...record}=observed();
 await expect(replaySchedule([record])).rejects.toThrow('Acceptance time required');
});

it('does not require acceptance timestamps for non-rateable exposure',async()=>{
 const {acceptedAt: _acceptedAt,...record}=observed({kind:'exposure',contentGrade:'na'});
 expect(await replaySchedule([record])).toBeNull();
});
