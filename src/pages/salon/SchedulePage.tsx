import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useActor } from '../../auth/session';
import { useSalonContext } from '../../components/Layout';
import { Button, ConfirmDialog, describedBy, Dialog, EmptyState, Field, OptionalField, PageHeader, useDocumentTitle, useSafeAction, useToast } from '../../components/ui';
import { useStore } from '../../data/store';
import { weekBounds } from '../../domain/schedule';
import { addDaysYmd, formatSwedishDate, formatWeekLabel, isYmd, mondayOf, normalizeHm, stockholmToday, weekDates } from '../../domain/time';
import { employeeName, type Shift } from '../../domain/types';

interface ShiftForm {
  id?: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
}

export function SchedulePage() {
  useDocumentTitle('Veckoschema');
  const { salon, locked } = useSalonContext();
  const { data, saveShift, deleteShift, copyWeek } = useStore();
  const actor = useActor();
  const run = useSafeAction();
  const toast = useToast();
  const today = stockholmToday();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [form, setForm] = useState<ShiftForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const employees = data.employees.filter((employee) => employee.salonId === salon.id).sort((a, b) => employeeName(a).localeCompare(employeeName(b), 'sv'));
  const activeEmployees = employees.filter((employee) => employee.active);
  const shifts = data.shifts.filter((shift) => shift.salonId === salon.id);
  const days = weekDates(weekStart);
  const bounds = weekBounds(weekStart);
  const sourceCount = shifts.filter((shift) => shift.date >= bounds.prevStart && shift.date <= bounds.prevEnd).length;
  const targetCount = shifts.filter((shift) => shift.date >= weekStart && shift.date <= bounds.weekEnd).length;
  const removing = shifts.find((shift) => shift.id === removeId);

  const openCreate = (date: string) => {
    setErrors({});
    setForm({ employeeId: activeEmployees[0]?.id ?? '', date, startTime: '09:00', endTime: '17:00', note: '' });
  };

  const openEdit = (shift: Shift) => {
    setErrors({});
    setForm({ id: shift.id, employeeId: shift.employeeId, date: shift.date, startTime: shift.startTime, endTime: shift.endTime, note: shift.note });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form || locked) return;
    const nextErrors: Record<string, string> = {};
    if (!form.employeeId) nextErrors.employeeId = 'Välj en medarbetare.';
    if (!isYmd(form.date)) nextErrors.date = 'Ange ett datum.';
    const start = normalizeHm(form.startTime);
    const end = normalizeHm(form.endTime);
    if (!start || !end) nextErrors.startTime = 'Ange tider i formatet tt:mm.';
    else if (start === end) nextErrors.endTime = 'Start och slut kan inte vara samma tid.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const ok = run(
      () =>
        saveShift(actor, {
          id: form.id,
          salonId: salon.id,
          employeeId: form.employeeId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          note: form.note,
        }),
      form.id ? 'Passet uppdaterades.' : 'Passet skapades.',
    );
    if (ok) setForm(null);
  };

  const askCopy = () => {
    if (locked) return;
    if (sourceCount === 0) {
      toast.error('Föregående vecka har inga pass att kopiera.');
      return;
    }
    setCopyOpen(true);
  };

  return (
    <div className="page">
      <PageHeader title="Veckoschema" text="Planerade pass är skilda från faktisk närvaro. Tider visas i 24-timmarsformat, tidszon Europe/Stockholm.">
        <Button variant="secondary" onClick={askCopy} disabled={locked}>
          <Copy size={18} /> Kopiera föregående vecka
        </Button>
      </PageHeader>
      <div className="week-bar">
        <Button variant="secondary" aria-label="Föregående vecka" onClick={() => setWeekStart(addDaysYmd(weekStart, -7))}>
          <ChevronLeft size={18} /> Föregående
        </Button>
        <p>{formatWeekLabel(weekStart)}</p>
        <Button variant="secondary" aria-label="Nästa vecka" onClick={() => setWeekStart(addDaysYmd(weekStart, 7))}>
          Nästa <ChevronRight size={18} />
        </Button>
      </div>
      {locked ? <p className="muted">Schemat kan visas, men nya ändringar är låsta tills prenumerationen är aktiv.</p> : null}
      <div className="week-scroll">
        <div className="week-grid">
          {days.map((date) => {
            const dayShifts = shifts.filter((shift) => shift.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <section key={date} className={date === today ? 'day-column today' : 'day-column'} aria-current={date === today ? 'date' : undefined}>
                <header>
                  <h2>{formatSwedishDate(date, 'weekday')}</h2>
                  <button type="button" className="icon-btn" aria-label={`Lägg till pass ${formatSwedishDate(date, 'long')}`} disabled={locked || activeEmployees.length === 0} onClick={() => openCreate(date)}>
                    <Plus size={16} />
                  </button>
                </header>
                {dayShifts.length === 0 ? <p className="muted tight">Inga pass</p> : null}
                {dayShifts.map((shift) => {
                  const employee = employees.find((item) => item.id === shift.employeeId);
                  const label = employee ? employeeName(employee) : 'Okänd';
                  return (
                    <article key={shift.id} className="shift-card">
                      <strong>{label}</strong>
                      <p>
                        {shift.startTime}–{shift.endTime}
                        {shift.endTime <= shift.startTime ? ' · nästa dygn' : ''}
                      </p>
                      {shift.note ? <p className="muted tight">{shift.note}</p> : null}
                      <div className="action-row">
                        <button type="button" className="icon-btn" aria-label={`Redigera pass för ${label} ${formatSwedishDate(date, 'long')}`} disabled={locked} onClick={() => openEdit(shift)}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="icon-btn danger" aria-label={`Ta bort pass för ${label} ${formatSwedishDate(date, 'long')}`} disabled={locked} onClick={() => setRemoveId(shift.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
      {activeEmployees.length === 0 ? <EmptyState title="Inga aktiva medarbetare" text="Lägg till eller aktivera en medarbetare innan du skapar nya pass." /> : null}
      {form ? (
        <Dialog title={form.id ? 'Redigera pass' : 'Nytt pass'} onClose={() => setForm(null)}>
          <form onSubmit={onSubmit}>
            <div className="form-grid">
              <Field id="shift-employee" label="Medarbetare" error={errors.employeeId}>
                <select id="shift-employee" data-autofocus value={form.employeeId} aria-invalid={Boolean(errors.employeeId)} aria-describedby={describedBy('shift-employee', errors.employeeId)} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
                  <option value="">Välj medarbetare</option>
                  {employees
                    .filter((employee) => employee.active || employee.id === form.employeeId)
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeName(employee)}
                        {employee.active ? '' : ' (inaktiv)'}
                      </option>
                    ))}
                </select>
              </Field>
              <Field id="shift-date" label="Datum" error={errors.date}>
                <input id="shift-date" type="date" value={form.date} aria-invalid={Boolean(errors.date)} aria-describedby={describedBy('shift-date', errors.date)} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </Field>
              <Field id="shift-start" label="Start" error={errors.startTime}>
                <input id="shift-start" type="time" step={60} value={form.startTime} aria-invalid={Boolean(errors.startTime)} aria-describedby={describedBy('shift-start', errors.startTime)} onChange={(event) => setForm({ ...form, startTime: event.target.value.slice(0, 5) })} />
              </Field>
              <Field id="shift-end" label="Slut" error={errors.endTime}>
                <input id="shift-end" type="time" step={60} value={form.endTime} aria-invalid={Boolean(errors.endTime)} aria-describedby={describedBy('shift-end', errors.endTime)} onChange={(event) => setForm({ ...form, endTime: event.target.value.slice(0, 5) })} />
              </Field>
              <OptionalField id="shift-note" label="Anteckning">
                <input id="shift-note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
              </OptionalField>
            </div>
            {form.endTime && form.startTime && form.endTime < form.startTime ? <p className="hint">Passet slutar nästa dygn.</p> : null}
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Avbryt
              </Button>
              <Button type="submit" disabled={locked}>
                Spara
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Ta bort pass"
          body={`Ta bort passet ${removing.startTime}–${removing.endTime} den ${formatSwedishDate(removing.date, 'long')}?`}
          confirmLabel="Ta bort"
          danger
          onClose={() => setRemoveId(null)}
          onConfirm={() => {
            const ok = run(() => deleteShift(actor, removing.id, salon.id), 'Passet togs bort.');
            if (ok) setRemoveId(null);
          }}
        />
      ) : null}
      {copyOpen ? (
        <ConfirmDialog
          title="Kopiera föregående vecka"
          body={
            targetCount > 0
              ? `Den här veckan har ${targetCount} pass. De ersätts av föregående veckas schema (${sourceCount} pass).`
              : `Kopiera ${sourceCount} pass från föregående vecka till den här veckan?`
          }
          confirmLabel={targetCount > 0 ? 'Ersätt passen' : 'Kopiera'}
          danger={targetCount > 0}
          onClose={() => setCopyOpen(false)}
          onConfirm={() => {
            let copied = 0;
            const ok = run(() => {
              copied = copyWeek(actor, salon.id, weekStart).copied;
            });
            if (ok) {
              toast.success(`${copied} pass kopierades.`);
              setCopyOpen(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
