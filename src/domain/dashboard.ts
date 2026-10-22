import type { AttendanceSession, Shift } from './types';
import { isOnBreak } from './attendance';
import { shiftInterval } from './schedule';
import { stockholmYmdFromIso } from './time';

export type MissingReason = 'previous-day' | 'shift-ended';

export function missingClockOutReason(session: AttendanceSession, shifts: Shift[], nowIso: string, today: string): MissingReason | null {
  if (session.clockOut) return null;
  const clockInDate = stockholmYmdFromIso(session.clockIn);
  if (clockInDate < today) return 'previous-day';
  const dayShifts = shifts.filter((shift) => shift.salonId === session.salonId && shift.employeeId === session.employeeId && shift.date === today);
  if (dayShifts.length === 0) return null;
  const allEnded = dayShifts.every((shift) => shiftInterval(shift).endIso <= nowIso);
  return allEnded ? 'shift-ended' : null;
}

export function sessionPhase(session: AttendanceSession): 'closed' | 'break' | 'working' {
  if (session.clockOut) return 'closed';
  if (isOnBreak(session)) return 'break';
  return 'working';
}
