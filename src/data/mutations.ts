import { clockOut, correctSession, createClockIn, endBreak, startBreak } from '../domain/attendance';
import { DomainError } from '../domain/errors';
import { normalizeSupportPhone } from '../domain/phone';
import { copyPreviousWeek } from '../domain/schedule';
import { buildTicket, createMessage, markRead, replyOnTicket, withStatus } from '../domain/support';
import { allowsOperations, effectiveStatus, renewedExpiry } from '../domain/subscription';
import { isYmd, normalizeHm, stockholmToday } from '../domain/time';
import type { Actor, AppData, AttendanceSession, Employee, Salon, SupportTicket } from '../domain/types';
import type { BreakPeriod } from '../domain/types';

export interface SalonInput {
  name: string;
  contactEmail: string;
  phone: string;
  address: string;
  subscriptionPrice: number;
  subscriptionStart: string;
  subscriptionExpiry: string;
}

export interface SalonProfileInput {
  name: string;
  contactEmail: string;
  phone: string;
  address: string;
}

export interface EmployeeInput {
  id?: string;
  salonId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
}

export interface ShiftInput {
  id?: string;
  salonId: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
}

export interface CorrectionInput {
  clockIn: string;
  clockOut: string | null;
  breaks: BreakPeriod[];
  reason: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertPlatform(actor: Actor): void {
  if (actor.role !== 'platform') throw new DomainError('FORBIDDEN_PLATFORM');
}

function assertSalonAccess(actor: Actor, salonId: string): void {
  if (actor.role === 'salon' && actor.salonId !== salonId) throw new DomainError('FORBIDDEN_SALON');
}

function requireSalon(data: AppData, salonId: string): Salon {
  const salon = data.salons.find((item) => item.id === salonId);
  if (!salon) throw new DomainError('NOT_FOUND');
  return salon;
}

function assertWritable(salon: Salon, today = stockholmToday()): void {
  if (!allowsOperations(effectiveStatus(salon, today))) throw new DomainError('SUBSCRIPTION_LOCKED');
}

function cleanText(value: string): string {
  return value.trim();
}

function validateIdentity(name: string, email: string): void {
  if (!cleanText(name)) throw new DomainError('NAME_REQUIRED');
  if (!EMAIL.test(cleanText(email))) throw new DomainError('EMAIL_INVALID');
}

function validateSalonInput(input: SalonInput): SalonInput {
  validateIdentity(input.name, input.contactEmail);
  if (!Number.isInteger(input.subscriptionPrice) || input.subscriptionPrice < 1) throw new DomainError('PRICE_INVALID');
  if (!isYmd(input.subscriptionStart) || !isYmd(input.subscriptionExpiry)) throw new DomainError('DATE_INVALID');
  if (input.subscriptionExpiry < input.subscriptionStart) throw new DomainError('DATE_ORDER');
  return {
    name: cleanText(input.name),
    contactEmail: cleanText(input.contactEmail),
    phone: cleanText(input.phone),
    address: cleanText(input.address),
    subscriptionPrice: input.subscriptionPrice,
    subscriptionStart: input.subscriptionStart,
    subscriptionExpiry: input.subscriptionExpiry,
  };
}

function validateProfile(input: SalonProfileInput): SalonProfileInput {
  validateIdentity(input.name, input.contactEmail);
  return {
    name: cleanText(input.name),
    contactEmail: cleanText(input.contactEmail),
    phone: cleanText(input.phone),
    address: cleanText(input.address),
  };
}

function replaceSalon(data: AppData, salon: Salon): AppData {
  return { ...data, salons: data.salons.map((item) => (item.id === salon.id ? salon : item)) };
}

function replaceAttendance(data: AppData, session: AttendanceSession): AppData {
  return { ...data, attendance: data.attendance.map((item) => (item.id === session.id ? session : item)) };
}

export function createSalon(data: AppData, actor: Actor, input: SalonInput, id: string): AppData {
  assertPlatform(actor);
  const clean = validateSalonInput(input);
  const salon: Salon = { id, ...clean, subscriptionStatus: 'active' };
  return { ...data, salons: [...data.salons, salon] };
}

export function updateSalon(data: AppData, actor: Actor, salonId: string, input: SalonInput): AppData {
  assertPlatform(actor);
  const current = requireSalon(data, salonId);
  const clean = validateSalonInput(input);
  return replaceSalon(data, { ...current, ...clean });
}

export function updateSalonProfile(data: AppData, actor: Actor, salonId: string, input: SalonProfileInput): AppData {
  assertSalonAccess(actor, salonId);
  const current = requireSalon(data, salonId);
  return replaceSalon(data, { ...current, ...validateProfile(input) });
}

export function activateSubscription(data: AppData, actor: Actor, salonId: string): AppData {
  assertPlatform(actor);
  const salon = requireSalon(data, salonId);
  return replaceSalon(data, { ...salon, subscriptionStatus: 'active' });
}

export function suspendSubscription(data: AppData, actor: Actor, salonId: string): AppData {
  assertPlatform(actor);
  const salon = requireSalon(data, salonId);
  return replaceSalon(data, { ...salon, subscriptionStatus: 'suspended' });
}

export function renewSubscription(data: AppData, actor: Actor, salonId: string, today = stockholmToday()): AppData {
  assertPlatform(actor);
  const salon = requireSalon(data, salonId);
  return replaceSalon(data, {
    ...salon,
    subscriptionStatus: 'active',
    subscriptionExpiry: renewedExpiry(salon.subscriptionExpiry, today),
  });
}

export function saveEmployee(data: AppData, actor: Actor, input: EmployeeInput, id: string): AppData {
  assertSalonAccess(actor, input.salonId);
  requireSalon(data, input.salonId);
  const firstName = cleanText(input.firstName);
  const lastName = cleanText(input.lastName);
  const jobTitle = cleanText(input.jobTitle);
  const email = cleanText(input.email);
  if (!firstName || !lastName) throw new DomainError('NAME_REQUIRED');
  if (!jobTitle) throw new DomainError('TITLE_REQUIRED');
  if (!EMAIL.test(email)) throw new DomainError('EMAIL_INVALID');
  if (input.id) {
    const current = data.employees.find((employee) => employee.id === input.id && employee.salonId === input.salonId);
    if (!current) throw new DomainError('NOT_FOUND');
    const next: Employee = { ...current, firstName, lastName, jobTitle, email, phone: cleanText(input.phone) };
    return { ...data, employees: data.employees.map((employee) => (employee.id === current.id ? next : employee)) };
  }
  const created: Employee = {
    id,
    salonId: input.salonId,
    firstName,
    lastName,
    jobTitle,
    email,
    phone: cleanText(input.phone),
    active: true,
  };
  return { ...data, employees: [...data.employees, created] };
}

export function setEmployeeActive(data: AppData, actor: Actor, employeeId: string, salonId: string, active: boolean): AppData {
  assertSalonAccess(actor, salonId);
  const current = data.employees.find((employee) => employee.id === employeeId && employee.salonId === salonId);
  if (!current) throw new DomainError('NOT_FOUND');
  return {
    ...data,
    employees: data.employees.map((employee) => (employee.id === current.id ? { ...employee, active } : employee)),
  };
}

export function saveShift(data: AppData, actor: Actor, input: ShiftInput, id: string): AppData {
  assertSalonAccess(actor, input.salonId);
  assertWritable(requireSalon(data, input.salonId));
  if (!input.employeeId) throw new DomainError('EMPLOYEE_REQUIRED');
  if (!isYmd(input.date)) throw new DomainError('DATE_INVALID');
  const startTime = normalizeHm(input.startTime);
  const endTime = normalizeHm(input.endTime);
  if (!startTime || !endTime) throw new DomainError('TIME_INVALID');
  if (startTime === endTime) throw new DomainError('TIME_SAME');
  const employee = data.employees.find((item) => item.id === input.employeeId && item.salonId === input.salonId);
  if (!employee) throw new DomainError('NOT_FOUND');
  if (input.id) {
    const current = data.shifts.find((shift) => shift.id === input.id && shift.salonId === input.salonId);
    if (!current) throw new DomainError('NOT_FOUND');
    if (!employee.active && employee.id !== current.employeeId) throw new DomainError('INACTIVE_EMPLOYEE');
    const next = {
      ...current,
      employeeId: employee.id,
      date: input.date,
      startTime,
      endTime,
      note: cleanText(input.note),
    };
    return { ...data, shifts: data.shifts.map((shift) => (shift.id === current.id ? next : shift)) };
  }
  if (!employee.active) throw new DomainError('INACTIVE_EMPLOYEE');
  return {
    ...data,
    shifts: [
      ...data.shifts,
      {
        id,
        salonId: input.salonId,
        employeeId: employee.id,
        date: input.date,
        startTime,
        endTime,
        note: cleanText(input.note),
      },
    ],
  };
}

export function deleteShift(data: AppData, actor: Actor, shiftId: string, salonId: string): AppData {
  assertSalonAccess(actor, salonId);
  assertWritable(requireSalon(data, salonId));
  const current = data.shifts.find((shift) => shift.id === shiftId && shift.salonId === salonId);
  if (!current) throw new DomainError('NOT_FOUND');
  return { ...data, shifts: data.shifts.filter((shift) => shift.id !== current.id) };
}

export function copyWeek(data: AppData, actor: Actor, salonId: string, weekStart: string, newId: () => string): { data: AppData; copied: number; removed: number } {
  assertSalonAccess(actor, salonId);
  assertWritable(requireSalon(data, salonId));
  const result = copyPreviousWeek(data.shifts, salonId, weekStart, newId);
  return { data: { ...data, shifts: result.shifts }, copied: result.copied, removed: result.removed };
}

function requireEmployee(data: AppData, salonId: string, employeeId: string): Employee {
  const employee = data.employees.find((item) => item.id === employeeId && item.salonId === salonId);
  if (!employee) throw new DomainError('NOT_FOUND');
  return employee;
}

function requireOpen(data: AppData, salonId: string, employeeId: string): AttendanceSession {
  const session = data.attendance.find((item) => item.salonId === salonId && item.employeeId === employeeId && item.clockOut === null);
  if (!session) throw new DomainError('NO_OPEN_SESSION');
  return session;
}

export function clockIn(data: AppData, actor: Actor, salonId: string, employeeId: string, at: string, id: string): AppData {
  assertSalonAccess(actor, salonId);
  assertWritable(requireSalon(data, salonId));
  const employee = requireEmployee(data, salonId, employeeId);
  if (!employee.active) throw new DomainError('INACTIVE_EMPLOYEE');
  const session = createClockIn(data.attendance, { id, salonId, employeeId, at });
  return { ...data, attendance: [...data.attendance, session] };
}

export function beginBreak(data: AppData, actor: Actor, salonId: string, employeeId: string, at: string, breakId: string): AppData {
  assertSalonAccess(actor, salonId);
  assertWritable(requireSalon(data, salonId));
  requireEmployee(data, salonId, employeeId);
  const session = requireOpen(data, salonId, employeeId);
  return replaceAttendance(data, startBreak(session, at, breakId));
}

export function finishBreak(data: AppData, actor: Actor, salonId: string, employeeId: string, at: string): AppData {
  assertSalonAccess(actor, salonId);
  assertWritable(requireSalon(data, salonId));
  requireEmployee(data, salonId, employeeId);
  const session = requireOpen(data, salonId, employeeId);
  return replaceAttendance(data, endBreak(session, at));
}

export function clockOutEmployee(data: AppData, actor: Actor, salonId: string, employeeId: string, at: string): AppData {
  assertSalonAccess(actor, salonId);
  assertWritable(requireSalon(data, salonId));
  requireEmployee(data, salonId, employeeId);
  const session = requireOpen(data, salonId, employeeId);
  return replaceAttendance(data, clockOut(session, at));
}

export function correctAttendance(data: AppData, actor: Actor, sessionId: string, input: CorrectionInput, meta: { id: string; at: string }): AppData {
  const session = data.attendance.find((item) => item.id === sessionId);
  if (!session) throw new DomainError('NOT_FOUND');
  assertSalonAccess(actor, session.salonId);
  assertWritable(requireSalon(data, session.salonId));
  const next = correctSession(
    session,
    { clockIn: input.clockIn, clockOut: input.clockOut, breaks: input.breaks },
    { id: meta.id, at: meta.at, actor: actor.displayName, reason: input.reason },
  );
  return replaceAttendance(data, next);
}

function requireTicket(data: AppData, ticketId: string): SupportTicket {
  const ticket = data.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw new DomainError('NOT_FOUND');
  return ticket;
}

function replaceTicket(data: AppData, ticket: SupportTicket): AppData {
  return { ...data, tickets: data.tickets.map((item) => (item.id === ticket.id ? ticket : item)) };
}

export function createSupportTicket(
  data: AppData,
  actor: Actor,
  input: { subject: string; category: string; message: string },
  at: string,
  ticketId: string,
  messageId: string,
): AppData {
  if (actor.role !== 'salon' || !actor.salonId) throw new DomainError('FORBIDDEN_SALON');
  requireSalon(data, actor.salonId);
  const ticket = buildTicket(actor, input, at, ticketId, messageId);
  return { ...data, tickets: [ticket, ...data.tickets] };
}

export function replySupportTicket(data: AppData, actor: Actor, ticketId: string, body: string, at: string, messageId: string): AppData {
  const ticket = requireTicket(data, ticketId);
  assertSalonAccess(actor, ticket.salonId);
  const message = createMessage(actor, body, at, messageId);
  return replaceTicket(data, replyOnTicket(ticket, message));
}

export function setSupportStatus(data: AppData, actor: Actor, ticketId: string, status: string): AppData {
  assertPlatform(actor);
  const ticket = requireTicket(data, ticketId);
  return replaceTicket(data, withStatus(ticket, status));
}

export function markSupportRead(data: AppData, actor: Actor, ticketId: string): AppData {
  const ticket = requireTicket(data, ticketId);
  assertSalonAccess(actor, ticket.salonId);
  return replaceTicket(data, markRead(ticket, actor.role));
}

export function saveSupportPhone(data: AppData, actor: Actor, input: string): AppData {
  assertPlatform(actor);
  const supportPhone = input.trim() ? normalizeSupportPhone(input) : null;
  return { ...data, supportPhone };
}
