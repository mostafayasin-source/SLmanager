import { CalendarDays, ClipboardList, Clock, CreditCard, LayoutDashboard, LifeBuoy, LogOut, Menu, Settings, Store, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useSession } from '../auth/session';
import { allowsOperations, effectiveStatus } from '../domain/subscription';
import { formatSwedishDate, stockholmToday } from '../domain/time';
import type { EffectiveStatus, Salon } from '../domain/types';
import { useStore } from '../data/store';
import { countUnread } from '../domain/support';
import { AppShellNav, type NavItem } from './nav';
import { Button, useMediaQuery, Wordmark } from './ui';

export interface SalonContextValue {
  salon: Salon;
  status: EffectiveStatus;
  locked: boolean;
}

export function useSalonContext(): SalonContextValue {
  return useOutletContext<SalonContextValue>();
}

const platformNav: NavItem[] = [
  { to: '/plattform', label: 'Översikt', icon: LayoutDashboard, end: true },
  { to: '/plattform/salonger', label: 'Salonger', icon: Store },
  { to: '/plattform/prenumerationer', label: 'Prenumerationer', icon: CreditCard },
  { to: '/plattform/kundsupport', label: 'Kundsupport', icon: LifeBuoy },
  { to: '/plattform/installningar', label: 'Inställningar', icon: Settings },
];

const salonNav: NavItem[] = [
  { to: '/salong', label: 'Översikt', icon: LayoutDashboard, end: true },
  { to: '/salong/medarbetare', label: 'Medarbetare', icon: Users },
  { to: '/salong/schema', label: 'Veckoschema', icon: CalendarDays },
  { to: '/salong/stampla', label: 'Stämpla', icon: Clock },
  { to: '/salong/rapporter', label: 'Tidsrapporter', icon: ClipboardList },
  { to: '/salong/kundsupport', label: 'Kundsupport', icon: LifeBuoy },
  { to: '/salong/installningar', label: 'Inställningar', icon: Settings },
];

function Frame({
  items,
  navLabel,
  subtitle,
  banner,
  outlet,
}: {
  items: NavItem[];
  navLabel: string;
  subtitle?: string;
  banner?: ReactNode;
  outlet: ReactNode;
}) {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 860px)');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#innehall">
        Hoppa till innehåll
      </a>
      {isMobile && open ? <button type="button" className="backdrop" aria-label="Stäng menyn" onClick={() => setOpen(false)} /> : null}
      <header className="mobile-bar">
        <button type="button" className="icon-btn light" aria-label="Öppna meny" aria-expanded={open} aria-controls="sidomeny" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
        <Wordmark />
      </header>
      <aside id="sidomeny" className={open ? 'sidebar open' : 'sidebar'} inert={isMobile && !open ? true : undefined}>
        <div className="brand-block">
          <Wordmark />
          {subtitle ? <p className="salon-side-name">{subtitle}</p> : null}
          <p className="demo-note">Demoläge — inga riktiga konton</p>
        </div>
        <AppShellNav items={items} label={navLabel} onNavigate={() => setOpen(false)} />
        <div className="sidebar-foot">
          <p className="user-name">{session?.displayName}</p>
          <p className="user-role">{session?.role === 'platform' ? 'Plattformsägare' : 'Salongsägare'}</p>
          <button
            type="button"
            className="logout-btn"
            onClick={() => {
              logout();
              navigate('/logga-in');
            }}
          >
            <LogOut size={18} />
            Logga ut
          </button>
        </div>
      </aside>
      <div className="content">
        <main id="innehall" tabIndex={-1}>
          {banner}
          {outlet}
        </main>
      </div>
    </div>
  );
}

export function PlatformLayout() {
  const { data } = useStore();
  const unread = countUnread(data.tickets, 'platform');
  const items = platformNav.map((item) => (item.to === '/plattform/kundsupport' ? { ...item, badge: unread } : item));
  return <Frame items={items} navLabel="Plattform" outlet={<Outlet />} />;
}

export function SalonLayout() {
  const { session } = useSession();
  const { data, resetDemo } = useStore();
  const salon = data.salons.find((item) => item.id === session?.salonId);

  if (!salon) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Salongen saknas</h1>
          <p>Demodatan innehåller inte salongen för den här sessionen.</p>
          <Button onClick={() => resetDemo()}>Återställ demodata</Button>
        </div>
      </div>
    );
  }

  const status = effectiveStatus(salon, stockholmToday());
  const locked = !allowsOperations(status);
  const context: SalonContextValue = { salon, status, locked };
  const unread = countUnread(data.tickets, 'salon', salon.id);
  const items = salonNav.map((item) => (item.to === '/salong/kundsupport' ? { ...item, badge: unread } : item));

  return (
    <Frame
      items={items}
      navLabel="Salong"
      subtitle={salon.name}
      banner={<SubscriptionBanner salon={salon} status={status} />}
      outlet={<Outlet context={context} />}
    />
  );
}

function SubscriptionBanner({ salon, status }: { salon: Salon; status: EffectiveStatus }) {
  if (status === 'active') return null;
  const date = formatSwedishDate(salon.subscriptionExpiry, 'long');
  if (status === 'expiring') {
    return (
      <div className="banner banner-info" role="status">
        Prenumerationen löper ut {date}. Schema och stämpling fungerar fram till dess.
      </div>
    );
  }
  const text =
    status === 'suspended'
      ? 'Prenumerationen är avstängd. Schema och stämpling är låsta. Kundsupport och historiska tidsrapporter är fortfarande tillgängliga.'
      : `Prenumerationen gick ut ${date}. Schema och stämpling är låsta. Kundsupport och historiska tidsrapporter är fortfarande tillgängliga.`;
  return (
    <div className="banner banner-danger" role="alert">
      {text}
    </div>
  );
}
