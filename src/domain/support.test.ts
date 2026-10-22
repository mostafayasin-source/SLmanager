import { describe, expect, it } from 'vitest';
import { createSupportTicket, markSupportRead, replySupportTicket, saveSupportPhone, setSupportStatus } from '../data/mutations';
import { DEMO_SALON_ID, createSeed } from '../data/seed';
import { DomainError } from './errors';
import { formatSupportPhone, normalizeSupportPhone, supportPhoneHref } from './phone';
import { countOpenTickets, countUnread } from './support';
import type { Actor, AppData } from './types';

function thrownCode(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
  }
  return '';
}

const salon = (salonId: string): Actor => ({ role: 'salon', salonId, displayName: 'Demo salongsägare' });
const platform: Actor = { role: 'platform', salonId: null, displayName: 'Demo plattformsägare' };

describe('customer support', () => {
  it('seeds fictional tickets and no support phone number', () => {
    const data = createSeed();
    expect(data.supportPhone).toBeNull();
    expect(data.tickets.map((ticket) => ticket.salonId).sort()).toEqual(['salon_malmo', 'salon_soder', DEMO_SALON_ID, DEMO_SALON_ID].sort());
    expect(countOpenTickets(data.tickets)).toBe(2);
    expect(countUnread(data.tickets, 'platform')).toBe(2);
    expect(countUnread(data.tickets, 'salon', DEMO_SALON_ID)).toBe(1);
  });

  it('creates a ticket for a suspended salon and rejects another salon', () => {
    const data = createSeed();
    const next = createSupportTicket(
      data,
      salon('salon_malmo'),
      { subject: 'Kontot går inte att öppna', category: 'account', message: 'Vi kommer inte in efter avstängningen.' },
      '2026-10-22T08:00:00.000Z',
      'ticket_new',
      'msg_new',
    );
    const created = next.tickets[0];
    expect(created).toMatchObject({
      salonId: 'salon_malmo',
      status: 'open',
      category: 'account',
      subject: 'Kontot går inte att öppna',
    });
    expect(created.messages[0]).toMatchObject({ authorRole: 'salon', readBySalon: true, readByPlatform: false });
    expect(thrownCode(() => replySupportTicket(next, salon(DEMO_SALON_ID), 'ticket_new', 'Fel salong', '2026-10-22T09:00:00.000Z', 'msg_bad'))).toBe('FORBIDDEN_SALON');
    expect(thrownCode(() => createSupportTicket(data, salon('salon_malmo'), { subject: ' ', category: 'account', message: 'Hej' }, '2026-10-22T08:00:00.000Z', 'x', 'y'))).toBe('SUBJECT_REQUIRED');
    expect(thrownCode(() => createSupportTicket(data, platform, { subject: 'Hej', category: 'other', message: 'Hej' }, '2026-10-22T08:00:00.000Z', 'x', 'y'))).toBe('FORBIDDEN_SALON');
  });

  it('tracks unread messages per role and reopens a resolved ticket on a salon reply', () => {
    const data = createSeed();
    const readBySalon = markSupportRead(data, salon(DEMO_SALON_ID), 'ticket_vasa_pren');
    const pren = readBySalon.tickets.find((ticket) => ticket.id === 'ticket_vasa_pren');
    expect(pren?.messages.every((message) => message.readBySalon)).toBe(true);
    expect(pren?.messages.some((message) => message.readByPlatform)).toBe(true);
    expect(countUnread(readBySalon.tickets, 'salon', DEMO_SALON_ID)).toBe(0);
    expect(countUnread(readBySalon.tickets, 'platform')).toBe(2);

    const readByPlatform = markSupportRead(data, platform, 'ticket_malmo_ovrigt');
    const malmo = readByPlatform.tickets.find((ticket) => ticket.id === 'ticket_malmo_ovrigt');
    expect(malmo?.messages.every((message) => message.readByPlatform)).toBe(true);
    expect(countUnread(readByPlatform.tickets, 'salon', 'salon_malmo')).toBe(0);

    const reopened = replySupportTicket(data, salon('salon_soder'), 'ticket_soder_konto', 'Adressen stämmer fortfarande inte.', '2026-10-22T10:00:00.000Z', 'msg_reopen');
    const soder = reopened.tickets.find((ticket) => ticket.id === 'ticket_soder_konto');
    expect(soder?.status).toBe('open');
    expect(soder?.messages.at(-1)).toMatchObject({ authorRole: 'salon', readBySalon: true, readByPlatform: false });

    const stillResolved = replySupportTicket(reopened, platform, 'ticket_soder_konto', 'Vi tittar igen.', '2026-10-22T11:00:00.000Z', 'msg_platform');
    expect(stillResolved.tickets.find((ticket) => ticket.id === 'ticket_soder_konto')?.status).toBe('open');
    const resolved = setSupportStatus(stillResolved, platform, 'ticket_soder_konto', 'resolved');
    expect(resolved.tickets.find((ticket) => ticket.id === 'ticket_soder_konto')?.status).toBe('resolved');
    const platformReply = replySupportTicket(resolved, platform, 'ticket_soder_konto', 'Klart från oss.', '2026-10-22T12:00:00.000Z', 'msg_keep');
    expect(platformReply.tickets.find((ticket) => ticket.id === 'ticket_soder_konto')?.status).toBe('resolved');
    expect(thrownCode(() => setSupportStatus(data, salon(DEMO_SALON_ID), 'ticket_vasa_pren', 'resolved'))).toBe('FORBIDDEN_PLATFORM');
  });

  it('formats a configured support number and leaves the placeholder unset', () => {
    expect(normalizeSupportPhone('070 123 45 67')).toBe('+46701234567');
    expect(formatSupportPhone('+46701234567')).toBe('+46 70 123 45 67');
    expect(supportPhoneHref('+46701234567')).toBe('tel:+46701234567');
    expect(normalizeSupportPhone('+46 (0) 70-123 45 67')).toBe('+46701234567');
    expect(thrownCode(() => normalizeSupportPhone('inte ett nummer'))).toBe('PHONE_INVALID');

    const data = createSeed();
    const saved = saveSupportPhone(data, platform, '0046 70 123 45 67');
    expect(saved.supportPhone).toBe('+46701234567');
    expect(saveSupportPhone(saved, platform, '  ').supportPhone).toBeNull();
    expect(thrownCode(() => saveSupportPhone(data, salon(DEMO_SALON_ID), '+46701234567'))).toBe('FORBIDDEN_PLATFORM');
    expect(data.tickets).toEqual(saved.tickets satisfies AppData['tickets']);
  });
});
