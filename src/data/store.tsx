import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createId } from '../domain/ids';
import type { Actor, AppData } from '../domain/types';
import {
  activateSubscription,
  beginBreak,
  clockIn,
  clockOutEmployee,
  copyWeek,
  correctAttendance,
  createSalon,
  deleteShift,
  finishBreak,
  renewSubscription,
  saveEmployee,
  saveShift,
  setEmployeeActive,
  createSupportTicket,
  markSupportRead,
  replySupportTicket,
  saveSupportPhone,
  setSupportStatus,
  suspendSubscription,
  updateSalon,
  updateSalonProfile,
  type CorrectionInput,
  type EmployeeInput,
  type SalonInput,
  type SalonProfileInput,
  type ShiftInput,
} from './mutations';
import { createSeed } from './seed';
import { DATA_KEY, loadData, saveData } from './storage';

interface StoreValue {
  data: AppData;
  resetDemo: () => void;
  createSalon: (actor: Actor, input: SalonInput) => void;
  updateSalon: (actor: Actor, salonId: string, input: SalonInput) => void;
  updateSalonProfile: (actor: Actor, salonId: string, input: SalonProfileInput) => void;
  activateSubscription: (actor: Actor, salonId: string) => void;
  suspendSubscription: (actor: Actor, salonId: string) => void;
  renewSubscription: (actor: Actor, salonId: string) => string;
  saveEmployee: (actor: Actor, input: EmployeeInput) => void;
  setEmployeeActive: (actor: Actor, employeeId: string, salonId: string, active: boolean) => void;
  saveShift: (actor: Actor, input: ShiftInput) => void;
  deleteShift: (actor: Actor, shiftId: string, salonId: string) => void;
  copyWeek: (actor: Actor, salonId: string, weekStart: string) => { copied: number; removed: number };
  clockIn: (actor: Actor, salonId: string, employeeId: string) => void;
  startBreak: (actor: Actor, salonId: string, employeeId: string) => void;
  endBreak: (actor: Actor, salonId: string, employeeId: string) => void;
  clockOut: (actor: Actor, salonId: string, employeeId: string) => void;
  correctAttendance: (actor: Actor, sessionId: string, input: CorrectionInput) => void;
  createTicket: (actor: Actor, input: { subject: string; category: string; message: string }) => string;
  replyTicket: (actor: Actor, ticketId: string, body: string) => void;
  setTicketStatus: (actor: Actor, ticketId: string, status: string) => void;
  markTicketRead: (actor: Actor, ticketId: string) => void;
  setSupportPhone: (actor: Actor, phone: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DATA_KEY || !event.newValue) return;
      const next = loadData();
      dataRef.current = next;
      setData(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const commit = (mutator: (current: AppData) => AppData) => {
    const next = mutator(dataRef.current);
    dataRef.current = next;
    setData(next);
  };

  const value: StoreValue = {
    data,
    resetDemo: () => {
      const next = createSeed();
      dataRef.current = next;
      setData(next);
    },
    createSalon: (actor, input) => commit((current) => createSalon(current, actor, input, createId('salon'))),
    updateSalon: (actor, salonId, input) => commit((current) => updateSalon(current, actor, salonId, input)),
    updateSalonProfile: (actor, salonId, input) => commit((current) => updateSalonProfile(current, actor, salonId, input)),
    activateSubscription: (actor, salonId) => commit((current) => activateSubscription(current, actor, salonId)),
    suspendSubscription: (actor, salonId) => commit((current) => suspendSubscription(current, actor, salonId)),
    renewSubscription: (actor, salonId) => {
      commit((current) => renewSubscription(current, actor, salonId));
      return dataRef.current.salons.find((salon) => salon.id === salonId)?.subscriptionExpiry ?? '';
    },
    saveEmployee: (actor, input) => commit((current) => saveEmployee(current, actor, input, createId('emp'))),
    setEmployeeActive: (actor, employeeId, salonId, active) => commit((current) => setEmployeeActive(current, actor, employeeId, salonId, active)),
    saveShift: (actor, input) => commit((current) => saveShift(current, actor, input, createId('shift'))),
    deleteShift: (actor, shiftId, salonId) => commit((current) => deleteShift(current, actor, shiftId, salonId)),
    copyWeek: (actor, salonId, weekStart) => {
      let summary = { copied: 0, removed: 0 };
      commit((current) => {
        const result = copyWeek(current, actor, salonId, weekStart, () => createId('shift'));
        summary = { copied: result.copied, removed: result.removed };
        return result.data;
      });
      return summary;
    },
    clockIn: (actor, salonId, employeeId) => commit((current) => clockIn(current, actor, salonId, employeeId, new Date().toISOString(), createId('att'))),
    startBreak: (actor, salonId, employeeId) =>
      commit((current) => beginBreak(current, actor, salonId, employeeId, new Date().toISOString(), createId('brk'))),
    endBreak: (actor, salonId, employeeId) => commit((current) => finishBreak(current, actor, salonId, employeeId, new Date().toISOString())),
    clockOut: (actor, salonId, employeeId) => commit((current) => clockOutEmployee(current, actor, salonId, employeeId, new Date().toISOString())),
    correctAttendance: (actor, sessionId, input) =>
      commit((current) => correctAttendance(current, actor, sessionId, input, { id: createId('cor'), at: new Date().toISOString() })),
    createTicket: (actor, input) => {
      const id = createId('ticket');
      commit((current) => createSupportTicket(current, actor, input, new Date().toISOString(), id, createId('msg')));
      return id;
    },
    replyTicket: (actor, ticketId, body) => commit((current) => replySupportTicket(current, actor, ticketId, body, new Date().toISOString(), createId('msg'))),
    setTicketStatus: (actor, ticketId, status) => commit((current) => setSupportStatus(current, actor, ticketId, status)),
    markTicketRead: (actor, ticketId) => commit((current) => markSupportRead(current, actor, ticketId)),
    setSupportPhone: (actor, phone) => commit((current) => saveSupportPhone(current, actor, phone)),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('StoreProvider saknas.');
  return value;
}
