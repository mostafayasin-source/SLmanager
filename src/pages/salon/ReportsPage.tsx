import { useState } from 'react';
import { useSalonContext } from '../../components/Layout';
import { Button, EmptyState, PageHeader, useDocumentTitle } from '../../components/ui';
import { useStore } from '../../data/store';
import { buildTimeReport } from '../../domain/reports';
import { addDaysYmd, formatHours, isYmd, mondayOf, stockholmToday } from '../../domain/time';

function formatDiff(ms: number): string {
  if (ms === 0) return formatHours(0);
  const sign = ms > 0 ? '+' : '−';
  return `${sign}${formatHours(Math.abs(ms))}`;
}

export function ReportsPage() {
  useDocumentTitle('Tidsrapporter');
  const { salon } = useSalonContext();
  const { data } = useStore();
  const today = stockholmToday();
  const [from, setFrom] = useState(() => mondayOf(today));
  const [to, setTo] = useState(() => addDaysYmd(mondayOf(today), 6));
  const invalid = !isYmd(from) || !isYmd(to) || from > to;
  const rows = invalid
    ? []
    : buildTimeReport({
        salonId: salon.id,
        from,
        to,
        employees: data.employees,
        shifts: data.shifts,
        attendance: data.attendance,
      });
  const scheduled = rows.reduce((sum, row) => sum + row.scheduledMs, 0);
  const actual = rows.reduce((sum, row) => sum + row.actualMs, 0);

  return (
    <div className="page">
      <PageHeader
        title="Tidsrapporter"
        text="Jämför schemalagd tid med faktisk tid efter att raster dragits av. Ofullständiga pass räknas inte in och får inget påhittat slut."
      />
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="field compact">
          <label htmlFor="report-from">Från</label>
          <input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="field compact">
          <label htmlFor="report-to">Till</label>
          <input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            const start = mondayOf(stockholmToday());
            setFrom(start);
            setTo(addDaysYmd(start, 6));
          }}
        >
          Denna vecka
        </Button>
      </form>
      {invalid ? (
        <p className="field-error" role="alert">
          Startdatum kan inte vara efter slutdatum.
        </p>
      ) : null}
      <section className="card">
        {rows.length === 0 ? (
          <EmptyState title="Ingen rapport" text="Det finns inga medarbetare eller tider i det valda intervallet." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <caption className="sr-only">Jämförelse mellan schema och närvaro</caption>
                <thead>
                  <tr>
                    <th scope="col">Medarbetare</th>
                    <th scope="col">Schemalagd tid</th>
                    <th scope="col">Faktisk tid</th>
                    <th scope="col">Differens</th>
                    <th scope="col">Ofullständiga</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.employeeId}>
                      <th scope="row">
                        {row.name}
                        <span className="cell-sub">
                          {row.jobTitle}
                          {row.active ? '' : ' · inaktiv'}
                        </span>
                      </th>
                      <td>{formatHours(row.scheduledMs)}</td>
                      <td>{formatHours(row.actualMs)}</td>
                      <td>{formatDiff(row.actualMs - row.scheduledMs)}</td>
                      <td>{row.incomplete > 0 ? <span className="badge badge-expired">{row.incomplete}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Totalt</th>
                    <td>{formatHours(scheduled)}</td>
                    <td>{formatHours(actual)}</td>
                    <td>{formatDiff(actual - scheduled)}</td>
                    <td>{rows.reduce((sum, row) => sum + row.incomplete, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="hint">Faktisk tid hör till dagen för instämplingen. Raster är redan borträknade. Ofullständiga pass visas separat.</p>
          </>
        )}
      </section>
    </div>
  );
}
