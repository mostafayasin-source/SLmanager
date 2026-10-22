import { useEffect, useState, type FormEvent } from 'react';
import { useActor } from '../../auth/session';
import { Button, OptionalField, PageHeader, useDocumentTitle, useSafeAction } from '../../components/ui';
import { useStore } from '../../data/store';
import { formatSupportPhone } from '../../domain/phone';

export function PlatformSettingsPage() {
  useDocumentTitle('Inställningar');
  const actor = useActor();
  const { data, setSupportPhone } = useStore();
  const run = useSafeAction();
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setPhone(data.supportPhone ? formatSupportPhone(data.supportPhone) : '');
  }, [data.supportPhone]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const clearing = !phone.trim();
    run(() => setSupportPhone(actor, phone), clearing ? 'Supportnumret togs bort.' : 'Supportnumret sparades.');
  };

  return (
    <div className="page">
      <PageHeader title="Inställningar" text="Plattformsinställningar för demon. Supportnumret visas på salongens kundsupportsida." />
      <section className="card">
        <div className="card-head">
          <h2>Supporttelefon</h2>
        </div>
        <form className="stack" onSubmit={save}>
          <OptionalField id="support-phone" label="Telefonnummer">
            <input id="support-phone" value={phone} autoComplete="tel" inputMode="tel" data-autofocus onChange={(event) => setPhone(event.target.value)} />
          </OptionalField>
          <p className="hint">
            Lämna fältet tomt tills numret är bestämt. Ett sparat nummer visas med läsbart format och som en tel-länk i internationellt format. Inget nummer är förifyllt.
          </p>
          <div className="action-row">
            <Button type="submit">Spara nummer</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
