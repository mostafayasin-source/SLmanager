import { Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useActor } from '../../auth/session';
import { Button, describedBy, Dialog, EmptyState, Field, OptionalField, PageHeader, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useStore } from '../../data/store';
import { effectiveStatus, statusLabel } from '../../domain/subscription';
import { addMonthsYmd, formatSek, formatSwedishDate, isYmd, stockholmToday } from '../../domain/time';
import type { EffectiveStatus, Salon } from '../../domain/types';

type StatusFilter = 'all' | EffectiveStatus;

interface SalonForm {
  id?: string;
  name: string;
  contactEmail: string;
  phone: string;
  address: string;
  price: string;
  subscriptionStart: string;
  subscriptionExpiry: string;
}

const filters: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Alla' },
  { id: 'active', label: 'Aktiv' },
  { id: 'expiring', label: 'Löper ut snart' },
  { id: 'expired', label: 'Utgången' },
  { id: 'suspended', label: 'Avstängd' },
];

function blankForm(): SalonForm {
  const today = stockholmToday();
  return {
    name: '',
    contactEmail: '',
    phone: '',
    address: '',
    price: '1490',
    subscriptionStart: today,
    subscriptionExpiry: addMonthsYmd(today, 1),
  };
}

function fromSalon(salon: Salon): SalonForm {
  return {
    id: salon.id,
    name: salon.name,
    contactEmail: salon.contactEmail,
    phone: salon.phone,
    address: salon.address,
    price: String(salon.subscriptionPrice),
    subscriptionStart: salon.subscriptionStart,
    subscriptionExpiry: salon.subscriptionExpiry,
  };
}

function validate(form: SalonForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Ange ett namn.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) errors.contactEmail = 'Ange en giltig e-postadress.';
  if (!/^\d+$/.test(form.price) || Number(form.price) < 1) errors.price = 'Priset måste vara minst 1 krona.';
  if (!isYmd(form.subscriptionStart) || !isYmd(form.subscriptionExpiry)) errors.subscriptionStart = 'Ange giltiga datum.';
  else if (form.subscriptionExpiry < form.subscriptionStart) errors.subscriptionExpiry = 'Utgångsdatum kan inte vara före startdatum.';
  return errors;
}

export function SalonsPage() {
  useDocumentTitle('Salonger');
  const { data } = useStore();
  const actor = useActor();
  const run = useSafeAction();
  const store = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [form, setForm] = useState<SalonForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const today = stockholmToday();

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('sv');
    return data.salons
      .map((salon) => ({ salon, status: effectiveStatus(salon, today) }))
      .filter(({ status }) => (filter === 'all' ? true : status === filter))
      .filter(({ salon }) => {
        if (!q) return true;
        return salon.name.toLocaleLowerCase('sv').includes(q) || salon.contactEmail.toLocaleLowerCase('sv').includes(q);
      })
      .sort((a, b) => a.salon.name.localeCompare(b.salon.name, 'sv'));
  }, [data.salons, filter, query, today]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const input = {
      name: form.name,
      contactEmail: form.contactEmail,
      phone: form.phone,
      address: form.address,
      subscriptionPrice: Number(form.price),
      subscriptionStart: form.subscriptionStart,
      subscriptionExpiry: form.subscriptionExpiry,
    };
    const ok = run(() => {
      if (form.id) store.updateSalon(actor, form.id, input);
      else store.createSalon(actor, input);
    }, form.id ? 'Salongen uppdaterades.' : 'Salongen skapades.');
    if (ok) setForm(null);
  };

  return (
    <div className="page">
      <PageHeader title="Salonger" text="Skapa och redigera salongsregister. Prenumerationsåtgärder finns under Prenumerationer.">
        <Button onClick={() => { setErrors({}); setForm(blankForm()); }}>
          <Plus size={18} /> Ny salong
        </Button>
      </PageHeader>
      <div className="toolbar">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="salon-search">
            Sök salong
          </label>
          <input id="salon-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sök namn eller e-post" />
        </div>
        <div className="field compact">
          <label htmlFor="salon-filter">Status</label>
          <select id="salon-filter" value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}>
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
          <EmptyState title="Inga träffar" text="Prova ett annat sökord eller en annan status." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Salongslista</caption>
              <thead>
                <tr>
                  <th scope="col">Salong</th>
                  <th scope="col">E-post</th>
                  <th scope="col">Pris</th>
                  <th scope="col">Start</th>
                  <th scope="col">Utgång</th>
                  <th scope="col">Status</th>
                  <th scope="col">Åtgärd</th>
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
                    <td>
                      <Button variant="ghost" onClick={() => { setErrors({}); setForm(fromSalon(salon)); }}>
                        <Pencil size={16} /> Redigera
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {form ? (
        <Dialog title={form.id ? 'Redigera salong' : 'Ny salong'} onClose={() => setForm(null)} wide>
          <form onSubmit={onSubmit}>
            <div className="form-grid">
              <Field id="salon-name" label="Namn" error={errors.name}>
                <input id="salon-name" data-autofocus value={form.name} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy('salon-name', errors.name)} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field id="salon-email" label="E-post" error={errors.contactEmail}>
                <input id="salon-email" type="email" autoComplete="off" value={form.contactEmail} aria-invalid={Boolean(errors.contactEmail)} aria-describedby={describedBy('salon-email', errors.contactEmail)} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
              </Field>
              <OptionalField id="salon-phone" label="Telefon">
                <input id="salon-phone" value={form.phone} autoComplete="off" onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </OptionalField>
              <OptionalField id="salon-address" label="Adress">
                <input id="salon-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </OptionalField>
              <Field id="salon-price" label="Pris per månad (SEK)" error={errors.price}>
                <input id="salon-price" inputMode="numeric" value={form.price} aria-invalid={Boolean(errors.price)} aria-describedby={describedBy('salon-price', errors.price)} onChange={(event) => setForm({ ...form, price: event.target.value })} />
              </Field>
              <Field id="salon-start" label="Startdatum" error={errors.subscriptionStart}>
                <input id="salon-start" type="date" value={form.subscriptionStart} aria-invalid={Boolean(errors.subscriptionStart)} aria-describedby={describedBy('salon-start', errors.subscriptionStart)} onChange={(event) => setForm({ ...form, subscriptionStart: event.target.value })} />
              </Field>
              <Field id="salon-expiry" label="Utgångsdatum" error={errors.subscriptionExpiry}>
                <input id="salon-expiry" type="date" value={form.subscriptionExpiry} aria-invalid={Boolean(errors.subscriptionExpiry)} aria-describedby={describedBy('salon-expiry', errors.subscriptionExpiry)} onChange={(event) => setForm({ ...form, subscriptionExpiry: event.target.value })} />
              </Field>
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
    </div>
  );
}
