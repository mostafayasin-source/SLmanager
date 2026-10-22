import { describe, expect, it } from 'vitest';
import { missingClockOutReason } from './dashboard';
import { buildTimeReport } from './reports';
import { copyPreviousWeek } from './schedule';
import { effectiveStatus } from './subscription';
import { stockholmDateTimeToIso } from './time';
import type { Actor, AppData, AttendanceSession, Employee, Shift } from './types';
import { clockIn, copyWeek } from '../data/mutations';
import { DomainError } from './errors';

function thrownCode(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
  }
  return '';
}

const actor = (role: Actor['role'], salonId: string | null): Actor => ({
  role,
  salonId,
  displayName: role === 'platform' ? 'Demo plattformsägare' : 'Demo salongsägare',
});

function employee(partial: Partial<Employee> & Pick<Employee, 'id' | 'salonId'>): Employee {
  return {
    firstName: 'Test',
    lastName: 'Testsson',
    jobTitle: 'Barberare',
    email: 'test@example.com',
    phone: '',
    active: true,
    ...partial,
  };
}

function shift(partial: Partial<Shift> & Pick<Shift, 'id' | 'salonId' | 'employeeId' | 'date'>): Shift {
  return { startTime: '09:00', endTime: '17:00', note: '', ...partial };
}

describe('time zone and subscription status', () => {
  it('converts Europe/Stockholm local time to UTC in winter and summer', () => {
    expect(stockholmDateTimeToIso('2026-01-15', '09:00')).toBe('2026-01-15T08:00:00.000Z');
    expect(stockholmDateTimeToIso('2026-07-15', '09:00')).toBe('2026-07-15T07:00:00.000Z');
  });

  it('derives active, expiring, expired, and suspended statuses', () => {
    expect(effectiveStatus({ subscriptionStatus: 'active', subscriptionExpiry: '2026-12-01' }, '2026-10-20')).toBe('active');
    expect(effectiveStatus({ subscriptionStatus: 'active', subscriptionExpiry: '2026-10-26' }, '2026-10-20')).toBe('expiring');
    expect(effectiveStatus({ subscriptionStatus: 'active', subscriptionExpiry: '2026-10-19' }, '2026-10-20')).toBe('expired');
    expect(effectiveStatus({ subscriptionStatus: 'suspended', subscriptionExpiry: '2026-12-01' }, '2026-10-20')).toBe('suspended');
  });
});

describe('salon isolation', () => {
  const data = (): AppData => ({
    version: 1,
    salons: [
      {
        id: 'salon_a',
        name: 'A',
        contactEmail: 'a@example.com',
        phone: '',
        address: '',
        subscriptionPrice: 1000,
        subscriptionStart: '2026-01-01',
        subscriptionExpiry: '2099-12-31',
        subscriptionStatus: 'active',
      },
      {
        id: 'salon_b',
        name: 'B',
        contactEmail: 'b@example.com',
        phone: '',
        address: '',
        subscriptionPrice: 1000,
        subscriptionStart: '2026-01-01',
        subscriptionExpiry: '2099-12-31',
        subscriptionStatus: 'suspended',
      },
    ],
    employees: [employee({ id: 'emp_a', salonId: 'salon_a' }), employee({ id: 'emp_b', salonId: 'salon_b' })],
    shifts: [
      shift({ id: 's1', salonId: 'salon_a', employeeId: 'emp_a', date: '2026-10-12' }),
      shift({ id: 's2', salonId: 'salon_b', employeeId: 'emp_b', date: '2026-10-12' }),
      shift({ id: 's3', salonId: 'salon_a', employeeId: 'emp_a', date: '2026-10-19' }),
    ],
    attendance: [],
    tickets: [],
    supportPhone: null,
  });

  it('keeps other salons out of the time report', () => {
    const rows = buildTimeReport({
      salonId: 'salon_a',
      from: '2026-10-12',
      to: '2026-10-18',
      employees: data().employees,
      shifts: data().shifts,
      attendance: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].scheduledMs).toBe(8 * 3_600_000);
  });

  it('copies only the selected salon and can replace that week', () => {
    const result = copyPreviousWeek(data().shifts, 'salon_a', '2026-10-19', () => 'copied');
    const salonB = result.shifts.filter((item) => item.salonId === 'salon_b');
    const copied = result.shifts.filter((item) => item.id === 'copied');
    expect(salonB).toHaveLength(1);
    expect(copied).toEqual([expect.objectContaining({ salonId: 'salon_a', date: '2026-10-19', employeeId: 'emp_a' })]);
    expect(result.removed).toBe(1);
    expect(result.shifts.find((item) => item.id === 's3')).toBeUndefined();
  });

  it('blocks schedule copy for another salon and for a suspended subscription', () => {
    expect(thrownCode(() => copyWeek(data(), actor('salon', 'salon_a'), 'salon_b', '2026-10-19', () => 'x'))).toBe('FORBIDDEN_SALON');
    expect(thrownCode(() => copyWeek(data(), actor('salon', 'salon_b'), 'salon_b', '2026-10-19', () => 'x'))).toBe('SUBSCRIPTION_LOCKED');
  });

  it('blocks clock-in when the subscription is suspended', () => {
    expect(thrownCode(() => clockIn(data(), actor('salon', 'salon_b'), 'salon_b', 'emp_b', '2026-10-20T08:00:00.000Z', 'att_new'))).toBe('SUBSCRIPTION_LOCKED');
    const next = clockIn(data(), actor('salon', 'salon_a'), 'salon_a', 'emp_a', '2026-10-20T08:00:00.000Z', 'att_new');
    expect(next.attendance).toHaveLength(1);
    expect(next.attendance[0].salonId).toBe('salon_a');
  });
});

describe('missing clock-outs', () => {
  const open = (clockIn: string): AttendanceSession => ({
    id: 'att',
    salonId: 'salon_a',
    employeeId: 'emp_a',
    clockIn,
    clockOut: null,
    breaks: [],
    corrections: [],
  });

  it('flags previous days and ended shifts, and leaves a current shift alone', () => {
    const shifts = [shift({ id: 's', salonId: 'salon_a', employeeId: 'emp_a', date: '2026-10-20', startTime: '09:00', endTime: '12:00' })];
    expect(missingClockOutReason(open('2026-10-19T08:00:00.000Z'), shifts, '2026-10-20T10:00:00.000Z', '2026-10-20')).toBe('previous-day');
    expect(missingClockOutReason(open('2026-10-20T07:00:00.000Z'), shifts, '2026-10-20T11:00:00.000Z', '2026-10-20')).toBe('shift-ended');
    expect(missingClockOutReason(open('2026-10-20T07:00:00.000Z'), shifts, '2026-10-20T09:30:00.000Z', '2026-10-20')).toBeNull();
  });
});

describe('domain errors', () => {
  it('uses DomainError for invalid copy sources', () => {
    expect(thrownCode(() => copyPreviousWeek([], 'salon_a', '2026-10-19', () => 'x'))).toBe('EMPTY_COPY');
  });
});
