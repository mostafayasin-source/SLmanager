import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useActor } from '../../auth/session';
import { useSalonContext } from '../../components/Layout';
import { Button, ConfirmDialog, describedBy, Dialog, EmptyState, Field, OptionalField, PageHeader, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useStore } from '../../data/store';
import { employeeName, type Employee } from '../../domain/types';

type Filter = 'active' | 'inactive' | 'all';

interface EmployeeForm {
  id?: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
}

const emptyForm = (): EmployeeForm => ({ firstName: '', lastName: '', jobTitle: '', email: '', phone: '' });

function validate(form: EmployeeForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.firstName.trim()) errors.firstName = 'Ange ett förnamn.';
  if (!form.lastName.trim()) errors.lastName = 'Ange ett efternamn.';
  if (!form.jobTitle.trim()) errors.jobTitle = 'Ange en yrkesroll.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Ange en giltig e-postadress.';
  return errors;
}

export function EmployeesPage() {
  useDocumentTitle('Medarbetare');
  const { salon } = useSalonContext();
  const { data, saveEmployee, setEmployeeActive } = useStore();
  const actor = useActor();
  const run = useSafeAction();
  const [filter, setFilter] = useState<Filter>('active');
  const [form, setForm] = useState<EmployeeForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Employee | null>(null);

  const employees = data.employees
    .filter((employee) => employee.salonId === salon.id)
    .filter((employee) => (filter === 'all' ? true : filter === 'active' ? employee.active : !employee.active))
    .sort((a, b) => employeeName(a).localeCompare(employeeName(b), 'sv'));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const ok = run(
      () =>
        saveEmployee(actor, {
          id: form.id,
          salonId: salon.id,
          firstName: form.firstName,
          lastName: form.lastName,
          jobTitle: form.jobTitle,
          email: form.email,
          phone: form.phone,
        }),
      form.id ? 'Medarbetaren uppdaterades.' : 'Medarbetaren lades till.',
    );
    if (ok) setForm(null);
  };

  return (
    <div className="page">
      <PageHeader title="Medarbetare" text="Lägg till, redigera och inaktivera personal. Historiken behålls när någon inaktiveras.">
        <Button
          onClick={() => {
            setErrors({});
            setForm(emptyForm());
          }}
        >
          <Plus size={18} /> Ny medarbetare
        </Button>
      </PageHeader>
      <div className="segmented" role="group" aria-label="Filtrera medarbetare">
        {(
          [
            ['active', 'Aktiva'],
            ['inactive', 'Inaktiva'],
            ['all', 'Alla'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      <section className="card">
        {employees.length === 0 ? (
          <EmptyState title="Inga medarbetare" text="Det finns inga personer i det här urvalet." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Medarbetare</caption>
              <thead>
                <tr>
                  <th scope="col">Namn</th>
                  <th scope="col">Roll</th>
                  <th scope="col">E-post</th>
                  <th scope="col">Telefon</th>
                  <th scope="col">Status</th>
                  <th scope="col">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <th scope="row">{employeeName(employee)}</th>
                    <td>{employee.jobTitle}</td>
                    <td>{employee.email}</td>
                    <td>{employee.phone || '—'}</td>
                    <td>
                      <span className={employee.active ? 'badge badge-active' : 'badge badge-suspended'}>{employee.active ? 'Aktiv' : 'Inaktiv'}</span>
                    </td>
                    <td>
                      <div className="action-row">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setErrors({});
                            setForm({
                              id: employee.id,
                              firstName: employee.firstName,
                              lastName: employee.lastName,
                              jobTitle: employee.jobTitle,
                              email: employee.email,
                              phone: employee.phone,
                            });
                          }}
                        >
                          <Pencil size={16} /> Redigera
                        </Button>
                        {employee.active ? (
                          <Button variant="danger" onClick={() => setPending(employee)}>
                            Inaktivera
                          </Button>
                        ) : (
                          <Button variant="secondary" onClick={() => run(() => setEmployeeActive(actor, employee.id, salon.id, true), 'Medarbetaren aktiverades.')}>
                            Aktivera
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {form ? (
        <Dialog title={form.id ? 'Redigera medarbetare' : 'Ny medarbetare'} onClose={() => setForm(null)}>
          <form onSubmit={onSubmit}>
            <div className="form-grid">
              <Field id="emp-first" label="Förnamn" error={errors.firstName}>
                <input id="emp-first" data-autofocus value={form.firstName} aria-invalid={Boolean(errors.firstName)} aria-describedby={describedBy('emp-first', errors.firstName)} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
              </Field>
              <Field id="emp-last" label="Efternamn" error={errors.lastName}>
                <input id="emp-last" value={form.lastName} aria-invalid={Boolean(errors.lastName)} aria-describedby={describedBy('emp-last', errors.lastName)} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
              </Field>
              <Field id="emp-title" label="Yrkesroll" error={errors.jobTitle}>
                <input id="emp-title" value={form.jobTitle} aria-invalid={Boolean(errors.jobTitle)} aria-describedby={describedBy('emp-title', errors.jobTitle)} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} />
              </Field>
              <Field id="emp-email" label="E-post" error={errors.email}>
                <input id="emp-email" type="email" autoComplete="off" value={form.email} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy('emp-email', errors.email)} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
              <OptionalField id="emp-phone" label="Telefon">
                <input id="emp-phone" autoComplete="off" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </OptionalField>
            </div>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Avbryt
              </Button>
              <Button type="submit">Spara</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title="Inaktivera medarbetare"
          body={`${employeeName(pending)} kan inte längre schemaläggas eller stämplas in. Pass och stämplingar som redan finns behålls.`}
          confirmLabel="Inaktivera"
          danger
          onClose={() => setPending(null)}
          onConfirm={() => {
            const ok = run(() => setEmployeeActive(actor, pending.id, salon.id, false), 'Medarbetaren inaktiverades.');
            if (ok) setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}
