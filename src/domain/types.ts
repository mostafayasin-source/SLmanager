export const DATA_VERSION = 1 as const;

export type AccountRole = 'platform' | 'salon';

export type StoredSubscriptionStatus = 'active' | 'suspended';

export type EffectiveStatus = 'active' | 'expiring' | 'expired' | 'suspended';

export interface Salon {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  address: string;
  subscriptionPrice: number;
  subscriptionStart: string;
  subscriptionExpiry: string;
  subscriptionStatus: StoredSubscriptionStatus;
}

export interface Employee {
  id: string;
  salonId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  active: boolean;
}

export interface Shift {
  id: string;
  salonId: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
}

export interface BreakPeriod {
  id: string;
  start: string;
  end: string | null;
}

export interface SessionSnapshot {
  clockIn: string;
  clockOut: string | null;
  breaks: Array<{ start: string; end: string | null }>;
}

export interface AttendanceCorrection {
  id: string;
  at: string;
  actor: string;
  reason: string;
  before: SessionSnapshot;
  after: SessionSnapshot;
}

export interface AttendanceSession {
  id: string;
  salonId: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  breaks: BreakPeriod[];
  corrections: AttendanceCorrection[];
}

export type SupportCategory = 'account' | 'subscription' | 'technical' | 'other';

export type SupportStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportMessage {
  id: string;
  authorRole: AccountRole;
  authorName: string;
  body: string;
  at: string;
  readBySalon: boolean;
  readByPlatform: boolean;
}

export interface SupportTicket {
  id: string;
  salonId: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

export interface AppData {
  version: typeof DATA_VERSION;
  salons: Salon[];
  employees: Employee[];
  shifts: Shift[];
  attendance: AttendanceSession[];
  tickets: SupportTicket[];
  supportPhone: string | null;
}

export interface DemoSession {
  role: AccountRole;
  salonId: string | null;
  displayName: string;
}

export interface Actor {
  role: AccountRole;
  salonId: string | null;
  displayName: string;
}

export function employeeName(employee: Pick<Employee, 'firstName' | 'lastName'>): string {
  return `${employee.firstName} ${employee.lastName}`;
}
