import { useEffect, useState, type FormEvent } from 'react';
import { useActor } from '../../auth/session';
import { useSalonContext } from '../../components/Layout';
import { Button, ConfirmDialog, describedBy, Field, OptionalField, PageHeader, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useStore } from '../../data/store';
import { statusLabel } from '../../domain/subscription';
import { formatSek, formatSwedishDate } from '../../domain/time';

interface ProfileForm {
  name: string;
  contactEmail: string;
  phone: string;
  address: string;
}

function validate(form: ProfileForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Ange ett namn.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) errors.contactEmail = 'Ange en giltig e-postadress.';
  return errors;
}

export function SettingsPage() {
  useDocumentTitle('Inställningar');
  const { salon, status } = useSalonContext();
  const { updateSalonProfile, resetDemo } = useStore();
  const actor = useActor();
  const run = useSafeAction();
  const [form, setForm] = useState<ProfileForm>({
    name: salon.name,
    contactEmail: salon.contactEmail,
    phone: salon.phone,
    address: salon.address,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setForm({ name: salon.name, contactEmail: salon.contactEmail, phone: salon.phone, address: salon.address });
  }, [salon.name, salon.contactEmail, salon.phone, salon.address]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    run(() => updateSalonProfile(actor, salon.id, form), 'Salongsuppgifterna sparades.');
  };

  return (
    <div className="page">
      <PageHeader title="Inställningar" text="Uppgifter för den här salongen. Prenumerationen ändras av plattformsägaren." />
      <div className="settings-grid">
        <section className="card">
          <div className="card-head">
            <h2>Salongsdetaljer</h2>
          </div>
          <form onSubmit={onSubmit}>
            <div className="form-grid">
              <Field id="profile-name" label="Namn" error={errors.name}>
                <input id="profile-name" value={form.name} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy('profile-name', errors.name)} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field id="profile-email" label="E-post" error={errors.contactEmail}>
                <input id="profile-email" type="email" autoComplete="off" value={form.contactEmail} aria-invalid={Boolean(errors.contactEmail)} aria-describedby={describedBy('profile-email', errors.contactEmail)} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
              </Field>
              <OptionalField id="profile-phone" label="Telefon">
                <input id="profile-phone" autoComplete="off" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </OptionalField>
              <OptionalField id="profile-address" label="Adress">
                <input id="profile-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </OptionalField>
            </div>
            <div className="dialog-actions">
              <Button type="submit">Spara</Button>
            </div>
          </form>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Prenumeration</h2>
          </div>
          <dl className="facts">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`badge badge-${status}`}>{statusLabel(status)}</span>
              </dd>
            </div>
            <div>
              <dt>Pris per månad</dt>
              <dd>{formatSek(salon.subscriptionPrice)}</dd>
            </div>
            <div>
              <dt>Startdatum</dt>
              <dd>{formatSwedishDate(salon.subscriptionStart, 'long')}</dd>
            </div>
            <div>
              <dt>Utgångsdatum</dt>
              <dd>{formatSwedishDate(salon.subscriptionExpiry, 'long')}</dd>
            </div>
          </dl>
          <p className="hint">Pris och datum är inte en betalning. Plattformsägaren aktiverar, stänger av och förnyar manuellt.</p>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Demodata</h2>
          </div>
          <p className="muted">Återställningen ersätter alla ändringar i den här webbläsaren med nya exempeluppgifter för innevarande vecka.</p>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Återställ demodata
          </Button>
        </section>
      </div>
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
    </div>
  );
}
