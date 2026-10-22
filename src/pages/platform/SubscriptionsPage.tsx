import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useActor } from '../../auth/session';
import { Button, ConfirmDialog, EmptyState, PageHeader, useDocumentTitle, useSafeAction, useToast } from '../../components/ui';
import { useStore } from '../../data/store';
import { effectiveStatus, statusLabel } from '../../domain/subscription';
import { formatSek, formatSwedishDate, stockholmToday } from '../../domain/time';
import type { EffectiveStatus, Salon } from '../../domain/types';

type StatusFilter = 'all' | EffectiveStatus;

const filters: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Alla' },
  { id: 'active', label: 'Aktiv' },
  { id: 'expiring', label: 'Löper ut snart' },
  { id: 'expired', label: 'Utgången' },
  { id: 'suspended', label: 'Avstängd' },
];

export function SubscriptionsPage() {
  useDocumentTitle('Prenumerationer');
  const { data, activateSubscription, suspendSubscription, renewSubscription } = useStore();
  const actor = useActor();
  const run = useSafeAction();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [pending, setPending] = useState<Salon | null>(null);
  const today = stockholmToday();

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('sv');
    return data.salons
      .map((salon) => ({ salon, status: effectiveStatus(salon, today) }))
      .filter(({ status }) => (filter === 'all' ? true : status === filter))
      .filter(({ salon }) => !q || salon.name.toLocaleLowerCase('sv').includes(q) || salon.contactEmail.toLocaleLowerCase('sv').includes(q))
      .sort((a, b) => a.salon.subscriptionExpiry.localeCompare(b.salon.subscriptionExpiry));
  }, [data.salons, filter, query, today]);

  return (
    <div className="page">
      <PageHeader title="Prenumerationer" text="Aktivera, stäng av och förnya manuellt. Ingen betalning genomförs." />
      <div className="toolbar">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="sub-search">
            Sök prenumeration
          </label>
          <input id="sub-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sök namn eller e-post" />
        </div>
        <div className="field compact">
          <label htmlFor="sub-filter">Status</label>
          <select id="sub-filter" value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}>
            {filters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <section className="card">
        {rows.length === 0 ? (
          <EmptyState title="Inga prenumerationer" text="Ingen salong matchar sökningen eller filtret." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Prenumerationer</caption>
              <thead>
                <tr>
                  <th scope="col">Salong</th>
                  <th scope="col">Status</th>
                  <th scope="col">Pris</th>
                  <th scope="col">Start</th>
                  <th scope="col">Utgång</th>
                  <th scope="col">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ salon, status }) => (
                  <tr key={salon.id}>
                    <th scope="row">
                      {salon.name}
                      <span className="cell-sub">{salon.contactEmail}</span>
                    </th>
                    <td>
                      <span className={`badge badge-${status}`}>{statusLabel(status)}</span>
                    </td>
                    <td>{formatSek(salon.subscriptionPrice)}</td>
                    <td>{formatSwedishDate(salon.subscriptionStart)}</td>
                    <td>{formatSwedishDate(salon.subscriptionExpiry)}</td>
                    <td>
                      <div className="action-row">
                        <Button
                          variant="secondary"
                          disabled={salon.subscriptionStatus === 'active'}
                          onClick={() => {
                            const expired = salon.subscriptionExpiry < today;
                            const ok = run(() => activateSubscription(actor, salon.id));
                            if (!ok) return;
                            toast.success(
                              expired
                                ? 'Avstängningen hävdes, men utgångsdatumet har passerat. Förnya prenumerationen för att låsa upp salongen.'
                                : 'Prenumerationen aktiverades.',
                            );
                          }}
                        >
                          Aktivera
                        </Button>
                        <Button variant="danger" disabled={salon.subscriptionStatus === 'suspended'} onClick={() => setPending(salon)}>
                          Stäng av
                        </Button>
                        <Button
                          onClick={() => {
                            let expiry = '';
                            const ok = run(() => {
                              expiry = renewSubscription(actor, salon.id);
                            });
                            if (ok && expiry) toast.success(`Prenumerationen förnyades till ${formatSwedishDate(expiry, 'long')}.`);
                          }}
                        >
                          Förnya
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pending ? (
        <ConfirmDialog
          title="Stäng av prenumeration"
          body={`Stäng av prenumerationen för ${pending.name}? Salongen kan inte ändra schema eller stämpling förrän den aktiveras igen.`}
          confirmLabel="Stäng av"
          danger
          onClose={() => setPending(null)}
          onConfirm={() => {
            const salonId = pending.id;
            const ok = run(() => suspendSubscription(actor, salonId), 'Prenumerationen stängdes av.');
            if (ok) setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}
