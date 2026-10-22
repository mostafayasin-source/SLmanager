import { describe, expect, it } from 'vitest';
import {
  attendanceDuration,
  clockOut,
  correctSession,
  createClockIn,
  endBreak,
  shiftDurationMs,
  startBreak,
} from './attendance';
import { DomainError } from './errors';
import type { AttendanceSession } from './types';

function thrownCode(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
  }
  return '';
}

function session(partial: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: 'att_1',
    salonId: 'salon_a',
    employeeId: 'emp_a',
    clockIn: '2026-01-15T08:00:00.000Z',
    clockOut: null,
    breaks: [],
    corrections: [],
    ...partial,
  };
}

describe('attendance duration', () => {
  it('subtracts completed breaks from a same-day session', () => {
    const result = attendanceDuration(
      session({
        clockOut: '2026-01-15T16:00:00.000Z',
        breaks: [{ id: 'b1', start: '2026-01-15T11:00:00.000Z', end: '2026-01-15T11:30:00.000Z' }],
      }),
    );
    expect(result).toEqual({
      complete: true,
      grossMs: 8 * 3_600_000,
      breakMs: 30 * 60_000,
      netMs: 7.5 * 3_600_000,
    });
  });

  it('calculates a shift that crosses midnight, including a break across midnight', () => {
    const result = attendanceDuration(
      session({
        clockIn: '2026-01-15T21:00:00.000Z',
        clockOut: '2026-01-16T03:30:00.000Z',
        breaks: [{ id: 'b1', start: '2026-01-15T23:00:00.000Z', end: '2026-01-16T00:15:00.000Z' }],
      }),
    );
    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.grossMs).toBe(6.5 * 3_600_000);
      expect(result.breakMs).toBe(75 * 60_000);
      expect(result.netMs).toBe(result.grossMs - result.breakMs);
    }
  });

  it('keeps an open session incomplete and does not invent an end', () => {
    const open = session();
    const result = attendanceDuration(open);
    expect(result).toEqual({ complete: false });
    expect(open.clockOut).toBeNull();
  });

  it('treats a closed session with an open break as incomplete', () => {
    const result = attendanceDuration(
      session({
        clockOut: '2026-01-15T16:00:00.000Z',
        breaks: [{ id: 'b1', start: '2026-01-15T12:00:00.000Z', end: null }],
      }),
    );
    expect(result).toEqual({ complete: false });
  });

  it('measures an overnight planned shift from clock times', () => {
    expect(shiftDurationMs('22:00', '06:00')).toBe(8 * 3_600_000);
    expect(shiftDurationMs('09:00', '17:30')).toBe(8.5 * 3_600_000);
  });
});

describe('attendance transitions', () => {
  it('rejects a second open session for the same employee and salon', () => {
    const existing = session();
    expect(() => createClockIn([existing], { id: 'att_2', salonId: 'salon_a', employeeId: 'emp_a', at: '2026-01-15T09:00:00.000Z' })).toThrow(DomainError);
    try {
      createClockIn([existing], { id: 'att_2', salonId: 'salon_a', employeeId: 'emp_a', at: '2026-01-15T09:00:00.000Z' });
    } catch (error) {
      expect((error as DomainError).code).toBe('OPEN_SESSION_EXISTS');
    }
  });

  it('allows clock-in when the previous session is closed or belongs to another salon', () => {
    const closed = session({ clockOut: '2026-01-15T16:00:00.000Z' });
    const otherSalon = session({ id: 'att_other', salonId: 'salon_b' });
    const created = createClockIn([closed, otherSalon], {
      id: 'att_new',
      salonId: 'salon_a',
      employeeId: 'emp_a',
      at: '2026-01-16T08:00:00.000Z',
    });
    expect(created.clockOut).toBeNull();
    expect(created.salonId).toBe('salon_a');
  });

  it('rejects a break when nobody is clocked in', () => {
    expect(thrownCode(() => startBreak(session({ clockOut: '2026-01-15T16:00:00.000Z' }), '2026-01-15T12:00:00.000Z', 'b1'))).toBe('NO_OPEN_SESSION');
  });

  it('rejects a second open break and ending a break that has not started', () => {
    const onBreak = startBreak(session(), '2026-01-15T12:00:00.000Z', 'b1');
    expect(thrownCode(() => startBreak(onBreak, '2026-01-15T12:10:00.000Z', 'b2'))).toBe('ALREADY_ON_BREAK');
    expect(thrownCode(() => endBreak(session(), '2026-01-15T12:10:00.000Z'))).toBe('NOT_ON_BREAK');
  });

  it('rejects clock-out without a session and while a break is open', () => {
    expect(thrownCode(() => clockOut(session({ clockOut: '2026-01-15T16:00:00.000Z' }), '2026-01-15T17:00:00.000Z'))).toBe('NO_OPEN_SESSION');
    const onBreak = startBreak(session(), '2026-01-15T12:00:00.000Z', 'b1');
    expect(thrownCode(() => clockOut(onBreak, '2026-01-15T16:00:00.000Z'))).toBe('ON_BREAK');
  });

  it('records a correction with the original values, new values, time, and actor', () => {
    const original = session({
      clockOut: '2026-01-15T16:00:00.000Z',
      breaks: [{ id: 'b1', start: '2026-01-15T11:00:00.000Z', end: '2026-01-15T11:30:00.000Z' }],
    });
    const updated = correctSession(
      original,
      {
        clockIn: '2026-01-15T08:15:00.000Z',
        clockOut: '2026-01-15T16:05:00.000Z',
        breaks: [{ id: 'b1', start: '2026-01-15T11:00:00.000Z', end: '2026-01-15T11:20:00.000Z' }],
      },
      { id: 'cor_1', at: '2026-01-15T18:00:00.000Z', actor: 'Demo salongsägare', reason: 'Fel rast' },
    );
    expect(updated.corrections).toHaveLength(1);
    expect(updated.corrections[0]).toMatchObject({
      actor: 'Demo salongsägare',
      at: '2026-01-15T18:00:00.000Z',
      reason: 'Fel rast',
      before: { clockIn: original.clockIn, clockOut: original.clockOut },
      after: { clockIn: '2026-01-15T08:15:00.000Z', clockOut: '2026-01-15T16:05:00.000Z' },
    });
    expect(updated.corrections[0].before.breaks[0].end).toBe('2026-01-15T11:30:00.000Z');
    expect(original.clockIn).toBe('2026-01-15T08:00:00.000Z');
  });

  it('requires a reason and rejects an end before the start', () => {
    const original = session({ clockOut: '2026-01-15T16:00:00.000Z' });
    expect(
      thrownCode(() =>
        correctSession(original, { clockIn: original.clockIn, clockOut: original.clockOut, breaks: [] }, { id: 'c', at: original.clockIn, actor: 'Demo', reason: '   ' }),
      ),
    ).toBe('REASON_REQUIRED');
    expect(
      thrownCode(() =>
        correctSession(
          original,
          { clockIn: '2026-01-15T16:00:00.000Z', clockOut: '2026-01-15T08:00:00.000Z', breaks: [] },
          { id: 'c', at: original.clockIn, actor: 'Demo', reason: 'Bytte tid' },
        ),
      ),
    ).toBe('INVALID_TIME');
  });
});
