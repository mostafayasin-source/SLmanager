import { useSalonContext } from '../../components/Layout';
import { EmptyState, PageHeader, useDocumentTitle } from '../../components/ui';
import { useStore } from '../../data/store';
import { missingClockOutReason, sessionPhase } from '../../domain/dashboard';
import type { MissingReason } from '../../domain/dashboard';
import { formatSwedishDate, formatSwedishDateTime, stockholmToday } from '../../domain/time';
import { employeeName, type Employee } from '../../domain/types';

function reasonText(reason: MissingReason): string {
  return reason === 'previous-day'
    ? 'Instämplingen är från ett tidigare dygn och saknar utstämpling.'
    : 'Schemalagt pass har slutat och utstämpling saknas.';
}

export function SalonOverviewPage() {
  useDocumentTitle('Översikt');
  const { salon } = useSalonContext();
  const { data } = useStore();
  const today = stockholmToday();
  const nowIso = new Date().toISOString();
  const employees = data.employees.filter((employee) => employee.salonId === salon.id);
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const nameOf = (employee?: Employee) => (employee ? employeeName(employee) : 'Okänd medarbetare');
  const todayShifts = data.shifts
    .filter((shift) => shift.salonId === salon.id && shift.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || nameOf(byId.get(a.employeeId)).localeCompare(nameOf(byId.get(b.employeeId)), 'sv'));
  const openSessions = data.attendance.filter((session) => session.salonId === salon.id && session.clockOut === null);
  const missing = openSessions
    .map((session) => ({ session, reason: missingClockOutReason(session, data.shifts, nowIso, today) }))
    .filter((item): item is { session: (typeof openSessions)[number]; reason: MissingReason } => item.reason !== null);

  return (
    <div className="page">
      <PageHeader title="Översikt" text={`${salon.name} · ${formatSwedishDate(today, 'long')}`} />
      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>Instämplade nu</h2>
          </div>
          {openSessions.length === 0 ? (
            <EmptyState title="Ingen är instämplad" text="Öppna Stämpla när ett pass börjar." />
          ) : (
            <ul className="plain-list">
              {openSessions.map((session) => {
                const phase = sessionPhase(session);
                return (
                  <li key={session.id}>
                    <div>
                      <strong>{nameOf(byId.get(session.employeeId))}</strong>
                      <p className="muted">Startade {formatSwedishDateTime(session.clockIn)}</p>
                    </div>
                    <span className={phase === 'break' ? 'badge badge-expiring' : 'badge badge-active'}>{phase === 'break' ? 'På rast' : 'Arbetar'}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Dagens pass</h2>
          </div>
          {todayShifts.length === 0 ? (
            <EmptyState title="Inga pass idag" text="Lägg till pass i veckoschemat." />
          ) : (
            <ul className="plain-list">
              {todayShifts.map((shift) => (
                <li key={shift.id}>
                  <div>
                    <strong>{nameOf(byId.get(shift.employeeId))}</strong>
                    <p className="muted">{byId.get(shift.employeeId)?.jobTitle}</p>
                  </div>
                  <span>
                    {shift.startTime}–{shift.endTime}
                    {shift.endTime <= shift.startTime ? ' (nästa dygn)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Saknar utstämpling</h2>
          </div>
          {missing.length === 0 ? (
            <EmptyState title="Inga saknade utstämplingar" text="Alla avslutade pass har en utstämpling, eller så pågår de fortfarande." />
          ) : (
            <ul className="plain-list">
              {missing.map(({ session, reason }) => (
                <li key={session.id}>
                  <div>
                    <strong>{nameOf(byId.get(session.employeeId))}</strong>
                    <p className="muted">{reasonText(reason)}</p>
                  </div>
                  <span className="badge badge-expired">Ofullständig</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
