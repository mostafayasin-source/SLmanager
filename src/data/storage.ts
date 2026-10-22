import type { AppData, DemoSession, SupportTicket } from '../domain/types';
import { DEMO_SALON_ID, createSeed } from './seed';

export const DATA_KEY = 'slmanager.data.v1';
export const SESSION_KEY = 'slmanager.session.v1';

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const data = value as AppData;
  return data.version === 1 && Array.isArray(data.salons) && Array.isArray(data.employees) && Array.isArray(data.shifts) && Array.isArray(data.attendance);
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return createSeed();
    const parsed: unknown = JSON.parse(raw);
    if (!isAppData(parsed)) return createSeed();
    return ensureSupport(parsed);
  } catch {
    return createSeed();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function ensureSupport(data: AppData): AppData {
  const record = data as AppData & { tickets?: unknown; supportPhone?: unknown };
  const tickets = Array.isArray(record.tickets) ? (record.tickets as SupportTicket[]) : createSeed().tickets;
  const supportPhone = typeof record.supportPhone === 'string' && record.supportPhone.trim() ? record.supportPhone : null;
  return { ...data, tickets, supportPhone };
}

function isSession(value: unknown): value is DemoSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as DemoSession;
  return (session.role === 'platform' || session.role === 'salon') && typeof session.displayName === 'string';
}

export function loadSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) return null;
    if (parsed.role === 'platform') return { role: 'platform', salonId: null, displayName: 'Demo plattformsägare' };
    return { role: 'salon', salonId: DEMO_SALON_ID, displayName: 'Demo salongsägare' };
  } catch {
    return null;
  }
}

export function saveSession(session: DemoSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
