import { useState, type FormEvent } from 'react';
import { useActor } from '../../auth/session';
import { useSalonContext } from '../../components/Layout';
import { Button, describedBy, Dialog, EmptyState, Field, PageHeader, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useStore } from '../../data/store';
import { attendanceDuration } from '../../domain/attendance';
import { missingClockOutReason, sessionPhase } from '../../domain/dashboard';
import { createId } from '../../domain/ids';
import { formatHours, formatSwedishDateTime, stockholmDateTimeToIso, stockholmHmFromIso, stockholmToday, stockholmYmdFromIso } from '../../domain/time';
import { employeeName, type AttendanceSession, type BreakPeriod } from '../../domain/types';

interface BreakDraft {
  id: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  open: boolean;
}

interface CorrectionDraft {
  sessionId: string;
  clockInDate: string;
  clockInTime: string;
  openEnded: boolean;
  clockOutDate: string;
  clockOutTime: string;
  breaks: BreakDraft[];
  reason: string;
}

function splitIso(iso: string): { date: string; time: string } {
  return { date: stockholmYmdFromIso(iso), time: stockholmHmFromIso(iso) };
}

function toDraft(session: AttendanceSession): CorrectionDraft {
  const start = splitIso(session.clockIn);
  const end = splitIso(session.clockOut ?? new Date().toISOString());
  return {
    sessionId: session.id,
    clockInDate: start.date,
    clockInTime: start.time,
    openEnded: session.clockOut === null,
    clockOutDate: end.date,
    clockOutTime: end.time,
    reason: '',
    breaks: session.breaks.map((entry) => {
      const breakStart = splitIso(entry.start);
      const breakEnd = splitIso(entry.end ?? entry.start);
      return {
        id: entry.id,
        startDate: breakStart.date,
        startTime: breakStart.time,
        endDate: breakEnd.date,
        endTime: breakEnd.time,
        open: entry.end === null,
      };
    }),
  };
}

function breakSummary(session: AttendanceSession): string {
  if (session.breaks.length === 0) return 'Ingen rast';
  if (session.breaks.some((entry) => entry.end === null)) return 'Rast pågår';
  return session.breaks.length === 1 ? '1 rast' : `${session.breaks.length} raster`;
}

