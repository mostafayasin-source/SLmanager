import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useActor } from '../auth/session';
import { useStore } from '../data/store';
import { formatSupportPhone, supportPhoneHref } from '../domain/phone';
import { supportCategoryLabel, supportRoleLabel, supportStatusLabel, unreadCount } from '../domain/support';
import { formatSwedishDateTime } from '../domain/time';
import type { AccountRole, SupportTicket } from '../domain/types';
import { Button, describedBy, Field } from './ui';

export function SupportPhoneCard({ phone }: { phone: string | null }) {
  return (
    <section className="card phone-card" aria-labelledby="ring-oss">
      <div className="phone-card-body">
        <div>
          <h2 id="ring-oss">Ring oss</h2>
          {phone ? (
            <>
              <p className="phone-example">
                <a href={supportPhoneHref(phone)}>{formatSupportPhone(phone)}</a>
              </p>
              <p className="muted">Numret är klickbart och använder internationellt format.</p>
            </>
          ) : (
            <>
              <p className="phone-example">+46 XX XXX XX XX</p>
              <p id="phone-example-label">Exempelnummer — uppdateras snart</p>
              <p id="phone-soon" className="muted">
                Telefonnummer kommer snart
              </p>
            </>
          )}
        </div>
        {phone ? (
          <a className="btn btn-primary" href={supportPhoneHref(phone)}>
            Ring
          </a>
        ) : (
          <Button disabled aria-describedby="phone-example-label phone-soon">
            Ring
          </Button>
        )}
      </div>
    </section>
  );
}

export function TicketList({
  tickets,
  salonName,
  selectedId,
  role,
  onSelect,
}: {
  tickets: SupportTicket[];
  salonName: (salonId: string) => string;
  selectedId: string | null;
  role: AccountRole;
  onSelect: (id: string) => void;
}) {
  if (tickets.length === 0) return null;
  return (
    <ul className="ticket-list">
      {tickets.map((ticket) => {
        const unread = unreadCount(ticket, role);
        const selected = ticket.id === selectedId;
        return (
          <li key={ticket.id}>
            <button type="button" className={selected ? 'ticket-btn on' : 'ticket-btn'} aria-current={selected ? 'true' : undefined} onClick={() => onSelect(ticket.id)}>
              <span className="ticket-title">{ticket.subject}</span>
              <span className="ticket-meta">
                <span>{salonName(ticket.salonId)}</span>
                <span>{supportCategoryLabel(ticket.category)}</span>
                <span className={`badge badge-${ticket.status}`}>{supportStatusLabel(ticket.status)}</span>
                {unread > 0 ? <span className="unread-pill">{unread === 1 ? '1 oläst' : `${unread} olästa`}</span> : null}
              </span>
              <time dateTime={ticket.updatedAt}>{formatSwedishDateTime(ticket.updatedAt)}</time>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function TicketConversation({
  ticket,
  role,
  statusControl,
}: {
  ticket: SupportTicket;
  role: AccountRole;
  statusControl?: ReactNode;
}) {
  const actor = useActor();
  const { markTicketRead, replyTicket } = useStore();
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const unread = unreadCount(ticket, role);

  useEffect(() => {
    if (unread === 0) return;
    markTicketRead(actor, ticket.id);
  }, [actor, markTicketRead, ticket.id, unread]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) {
      setError('Skriv ett meddelande.');
      return;
    }
    setError('');
    replyTicket(actor, ticket.id, reply);
    setReply('');
  };

  return (
    <div>
      <div className="thread-head">
        <div>
          <h2>{ticket.subject}</h2>
          <p className="muted">
            {supportCategoryLabel(ticket.category)} · <span className={`badge badge-${ticket.status}`}>{supportStatusLabel(ticket.status)}</span>
          </p>
        </div>
        {statusControl}
      </div>
      {ticket.status === 'resolved' && role === 'salon' ? <p className="hint">Ett nytt svar från salongen öppnar ärendet igen.</p> : null}
      <div className="thread" role="log" aria-live="polite" aria-relevant="additions" aria-label="Konversation">
        {ticket.messages.map((message) => (
          <article key={message.id} className={`bubble ${message.authorRole}`}>
            <header>
              <span>
                {message.authorName}
                <span className="cell-sub">{supportRoleLabel(message.authorRole)}</span>
              </span>
              <time dateTime={message.at}>{formatSwedishDateTime(message.at)}</time>
            </header>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      <form className="reply-form" onSubmit={send}>
        <Field id={`reply-${ticket.id}`} label="Svar" error={error}>
          <textarea id={`reply-${ticket.id}`} rows={4} value={reply} aria-describedby={describedBy(`reply-${ticket.id}`, error)} onChange={(event) => setReply(event.target.value)} />
        </Field>
        <Button type="submit">Skicka svar</Button>
      </form>
    </div>
  );
}

export function sortTickets(tickets: SupportTicket[]): SupportTicket[] {
  return [...tickets].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
