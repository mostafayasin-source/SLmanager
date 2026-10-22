import { DomainError } from './errors';
import type { AttendanceSession, BreakPeriod, SessionSnapshot } from './types';

export type DurationResult =
  | { complete: false }
  | { complete: true; grossMs: number; breakMs: number; netMs: number };

export interface CorrectionDraft {
  clockIn: string;
  clockOut: string | null;
  breaks: BreakPeriod[];
}

export function findOpenSession(sessions: AttendanceSession[], salonId: string, employeeId: string): AttendanceSession | undefined {
  return sessions.find((session) => session.salonId === salonId && session.employeeId === employeeId && session.clockOut === null);
}

export function shiftDurationMs(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  let start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  return (end - start) * 60_000;
}

export function attendanceDuration(session: Pick<AttendanceSession, 'clockIn' | 'clockOut' | 'breaks'>): DurationResult {
  if (!session.clockOut) return { complete: false };
  if (session.breaks.some((entry) => entry.end === null)) return { complete: false };
  const grossMs = Date.parse(session.clockOut) - Date.parse(session.clockIn);
  if (!Number.isFinite(grossMs) || grossMs <= 0) return { complete: false };
  let breakMs = 0;
  for (const entry of session.breaks) {
    if (!entry.end) return { complete: false };
    const span = Date.parse(entry.end) - Date.parse(entry.start);
    if (!Number.isFinite(span) || span <= 0) return { complete: false };
    breakMs += span;
  }
  return { complete: true, grossMs, breakMs, netMs: Math.max(0, grossMs - breakMs) };
}

function snapshot(session: Pick<AttendanceSession, 'clockIn' | 'clockOut' | 'breaks'>): SessionSnapshot {
  return {
    clockIn: session.clockIn,
    clockOut: session.clockOut,
    breaks: session.breaks.map((entry) => ({ start: entry.start, end: entry.end })),
  };
}

function validateTimeline(clockIn: string, clockOut: string | null, breaks: BreakPeriod[]): void {
  const inMs = Date.parse(clockIn);
  if (!Number.isFinite(inMs)) throw new DomainError('INVALID_TIME');
  const outMs = clockOut === null ? null : Date.parse(clockOut);
  if (clockOut !== null && (!Number.isFinite(outMs) || (outMs ?? 0) <= inMs)) throw new DomainError('INVALID_TIME');
  const openBreaks = breaks.filter((entry) => entry.end === null);
  if (openBreaks.length > 1) throw new DomainError('INVALID_TIME');
  if (outMs !== null && openBreaks.length > 0) throw new DomainError('ON_BREAK');

  const intervals = breaks.map((entry) => {
    const start = Date.parse(entry.start);
    const end = entry.end === null ? null : Date.parse(entry.end);
    if (!Number.isFinite(start) || start < inMs) throw new DomainError('INVALID_TIME');
    if (end !== null && (!Number.isFinite(end) || end <= start)) throw new DomainError('INVALID_TIME');
    if (outMs !== null && (start >= outMs || (end !== null && end > outMs))) throw new DomainError('INVALID_TIME');
    return { start, end };
  });
  intervals.sort((a, b) => a.start - b.start);
  for (let index = 1; index < intervals.length; index += 1) {
    const previousEnd = intervals[index - 1].end;
    if (previousEnd === null || intervals[index].start < previousEnd) throw new DomainError('OVERLAPPING_BREAK');
  }
}

export function createClockIn(sessions: AttendanceSession[], input: { id: string; salonId: string; employeeId: string; at: string }): AttendanceSession {
  if (findOpenSession(sessions, input.salonId, input.employeeId)) throw new DomainError('OPEN_SESSION_EXISTS');
  if (!Number.isFinite(Date.parse(input.at))) throw new DomainError('INVALID_TIME');
  return {
    id: input.id,
    salonId: input.salonId,
    employeeId: input.employeeId,
    clockIn: input.at,
    clockOut: null,
    breaks: [],
    corrections: [],
  };
}

export function startBreak(session: AttendanceSession, at: string, breakId: string): AttendanceSession {
  if (session.clockOut) throw new DomainError('NO_OPEN_SESSION');
  if (session.breaks.some((entry) => entry.end === null)) throw new DomainError('ALREADY_ON_BREAK');
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs) || atMs < Date.parse(session.clockIn)) throw new DomainError('INVALID_TIME');
  return { ...session, breaks: [...session.breaks, { id: breakId, start: at, end: null }] };
}

export function endBreak(session: AttendanceSession, at: string): AttendanceSession {
  if (session.clockOut) throw new DomainError('NO_OPEN_SESSION');
  const index = session.breaks.findIndex((entry) => entry.end === null);
  if (index === -1) throw new DomainError('NOT_ON_BREAK');
  const current = session.breaks[index];
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs) || atMs <= Date.parse(current.start)) throw new DomainError('INVALID_TIME');
  const breaks = session.breaks.slice();
  breaks[index] = { ...current, end: at };
  return { ...session, breaks };
}

export function clockOut(session: AttendanceSession, at: string): AttendanceSession {
  if (session.clockOut) throw new DomainError('NO_OPEN_SESSION');
  if (session.breaks.some((entry) => entry.end === null)) throw new DomainError('ON_BREAK');
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs) || atMs <= Date.parse(session.clockIn)) throw new DomainError('INVALID_TIME');
  return { ...session, clockOut: at };
}

export function correctSession(
  session: AttendanceSession,
  draft: CorrectionDraft,
  meta: { id: string; at: string; actor: string; reason: string },
): AttendanceSession {
  const reason = meta.reason.trim();
  if (!reason) throw new DomainError('REASON_REQUIRED');
  validateTimeline(draft.clockIn, draft.clockOut, draft.breaks);
  const before = snapshot(session);
  const after = snapshot({ clockIn: draft.clockIn, clockOut: draft.clockOut, breaks: draft.breaks });
  return {
    ...session,
    clockIn: draft.clockIn,
    clockOut: draft.clockOut,
    breaks: draft.breaks.map((entry) => ({ ...entry })),
    corrections: [
      ...session.corrections,
      {
        id: meta.id,
        at: meta.at,
        actor: meta.actor,
        reason,
        before,
        after,
      },
    ],
  };
}

export function isOnBreak(session: AttendanceSession): boolean {
  return session.clockOut === null && session.breaks.some((entry) => entry.end === null);
}
