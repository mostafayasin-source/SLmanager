import { DomainError } from './errors';
import type { Shift } from './types';
import { addDaysYmd, stockholmDateTimeToIso } from './time';

export function shiftInterval(shift: Pick<Shift, 'date' | 'startTime' | 'endTime'>): { startIso: string; endIso: string; overnight: boolean } {
  const overnight = shift.endTime <= shift.startTime;
  const endDate = overnight ? addDaysYmd(shift.date, 1) : shift.date;
  return {
    overnight,
    startIso: stockholmDateTimeToIso(shift.date, shift.startTime),
    endIso: stockholmDateTimeToIso(endDate, shift.endTime),
  };
}

export function weekBounds(weekStart: string): { prevStart: string; prevEnd: string; weekEnd: string } {
  return {
    prevStart: addDaysYmd(weekStart, -7),
    prevEnd: addDaysYmd(weekStart, -1),
    weekEnd: addDaysYmd(weekStart, 6),
  };
}

export function copyPreviousWeek(shifts: Shift[], salonId: string, weekStart: string, newId: () => string): { shifts: Shift[]; copied: number; removed: number } {
  const { prevStart, prevEnd, weekEnd } = weekBounds(weekStart);
  const source = shifts.filter((shift) => shift.salonId === salonId && shift.date >= prevStart && shift.date <= prevEnd);
  if (source.length === 0) throw new DomainError('EMPTY_COPY');
  const removed = shifts.filter((shift) => shift.salonId === salonId && shift.date >= weekStart && shift.date <= weekEnd).length;
  const kept = shifts.filter((shift) => !(shift.salonId === salonId && shift.date >= weekStart && shift.date <= weekEnd));
  const copied = source.map((shift) => ({
    ...shift,
    id: newId(),
    date: addDaysYmd(shift.date, 7),
  }));
  return { shifts: [...kept, ...copied], copied: copied.length, removed };
}
