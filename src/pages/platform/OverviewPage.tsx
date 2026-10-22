import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog, EmptyState, PageHeader, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useStore } from '../../data/store';
import { countOpenTickets, countUnread } from '../../domain/support';
import { effectiveStatus, isActivePrice, statusLabel } from '../../domain/subscription';
import { formatSek, formatSwedishDate, stockholmToday } from '../../domain/time';

export function PlatformOverviewPage() {
  useDocumentTitle('Översikt');
  const { data, resetDemo } = useStore();
  const run = useSafeAction();
  const [confirmReset, setConfirmReset] = useState(false);
  const today = stockholmToday();
  const rows = data.salons.map((salon) => ({ salon, status: effectiveStatus(salon, today) }));
  const activeCount = rows.filter((row) => isActivePrice(row.status)).length;
  const expiringCount = rows.filter((row) => row.status === 'expiring').length;
  const monthly = rows.reduce((sum, row) => (isActivePrice(row.status) ? sum + row.salon.subscriptionPrice : sum), 0);
  const openTickets = countOpenTickets(data.tickets);
  const unreadTickets = countUnread(data.tickets, 'platform');

  return (
    <div className="page">
      <PageHeader title="Översikt" text="Alla salonger och deras prenumerationsstatus. Beloppen är prisuppgifter, inte betalningar." />
      <section className="stat-grid" aria-label="Nyckeltal">
        <article className="stat-card">
          <p className="stat-label">Salonger totalt</p>
          <p className="stat-value">{data.salons.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Aktiva prenumerationer</p>
          <p className="stat-value">{activeCount}</p>
          <p className="stat-hint">Inkluderar de som löper ut snart.</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Löper ut snart</p>
          <p className="stat-value">{expiringCount}</p>
          <p className="stat-hint">Inom 14 dagar.</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Beräknad månadssumma</p>
          <p className="stat-value">{formatSek(monthly)}</p>
          <p className="stat-hint">Summa av månadspriserna för aktiva prenumerationer. Detta är inte inkasserad intäkt.</p>
        </article>
        <Link className="stat-card stat-link" to="/plattform/kundsupport">
          <p className="stat-label">Öppna supportärenden</p>
          <p className="stat-value">{openTickets}</p>
          <p className="stat-hint">
            Status Öppen, alla salonger.
            {unreadTickets > 0 ? ` ${unreadTickets} olästa meddelanden från salonger.` : ''}
          </p>
        </Link>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Salonger</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Inga salonger" text="Skapa en salong under Salonger." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Salonger och prenumerationsstatus</caption>
              <thead>
                <tr>
                  <th scope="col">Salong</th>
                  <th scope="col">E-post</th>
                  <th scope="col">Pris</th>
                  <th scope="col">Start</th>
                  <th scope="col">Utgång</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ salon, status }) => (
                  <tr key={salon.id}>
                    <th scope="row">{salon.name}</th>
                    <td>{salon.contactEmail}</td>
                    <td>{formatSek(salon.subscriptionPrice)}</td>
                    <td>{formatSwedishDate(salon.subscriptionStart)}</td>
                    <td>{formatSwedishDate(salon.subscriptionExpiry)}</td>
                    <td>
                      <span className={`badge badge-${status}`}>{statusLabel(status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Demodata</h2>
        </div>
        <p className="muted">Återställningen skapar nya exempeluppgifter för innevarande vecka och tar bort ändringar i den här webbläsaren.</p>
        <ButtonReset onClick={() => setConfirmReset(true)} />
        {confirmReset ? (
          <ConfirmDialog
            title="Återställ demodata"
            body="Alla ändringar i den här webbläsaren ersätts med nya exempeluppgifter. Din demoroll behålls."
            confirmLabel="Återställ"
            danger
            onClose={() => setConfirmReset(false)}
            onConfirm={() => {
              const ok = run(() => resetDemo(), 'Demodata återställdes.');
              if (ok) setConfirmReset(false);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function ButtonReset({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-danger" onClick={onClick}>
      Återställ demodata
    </button>
  );
}
