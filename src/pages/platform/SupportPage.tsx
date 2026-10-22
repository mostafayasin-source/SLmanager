import { useMemo, useState } from 'react';
import { TicketConversation, TicketList, sortTickets } from '../../components/support';
import { EmptyState, OptionalField, PageHeader, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useActor } from '../../auth/session';
import { useStore } from '../../data/store';
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, countUnread, isSupportStatus, supportCategoryLabel, supportStatusLabel } from '../../domain/support';

export function PlatformSupportPage() {
  useDocumentTitle('Kundsupport');
  const actor = useActor();
  const { data, setTicketStatus } = useStore();
  const run = useSafeAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [salonId, setSalonId] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');

  const salonName = (id: string) => data.salons.find((salon) => salon.id === id)?.name ?? 'Okänd salong';
  const tickets = useMemo(() => {
    const text = query.trim().toLowerCase();
    return sortTickets(
      data.tickets.filter((ticket) => {
        if (salonId !== 'all' && ticket.salonId !== salonId) return false;
        if (category !== 'all' && ticket.category !== category) return false;
        if (status !== 'all' && ticket.status !== status) return false;
        if (!text) return true;
        const haystack = `${ticket.subject} ${salonName(ticket.salonId)}`.toLowerCase();
        return haystack.includes(text);
      }),
    );
  }, [category, data.salons, data.tickets, query, salonId, status]);
  const selected = data.tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const unread = countUnread(data.tickets, 'platform');

  return (
    <div className="page">
      <PageHeader title="Kundsupport" text="Ärenden från alla salonger. Svar och status sparas lokalt i den här demon." />
      <p className="hint">Meddelanden sparas lokalt i den här demon, i webbläsarens lagring.</p>
      <p className="hint">Olästa meddelanden från salonger: {unread}</p>
      <div className="toolbar" role="search">
        <OptionalField id="support-search" label="Sök">
          <input id="support-search" className="search" value={query} placeholder="Ämne eller salong" onChange={(event) => setQuery(event.target.value)} />
        </OptionalField>
        <OptionalField id="support-salon" label="Salong">
          <select id="support-salon" value={salonId} onChange={(event) => setSalonId(event.target.value)}>
            <option value="all">Alla salonger</option>
            {data.salons.map((salon) => (
              <option key={salon.id} value={salon.id}>
                {salon.name}
              </option>
            ))}
          </select>
        </OptionalField>
        <OptionalField id="support-category" label="Kategori">
          <select id="support-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Alla kategorier</option>
            {SUPPORT_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {supportCategoryLabel(item)}
              </option>
            ))}
          </select>
        </OptionalField>
        <OptionalField id="support-status" label="Status">
          <select id="support-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Alla statusar</option>
            {SUPPORT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {supportStatusLabel(item)}
              </option>
            ))}
          </select>
        </OptionalField>
      </div>
      <div className="support-layout support-inbox">
        <section className="card" aria-labelledby="alla-arenden">
          <div className="card-head">
            <h2 id="alla-arenden">Ärenden</h2>
          </div>
          {tickets.length === 0 ? (
            <EmptyState title="Inga ärenden" text="Inget ärende matchar sökningen eller filtren." />
          ) : (
            <TicketList tickets={tickets} salonName={salonName} selectedId={selectedId} role="platform" onSelect={setSelectedId} />
          )}
        </section>
        <section className="card" aria-label="Konversation">
          {selected ? (
            <TicketConversation
              ticket={selected}
              role="platform"
              statusControl={
                <OptionalField id="ticket-status" label="Status">
                  <select
                    id="ticket-status"
                    value={selected.status}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (!isSupportStatus(next)) return;
                      run(() => setTicketStatus(actor, selected.id, next), `Status ändrades till ${supportStatusLabel(next)}.`);
                    }}
                  >
                    {SUPPORT_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {supportStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </OptionalField>
              }
            />
          ) : (
            <EmptyState title="Inget ärende valt" text="Välj ett ärende för att läsa, svara och ändra status." />
          )}
        </section>
      </div>
    </div>
  );
}
