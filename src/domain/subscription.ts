import type { EffectiveStatus, Salon } from './types';
import { addMonthsYmd, daysBetween } from './time';

export const EXPIRING_WINDOW_DAYS = 14;

export function effectiveStatus(salon: Pick<Salon, 'subscriptionStatus' | 'subscriptionExpiry'>, today: string): EffectiveStatus {
  if (salon.subscriptionStatus === 'suspended') return 'suspended';
  if (salon.subscriptionExpiry < today) return 'expired';
  if (daysBetween(today, salon.subscriptionExpiry) <= EXPIRING_WINDOW_DAYS) return 'expiring';
  return 'active';
}

export function allowsOperations(status: EffectiveStatus): boolean {
  return status === 'active' || status === 'expiring';
}

export function statusLabel(status: EffectiveStatus): string {
  switch (status) {
    case 'active':
      return 'Aktiv';
    case 'expiring':
      return 'Löper ut snart';
    case 'expired':
      return 'Utgången';
    case 'suspended':
      return 'Avstängd';
  }
}

export function renewedExpiry(currentExpiry: string, today: string): string {
  const base = currentExpiry > today ? currentExpiry : today;
  return addMonthsYmd(base, 1);
}

export function isActivePrice(status: EffectiveStatus): boolean {
  return status === 'active' || status === 'expiring';
}
