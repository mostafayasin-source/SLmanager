import { useMemo, useState, type FormEvent } from 'react';
import { SupportPhoneCard, TicketConversation, TicketList, sortTickets } from '../../components/support';
import { Button, Dialog, EmptyState, Field, PageHeader, describedBy, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useSalonContext } from '../../components/Layout';
import { useActor } from '../../auth/session';
import { useStore } from '../../data/store';
import { SUPPORT_CATEGORIES, countUnread, supportCategoryLabel } from '../../domain/support';

export function SalonSupportPage() {
  useDocumentTitle('Kundsupport');
  const { salon } = useSalonContext();
  const actor = useActor();
  const { data, createTicket } = useStore();
  const run = useSafeAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ subject?: string; category?: string; message?: string }>({});

  const tickets = useMemo(() => sortTickets(data.tickets.filter((ticket) => ticket.salonId === salon.id)), [data.tickets, salon.id]);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const unread = countUnread(tickets, 'salon');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = {
      subject: subject.trim() ? undefined : 'Ange ett ämne.',
      category: category ? undefined : 'Välj en kategori.',
      message: message.trim() ? undefined : 'Skriv ett meddelande.',
    };
    setErrors(next);
    if (next.subject || next.category || next.message) return;
    const ok = run(() => {
      const id = createTicket(actor, { subject, category, message });
      setSelectedId(id);
    }, 'Ärendet skapades.');
    if (!ok) return;
    setCreating(false);
    setSubject('');
    setCategory('');
    setMessage('');
  };

  return (
    <div className="page">
      <PageHeader title="Kundsupport" text="Frågor om konto, prenumeration och tekniska problem för den här salongen.">
        <Button onClick={() => setCreating(true)}>Nytt ärende</Button>
      </PageHeader>
      <p className="hint">Meddelanden sparas lokalt i den här demon, i webbläsarens lagring.</p>
      <div className="support-layout">
        <SupportPhoneCard phone={data.supportPhone} />
        <section className="card" aria-labelledby="mina-arenden">
          <div className="card-head">
            <h2 id="mina-arenden">Ärenden</h2>
            <p className="muted">Olästa svar från plattformen: {unread}</p>
          </div>
          {tickets.length === 0 ? (
            <EmptyState title="Inga ärenden" text="Skapa ett ärende om du behöver hjälp med salongen." />
          ) : (
            <TicketList tickets={tickets} salonName={() => salon.name} selectedId={selectedId} role="salon" onSelect={setSelectedId} />
          )}
        </section>
        <section className="card" aria-label="Konversation">
          {selected ? (
            <TicketConversation ticket={selected} role="salon" />
          ) : (
            <EmptyState title="Inget ärende valt" text="Välj ett ärende för att läsa konversationen och svara." />
          )}
        </section>
      </div>
      {creating ? (
        <Dialog title="Nytt ärende" onClose={() => setCreating(false)}>
          <form className="stack" onSubmit={submit}>
            <Field id="ticket-subject" label="Ämne" error={errors.subject}>
              <input id="ticket-subject" value={subject} data-autofocus aria-describedby={describedBy('ticket-subject', errors.subject)} onChange={(event) => setSubject(event.target.value)} />
            </Field>
            <Field id="ticket-category" label="Kategori" error={errors.category}>
              <select id="ticket-category" value={category} aria-describedby={describedBy('ticket-category', errors.category)} onChange={(event) => setCategory(event.target.value)}>
                <option value="">Välj kategori</option>
                {SUPPORT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {supportCategoryLabel(item)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ticket-message" label="Meddelande" error={errors.message}>
              <textarea id="ticket-message" rows={5} value={message} aria-describedby={describedBy('ticket-message', errors.message)} onChange={(event) => setMessage(event.target.value)} />
            </Field>
            <div className="action-row">
              <Button type="submit">Skicka ärende</Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                Avbryt
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
