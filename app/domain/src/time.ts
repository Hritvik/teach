import { DomainError } from './errors.ts';
export const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new DomainError('Invalid observation timestamp');
  return parsed;
};
export function localDay(at: string, timeZone: string): string {
  const date = new Date(instant(at));
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (name: string) => parts.find(part => part.type === name)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function validateLocalDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new DomainError('Invalid observation local day');
  const date = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new DomainError('Invalid observation local day');
}
