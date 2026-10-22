import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

export function AppShellNav({ items, label, onNavigate }: { items: NavItem[]; label: string; onNavigate?: () => void }) {
  return (
    <nav className="side-nav" aria-label={label}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={onNavigate}>
          <item.icon size={18} aria-hidden="true" />
          <span>{item.label}</span>
          {item.badge ? (
            <span className="nav-badge">
              {item.badge}
              <span className="sr-only">{item.badge === 1 ? ' oläst' : ' olästa'}</span>
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
