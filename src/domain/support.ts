import { DomainError } from './errors';
import type { AccountRole, Actor, SupportCategory, SupportMessage, SupportStatus, SupportTicket } from './types';

export const SUPPORT_CATEGORIES: SupportCategory[] = ['account', 'subscription', 'technical', 'other'];
export const SUPPORT_STATUSES: SupportStatus[] = ['open', 'in_progress', 'resolved'];

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  account: 'Konto',
  subscription: 'Prenumeration',
  technical: 'Tekniskt problem',
  other: 'Övrigt',
};

const STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Öppen',
  in_progress: 'Pågår',
  resolved: 'Löst',
};

export function supportCategoryLabel(category: SupportCategory): string {
  return CATEGORY_LABELS[category];
}

export function supportStatusLabel(status: SupportStatus): string {
  return STATUS_LABELS[status];
}

export function supportRoleLabel(role: AccountRole): string {
  return role === 'platform' ? 'Plattformsägare' : 'Salongsägare';
}

export function isSupportCategory(value: string): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((category) => category === value);
}

export function isSupportStatus(value: string): value is SupportStatus {
  return SUPPORT_STATUSES.some((status) => status === value);
}

export function unreadCount(ticket: SupportTicket, role: AccountRole): number {
  return ticket.messages.filter((message) => (role === 'salon' ? message.authorRole === 'platform' && !message.readBySalon : message.authorRole === 'salon' && !message.readByPlatform)).length;
}

export function countUnread(tickets: SupportTicket[], role: AccountRole, salonId?: string | null): number {
  return tickets.filter((ticket) => !salonId || ticket.salonId === salonId).reduce((sum, ticket) => sum + unreadCount(ticket, role), 0);
}

export function countOpenTickets(tickets: SupportTicket[]): number {
  return tickets.filter((ticket) => ticket.status === 'open').length;
}

function requireText(value: string, code: string): string {
  const text = value.trim();
  if (!text) throw new DomainError(code);
  return text;
}

export function createMessage(actor: Actor, body: string, at: string, id: string): SupportMessage {
  return {
    id,
    authorRole: actor.role,
    authorName: actor.displayName,
    body: requireText(body, 'MESSAGE_REQUIRED'),
    at,
    readBySalon: actor.role === 'salon',
    readByPlatform: actor.role === 'platform',
  };
}

export function buildTicket(actor: Actor, input: { subject: string; category: string; message: string }, at: string, ticketId: string, messageId: string): SupportTicket {
  if (!actor.salonId) throw new DomainError('FORBIDDEN_SALON');
  if (!isSupportCategory(input.category)) throw new DomainError('CATEGORY_REQUIRED');
  const message = createMessage(actor, input.message, at, messageId);
  return {
    id: ticketId,
    salonId: actor.salonId,
    subject: requireText(input.subject, 'SUBJECT_REQUIRED'),
    category: input.category,
    status: 'open',
    createdAt: at,
    updatedAt: at,
    messages: [message],
  };
}

export function replyOnTicket(ticket: SupportTicket, message: SupportMessage): SupportTicket {
  const reopen = ticket.status === 'resolved' && message.authorRole === 'salon';
  return {
    ...ticket,
    status: reopen ? 'open' : ticket.status,
    updatedAt: message.at,
    messages: [...ticket.messages, message],
  };
}

export function withStatus(ticket: SupportTicket, status: string): SupportTicket {
  if (!isSupportStatus(status)) throw new DomainError('STATUS_INVALID');
  return { ...ticket, status, updatedAt: ticket.updatedAt };
}

export function markRead(ticket: SupportTicket, role: AccountRole): SupportTicket {
  const key = role === 'salon' ? 'readBySalon' : 'readByPlatform';
  if (ticket.messages.every((message) => message[key])) return ticket;
  return {
    ...ticket,
    messages: ticket.messages.map((message) => ({ ...message, [key]: true })),
  };
}
