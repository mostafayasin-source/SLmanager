import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { AccountRole, Actor, DemoSession } from '../domain/types';
import { DEMO_SALON_ID } from '../data/seed';
import { loadSession, saveSession } from '../data/storage';

interface SessionValue {
  session: DemoSession | null;
  login: (role: AccountRole) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(() => loadSession());

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const value: SessionValue = {
    session,
    login: (role) => {
      setSession(
        role === 'platform'
          ? { role: 'platform', salonId: null, displayName: 'Demo plattformsägare' }
          : { role: 'salon', salonId: DEMO_SALON_ID, displayName: 'Demo salongsägare' },
      );
    },
    logout: () => setSession(null),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider saknas.');
  return value;
}

export function useActor(): Actor {
  const { session } = useSession();
  if (!session) throw new Error('Ingen demoläge-session.');
  return { role: session.role, salonId: session.salonId, displayName: session.displayName };
}

export function homePath(session: DemoSession | null): string {
  if (!session) return '/logga-in';
  return session.role === 'platform' ? '/plattform' : '/salong';
}

/** Demo-only route guard. Browser storage is not production authentication. */
export function RequireRole({ role }: { role: AccountRole }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/logga-in" replace />;
  if (session.role !== role) return <Navigate to={homePath(session)} replace />;
  return <Outlet />;
}
