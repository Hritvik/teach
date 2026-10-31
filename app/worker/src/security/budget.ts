import { z } from 'zod';
import type { LedgerFailure } from './index.ts';
export const BUDGET_PRICE_POLICY = 'openai-global-2026-10-v1';
export const BUDGET_MODEL_SNAPSHOT = 'gpt-5.4-mini-2026-03-17';
export const BUDGET_CAP_MICRO_USD = 5_000_000;
export const BUDGET_RESERVATION_MICRO_USD = 309_216;
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const configuration = z.strictObject({ period, timezone: z.string().min(1).max(128), modelSnapshot: z.literal(BUDGET_MODEL_SNAPSHOT), pricePolicy: z.literal(BUDGET_PRICE_POLICY), authorized: z.literal(true), verified: z.literal(true) });
const reservation = z.strictObject({ dispatchId: id, jobId: id, grantId: id, generation: z.number().int().positive(), pricePolicy: z.literal(BUDGET_PRICE_POLICY), expectedTimezone: z.string().min(1).max(128), purpose: z.enum(['key_verify','grade','regrade']).default('grade') });
const settlement = z.discriminatedUnion('outcome', [
 z.strictObject({ dispatchId: id, outcome: z.literal('confirmed'), inputTokens: integer, outputTokens: integer }),
 z.strictObject({ dispatchId: id, outcome: z.literal('unknown') }),
 z.strictObject({ dispatchId: id, outcome: z.literal('disputed'), knownMicroUSD: integer.optional() }),
]);
export type BudgetPolicyInput = z.infer<typeof configuration>;
export type BudgetReservationInput = z.infer<typeof reservation>;
export type BudgetSettlementInput = z.infer<typeof settlement>;
export interface BudgetReservation { readonly dispatchId:string;readonly jobId:string;readonly period:string;readonly reservedMicroUSD:number;readonly modelSnapshot:string;readonly pricePolicy:string; }
export type BudgetReservationResult = {readonly ok:true;readonly reservation:BudgetReservation}|LedgerFailure;
export interface BudgetStatus { readonly timezone:string;readonly period:string;readonly limitMicroUSD:number;readonly reservedMicroUSD:number;readonly settledMicroUSD:number;readonly remainingMicroUSD:number;readonly suspended:boolean;readonly enabled:boolean;readonly pricePolicy:string; }
export type BudgetStatusResult = {readonly ok:true;readonly budget:BudgetStatus}|LedgerFailure;
export type BudgetResult = {readonly ok:true}|LedgerFailure;
interface MonthRow {[key:string]:SqlStorageValue;period:string;price_policy:string;model_snapshot:string;cap_micro_usd:number;suspended:number;}
interface CallRow {[key:string]:SqlStorageValue;dispatch_id:string;job_id:string;period:string;reserved_micro_usd:number;liability_micro_usd:number;status:string;input_tokens:number|null;output_tokens:number|null;}
const fail=(code:string,message:string):LedgerFailure=>({ok:false,error:{code,message}});
const row=<T extends Record<string,SqlStorageValue>>(storage:DurableObjectStorage,sql:string,...args:SqlStorageValue[])=>storage.sql.exec<T>(sql,...args).toArray()[0];
export const BUDGET_SCHEMA = `CREATE TABLE IF NOT EXISTS ledger_budget_config (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), timezone TEXT NOT NULL
); CREATE TABLE IF NOT EXISTS ledger_budget_months (
 period TEXT PRIMARY KEY,price_policy TEXT NOT NULL,model_snapshot TEXT NOT NULL,cap_micro_usd INTEGER NOT NULL,suspended INTEGER NOT NULL DEFAULT 0
); CREATE TABLE IF NOT EXISTS ledger_budget_reservations (
 dispatch_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,period TEXT NOT NULL REFERENCES ledger_budget_months(period),
 reserved_micro_usd INTEGER NOT NULL,liability_micro_usd INTEGER NOT NULL,status TEXT NOT NULL,
 input_tokens INTEGER,output_tokens INTEGER,created_at INTEGER NOT NULL
); CREATE INDEX IF NOT EXISTS ledger_budget_job ON ledger_budget_reservations(job_id);`;
function localPeriod(timezone:string):string {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit'}).formatToParts(new Date());
 return `${parts.find(part=>part.type==='year')!.value}-${parts.find(part=>part.type==='month')!.value}`;
}
function cost(input:number,output:number):number {return Math.ceil((input*3+output*18)/4);}
/** Private authority held in the security DO. Never import this state from a learning backup. */
export class BudgetLedger {
 constructor(private readonly storage:DurableObjectStorage){}
 configureBudgetPolicy(input:unknown):BudgetResult {
  const parsed=configuration.safeParse(input);if(!parsed.success)return fail('BUDGET_DISABLED','An explicitly authorized verified pinned price policy is required.');
  const config=parsed.data;let current:string;try{current=localPeriod(config.timezone);}catch{return fail('INVALID_INPUT','Invalid learner timezone.');}
  if(config.period!==current)return fail('BUDGET_DISABLED','Verify and authorize the policy for the current learner-local month.');
  return this.storage.transactionSync(()=>{
   if(!row(this.storage,'SELECT learner_id FROM ledger_control WHERE singleton=1'))return fail('UNAUTHORISED','The learner is not configured.');
   const previous=row<{[key:string]:SqlStorageValue;timezone:string}>(this.storage,'SELECT timezone FROM ledger_budget_config WHERE singleton=1');
   if(previous&&previous.timezone!==config.timezone)return fail('VERSION_CONFLICT','Budget admission timezone cannot be silently changed.');
   const month=row<MonthRow>(this.storage,'SELECT * FROM ledger_budget_months WHERE period=?',config.period);
   if(row(this.storage,'SELECT period FROM ledger_budget_months WHERE suspended=1 LIMIT 1'))return fail('BUDGET_SUSPENDED','A billing discrepancy requires trusted reconciliation.');
   if(!previous)this.storage.sql.exec('INSERT INTO ledger_budget_config VALUES(1,?)',config.timezone);
   if(!month)this.storage.sql.exec('INSERT INTO ledger_budget_months VALUES(?,?,?,?,0)',config.period,config.pricePolicy,config.modelSnapshot,BUDGET_CAP_MICRO_USD);
   return {ok:true};
  });
 }
 reserveBudget(input:unknown):BudgetReservationResult {
  const parsed=reservation.safeParse(input);if(!parsed.success)return fail('INVALID_INPUT','Invalid dispatch reservation.');
  const call=parsed.data;
  return this.storage.transactionSync(()=>{
   const control=row<{[key:string]:SqlStorageValue;generation:number;mode:string}>(this.storage,'SELECT generation,mode FROM ledger_control WHERE singleton=1');
   const grant=row<{[key:string]:SqlStorageValue;status:string;scopes_json:string}>(this.storage,'SELECT status,scopes_json FROM ledger_grants WHERE grant_id=?',call.grantId);
   if(!control||grant?.status!=='active'||!(JSON.parse(grant.scopes_json) as string[]).includes(call.purpose==='key_verify'?'teach:organize':'teach:learn'))return fail('FORBIDDEN','A live learning capability is required.');
   if(control.generation!==call.generation||control.mode!=='active')return fail('STALE_GENERATION','Dispatch requires the active recovery generation.');
   const timezone=row<{[key:string]:SqlStorageValue;timezone:string}>(this.storage,'SELECT timezone FROM ledger_budget_config WHERE singleton=1');
   if(timezone&&timezone.timezone!==call.expectedTimezone)return fail('PRICE_POLICY_UNVERIFIED','Dispatch timezone does not match the authoritative learner budget timezone.');
   const admissionPeriod=timezone?localPeriod(timezone.timezone):'';
   const month=row<MonthRow>(this.storage,'SELECT * FROM ledger_budget_months WHERE period=?',admissionPeriod);
   if(!month)return fail('BUDGET_DISABLED','The price policy is not authorized for this admission month.');
   if(row(this.storage,'SELECT period FROM ledger_budget_months WHERE suspended=1 LIMIT 1'))return fail('BUDGET_SUSPENDED','Billing reconciliation has paused dispatch.');
   if(row(this.storage,'SELECT dispatch_id FROM ledger_budget_reservations WHERE dispatch_id=?',call.dispatchId))return fail('DISPATCH_ALREADY_RESERVED','This physical dispatch identity has already been reserved.');
   const count=row<{[key:string]:SqlStorageValue;n:number}>(this.storage,'SELECT COUNT(*) AS n FROM ledger_budget_reservations WHERE job_id=?',call.jobId)!.n;
   if(count>=2)return fail('CALL_LIMIT_EXCEEDED','The job has reached its two physical call limit.');
   const total=row<{[key:string]:SqlStorageValue;n:number}>(this.storage,'SELECT COALESCE(SUM(liability_micro_usd),0) AS n FROM ledger_budget_reservations WHERE period=?',admissionPeriod)!.n;
   if(total+BUDGET_RESERVATION_MICRO_USD>month.cap_micro_usd)return fail('BUDGET_EXHAUSTED','The monthly inference liability cap is exhausted.');
   this.storage.sql.exec('INSERT INTO ledger_budget_reservations VALUES(?,?,?,?,?,\'reserved\',NULL,NULL,?)',call.dispatchId,call.jobId,admissionPeriod,BUDGET_RESERVATION_MICRO_USD,BUDGET_RESERVATION_MICRO_USD,Date.now());
   return {ok:true,reservation:{dispatchId:call.dispatchId,jobId:call.jobId,period:admissionPeriod,reservedMicroUSD:BUDGET_RESERVATION_MICRO_USD,modelSnapshot:month.model_snapshot,pricePolicy:month.price_policy}};
  });
 }
 settleBudget(input:unknown):BudgetResult {
  const parsed=settlement.safeParse(input);if(!parsed.success)return fail('INVALID_INPUT','Invalid provider usage settlement.');
  const result=parsed.data;
  return this.storage.transactionSync(()=>{
   const call=row<CallRow>(this.storage,'SELECT * FROM ledger_budget_reservations WHERE dispatch_id=?',result.dispatchId);
   if(!call)return fail('INVALID_INPUT','Unknown physical dispatch.');
   if(result.outcome==='unknown'){
    if(call.status==='reserved')this.storage.sql.exec("UPDATE ledger_budget_reservations SET status='unknown' WHERE dispatch_id=?",call.dispatch_id);
    return {ok:true};
   }
   if(result.outcome==='disputed'){
    this.dispute(call,result.knownMicroUSD??0);return {ok:true};
   }
   if(call.status==='disputed')return fail('BUDGET_SUSPENDED','Disputed liability cannot be released without trusted reconciliation.');
   const known=cost(result.inputTokens,result.outputTokens);
   if(!Number.isSafeInteger(known)||result.inputTokens>400000||result.outputTokens>2048){this.dispute(call,Number.isSafeInteger(known)?known:Number.MAX_SAFE_INTEGER);return fail('BUDGET_SUSPENDED','Provider usage exceeded the verified bounds.');}
   if(call.status==='settled'){
    if(call.input_tokens===result.inputTokens&&call.output_tokens===result.outputTokens)return {ok:true};
    this.dispute(call,known);return fail('BUDGET_SUSPENDED','Conflicting provider usage requires reconciliation.');
   }
   this.storage.sql.exec("UPDATE ledger_budget_reservations SET status='settled',liability_micro_usd=?,input_tokens=?,output_tokens=? WHERE dispatch_id=?",known,result.inputTokens,result.outputTokens,call.dispatch_id);
   return {ok:true};
  });
 }
 private dispute(call:CallRow,known:number):void {
  this.storage.sql.exec("UPDATE ledger_budget_reservations SET status='disputed',liability_micro_usd=? WHERE dispatch_id=?",Math.max(call.reserved_micro_usd,call.liability_micro_usd,known),call.dispatch_id);
  this.storage.sql.exec('UPDATE ledger_budget_months SET suspended=1 WHERE period=?',call.period);
 }
 budgetStatus(input?:string):BudgetStatusResult {
  if(input!==undefined&&!period.safeParse(input).success)return fail('INVALID_INPUT','Invalid budget period.');
  return this.storage.transactionSync(()=>{
   const timezone=row<{[key:string]:SqlStorageValue;timezone:string}>(this.storage,'SELECT timezone FROM ledger_budget_config WHERE singleton=1');
   if(!timezone)return fail('BUDGET_DISABLED','No authoritative learner budget timezone is configured.');
   const selected=input??localPeriod(timezone.timezone);
   const month=row<MonthRow>(this.storage,'SELECT * FROM ledger_budget_months WHERE period=?',selected);
   if(!month)return fail('BUDGET_DISABLED','No authorized budget policy for this month.');
   const totals=row<{[key:string]:SqlStorageValue;settled:number;reserved:number}>(this.storage,"SELECT COALESCE(SUM(CASE WHEN status='settled' THEN liability_micro_usd ELSE 0 END),0) AS settled,COALESCE(SUM(CASE WHEN status<>'settled' THEN liability_micro_usd ELSE 0 END),0) AS reserved FROM ledger_budget_reservations WHERE period=?",selected)!;
   const suspended=!!row(this.storage,'SELECT period FROM ledger_budget_months WHERE suspended=1 LIMIT 1');
   return {ok:true,budget:{timezone:timezone.timezone,period:selected,limitMicroUSD:month.cap_micro_usd,settledMicroUSD:totals.settled,reservedMicroUSD:totals.reserved,remainingMicroUSD:Math.max(0,month.cap_micro_usd-totals.settled-totals.reserved),suspended,enabled:!suspended,pricePolicy:month.price_policy}};
  });
 }
}
