import { attendanceDuration, shiftDurationMs } from './attendance';
import type { AttendanceSession, Employee, Shift } from './types';
import { employeeName } from './types';
import { stockholmYmdFromIso } from './time';

export interface ReportRow {
  employeeId: string;
  name: string;
  jobTitle: string;
  active: boolean;
  scheduledMs: number;
  actualMs: number;
  incomplete: number;
}

export function buildTimeReport(input: {
  salonId: string;
  from: string;
  to: string;
  employees: Employee[];
  shifts: Shift[];
  attendance: AttendanceSession[];
}): ReportRow[] {
  const salonEmployees = input.employees.filter((employee) => employee.salonId === input.salonId);
  const rows = new Map<string, ReportRow>();
  for (const employee of salonEmployees) {
    rows.set(employee.id, {
      employeeId: employee.id,
      name: employeeName(employee),
      jobTitle: employee.jobTitle,
      active: employee.active,
      scheduledMs: 0,
      actualMs: 0,
      incomplete: 0,
    });
  }

  for (const shift of input.shifts) {
    if (shift.salonId !== input.salonId || shift.date < input.from || shift.date > input.to) continue;
    const row = rows.get(shift.employeeId);
    if (!row) continue;
    row.scheduledMs += shiftDurationMs(shift.startTime, shift.endTime);
  }

  for (const session of input.attendance) {
    if (session.salonId !== input.salonId) continue;
    const clockInDate = stockholmYmdFromIso(session.clockIn);
    if (clockInDate < input.from || clockInDate > input.to) continue;
    const row = rows.get(session.employeeId);
    if (!row) continue;
    const duration = attendanceDuration(session);
    if (!duration.complete) {
      row.incomplete += 1;
      continue;
    }
    row.actualMs += duration.netMs;
  }

  return [...rows.values()]
    .filter((row) => row.active || row.scheduledMs > 0 || row.actualMs > 0 || row.incomplete > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}