export function ClockPage() {
  useDocumentTitle('Stämpla');
  const { salon, locked } = useSalonContext();
  const store = useStore();
  const actor = useActor();
  const run = useSafeAction();
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<CorrectionDraft | null>(null);
  const [formError, setFormError] = useState('');
  const today = stockholmToday();
  const nowIso = new Date().toISOString();

  const employees = store.data.employees.filter((employee) => employee.salonId === salon.id).sort((a, b) => employeeName(a).localeCompare(employeeName(b), 'sv'));
  const openSessions = store.data.attendance.filter((session) => session.salonId === salon.id && session.clockOut === null);
  const selectable = employees.filter((employee) => employee.active || openSessions.some((session) => session.employeeId === employee.id));
  const selected = selectable.find((employee) => employee.id === selectedId) ?? selectable[0];
  const open = selected ? openSessions.find((session) => session.employeeId === selected.id) : undefined;
  const phase = open ? sessionPhase(open) : 'closed';
  const missing = open ? missingClockOutReason(open, store.data.shifts, nowIso, today) : null;

  const recent = store.data.attendance
    .filter((session) => session.salonId === salon.id)
    .sort((a, b) => b.clockIn.localeCompare(a.clockIn))
    .slice(0, 20);

  const statusText = (() => {
    if (locked) return 'Schema och stämpling är låsta tills prenumerationen är aktiv.';
    if (!selected) return 'Det finns ingen medarbetare att stämpla.';
    if (!selected.active && !open) return 'Inaktiva medarbetare kan inte stämplas in.';
    if (!open) return 'Ingen öppen stämpling.';
    if (phase === 'break') return `På rast sedan ${formatSwedishDateTime(open.breaks.find((entry) => entry.end === null)?.start ?? open.clockIn)}. Avsluta rasten innan utstämpling.`;
    if (missing === 'previous-day') return 'Öppen stämpling från ett tidigare dygn. Utstämpling saknas.';
    if (missing === 'shift-ended') return 'Passet har slutat och utstämpling saknas.';
    return `Arbetar sedan ${formatSwedishDateTime(open.clockIn)}.`;
  })();

  const act = (action: () => void, success: string) => {
    if (!selected || locked) return;
    run(action, success);
  };

  const onCorrect = (event: FormEvent) => {
    event.preventDefault();
    if (!draft || locked) return;
    if (!draft.reason.trim()) {
      setFormError('Ange en orsak till korrigeringen.');
      return;
    }
    try {
      const clockIn = stockholmDateTimeToIso(draft.clockInDate, draft.clockInTime);
      const clockOut = draft.openEnded ? null : stockholmDateTimeToIso(draft.clockOutDate, draft.clockOutTime);
      const breaks: BreakPeriod[] = draft.breaks.map((entry) => ({
        id: entry.id,
        start: stockholmDateTimeToIso(entry.startDate, entry.startTime),
        end: draft.openEnded && entry.open ? null : stockholmDateTimeToIso(entry.endDate, entry.endTime),
      }));
      const ok = run(
        () => store.correctAttendance(actor, draft.sessionId, { clockIn, clockOut, breaks, reason: draft.reason }),
        'Korrigeringen sparades.',
      );
      if (ok) setDraft(null);
    } catch {
      setFormError('Ange giltiga datum och tider för passet och rasterna.');
    }
  };

  return (
    <div className="page">
      <PageHeader title="Stämpla" text="Välj en medarbetare. Planerade pass ändras inte av stämplingen." />
      {selectable.length === 0 ? (
        <EmptyState title="Inga medarbetare" text="Lägg till en aktiv medarbetare innan du stämplar." />
      ) : (
        <section className="card clock-panel">
          <Field id="clock-employee" label="Medarbetare">
            <select id="clock-employee" value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
              {selectable.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeName(employee)} · {employee.jobTitle}
                  {employee.active ? '' : ' (inaktiv)'}
                </option>
              ))}
            </select>
          </Field>
          <p role="status">{statusText}</p>
          <div className="action-row">
            <Button disabled={locked || !selected?.active || Boolean(open)} onClick={() => selected && act(() => store.clockIn(actor, salon.id, selected.id), 'Instämpling registrerad.')}>
              Stämpla in
            </Button>
            <Button disabled={locked || phase !== 'working'} onClick={() => selected && act(() => store.startBreak(actor, salon.id, selected.id), 'Rasten startades.')}>
              Starta rast
            </Button>
            <Button disabled={locked || phase !== 'break'} onClick={() => selected && act(() => store.endBreak(actor, salon.id, selected.id), 'Rasten avslutades.')}>
              Avsluta rast
            </Button>
            <Button disabled={locked || phase !== 'working'} onClick={() => selected && act(() => store.clockOut(actor, salon.id, selected.id), 'Utstämpling registrerad.')}>
              Stämpla ut
            </Button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Senaste stämplingar</h2>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Inga stämplingar" text="När någon stämplar in syns passen här." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Senaste stämplingar</caption>
              <thead>
                <tr>
                  <th scope="col">Medarbetare</th>
                  <th scope="col">Instämpling</th>
                  <th scope="col">Utstämpling</th>
                  <th scope="col">Rast</th>
                  <th scope="col">Nettotid</th>
                  <th scope="col">Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((session) => {
                  const employee = employees.find((item) => item.id === session.employeeId);
                  const duration = attendanceDuration(session);
                  return (
                    <tr key={session.id}>
                      <th scope="row">{employee ? employeeName(employee) : 'Okänd'}</th>
                      <td>{formatSwedishDateTime(session.clockIn)}</td>
                      <td>{session.clockOut ? formatSwedishDateTime(session.clockOut) : 'Ofullständig'}</td>
                      <td>{breakSummary(session)}</td>
                      <td>{duration.complete ? formatHours(duration.netMs) : 'Ofullständig'}</td>
                      <td>
                        <Button
                          variant="ghost"
                          disabled={locked}
                          onClick={() => {
                            setFormError('');
                            setDraft(toDraft(session));
                          }}
                        >
                          Korrigera
                        </Button>
                        {session.corrections.length > 0 ? (
                          <details className="correction-log">
                            <summary>{session.corrections.length === 1 ? '1 korrigering' : `${session.corrections.length} korrigeringar`}</summary>
                            {session.corrections.map((correction) => (
                              <article key={correction.id}>
                                <p>
                                  Före: {formatSwedishDateTime(correction.before.clockIn)} – {correction.before.clockOut ? formatSwedishDateTime(correction.before.clockOut) : 'ofullständig'}
                                </p>
                                <p>
                                  Efter: {formatSwedishDateTime(correction.after.clockIn)} – {correction.after.clockOut ? formatSwedishDateTime(correction.after.clockOut) : 'ofullständig'}
                                </p>
                                <p className="muted">
                                  {formatSwedishDateTime(correction.at)} · {correction.actor}
                                </p>
                                <p>Orsak: {correction.reason}</p>
                              </article>
                            ))}
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {draft ? (
        <Dialog title="Korrigera stämpling" onClose={() => setDraft(null)} wide>
          <form onSubmit={onCorrect}>
            {formError ? (
              <p className="field-error" role="alert">
                {formError}
              </p>
            ) : null}
            <p className="hint">Tiderna tolkas som Europe/Stockholm. En ofullständig stämpling får inget påhittat slut.</p>
            <div className="form-grid">
              <Field id="cor-in-date" label="Instämpling, datum">
                <input id="cor-in-date" data-autofocus type="date" value={draft.clockInDate} onChange={(event) => setDraft({ ...draft, clockInDate: event.target.value })} />
              </Field>
              <Field id="cor-in-time" label="Instämpling, tid">
                <input id="cor-in-time" type="time" step={60} value={draft.clockInTime} onChange={(event) => setDraft({ ...draft, clockInTime: event.target.value.slice(0, 5) })} />
              </Field>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={draft.openEnded} onChange={(event) => setDraft({ ...draft, openEnded: event.target.checked, breaks: draft.breaks.map((entry) => ({ ...entry, open: event.target.checked ? entry.open : false })) })} />
              Ofullständig, ingen utstämpling
            </label>
            {draft.openEnded ? null : (
              <div className="form-grid">
                <Field id="cor-out-date" label="Utstämpling, datum">
                  <input id="cor-out-date" type="date" value={draft.clockOutDate} onChange={(event) => setDraft({ ...draft, clockOutDate: event.target.value })} />
                </Field>
                <Field id="cor-out-time" label="Utstämpling, tid">
                  <input id="cor-out-time" type="time" step={60} value={draft.clockOutTime} onChange={(event) => setDraft({ ...draft, clockOutTime: event.target.value.slice(0, 5) })} />
                </Field>
              </div>
            )}
            <fieldset className="break-set">
              <legend>Raster</legend>
              {draft.breaks.length === 0 ? <p className="muted">Inga raster.</p> : null}
              {draft.breaks.map((entry, index) => (
                <div key={entry.id} className="break-row">
                  <Field id={`brk-start-date-${entry.id}`} label={`Rast ${index + 1}, startdatum`}>
                    <input id={`brk-start-date-${entry.id}`} type="date" value={entry.startDate} onChange={(event) => setDraft({ ...draft, breaks: draft.breaks.map((item) => (item.id === entry.id ? { ...item, startDate: event.target.value } : item)) })} />
                  </Field>
                  <Field id={`brk-start-time-${entry.id}`} label="Starttid">
                    <input id={`brk-start-time-${entry.id}`} type="time" step={60} value={entry.startTime} onChange={(event) => setDraft({ ...draft, breaks: draft.breaks.map((item) => (item.id === entry.id ? { ...item, startTime: event.target.value.slice(0, 5) } : item)) })} />
                  </Field>
                  {draft.openEnded ? (
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={entry.open}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            breaks: draft.breaks.map((item) => ({ ...item, open: item.id === entry.id ? event.target.checked : false })),
                          })
                        }
                      />
                      Rasten pågår
                    </label>
                  ) : null}
                  {!draft.openEnded || !entry.open ? (
                    <>
                      <Field id={`brk-end-date-${entry.id}`} label="Slutdatum">
                        <input id={`brk-end-date-${entry.id}`} type="date" value={entry.endDate} onChange={(event) => setDraft({ ...draft, breaks: draft.breaks.map((item) => (item.id === entry.id ? { ...item, endDate: event.target.value } : item)) })} />
                      </Field>
                      <Field id={`brk-end-time-${entry.id}`} label="Sluttid">
                        <input id={`brk-end-time-${entry.id}`} type="time" step={60} value={entry.endTime} onChange={(event) => setDraft({ ...draft, breaks: draft.breaks.map((item) => (item.id === entry.id ? { ...item, endTime: event.target.value.slice(0, 5) } : item)) })} />
                      </Field>
                    </>
                  ) : null}
                  <Button variant="ghost" onClick={() => setDraft({ ...draft, breaks: draft.breaks.filter((item) => item.id !== entry.id) })}>
                    Ta bort rast
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    breaks: [
                      ...draft.breaks,
                      {
                        id: createId('brk'),
                        startDate: draft.clockInDate,
                        startTime: draft.clockInTime,
                        endDate: draft.clockOutDate,
                        endTime: draft.clockOutTime,
                        open: false,
                      },
                    ],
                  })
                }
              >
                Lägg till rast
              </Button>
            </fieldset>
            <Field id="cor-reason" label="Orsak" error={formError === 'Ange en orsak till korrigeringen.' ? formError : undefined}>
              <textarea id="cor-reason" value={draft.reason} aria-invalid={formError === 'Ange en orsak till korrigeringen.'} aria-describedby={describedBy('cor-reason', formError === 'Ange en orsak till korrigeringen.' ? formError : undefined)} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
            </Field>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Avbryt
              </Button>
              <Button type="submit" disabled={locked}>
                Spara korrigering
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
