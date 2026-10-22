import { Scissors } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { homePath, useSession } from '../auth/session';
import { Button, useDocumentTitle, Wordmark } from '../components/ui';

export function LoginPage() {
  useDocumentTitle('Logga in');
  const { session, login } = useSession();
  const navigate = useNavigate();

  if (session) return <Navigate to={homePath(session)} replace />;

  const enter = (role: 'platform' | 'salon') => {
    login(role);
    navigate(role === 'platform' ? '/plattform' : '/salong');
  };

  return (
    <div className="login-screen">
      <a className="skip-link" href="#innehall">
        Hoppa till innehåll
      </a>
      <main id="innehall" className="login-card" tabIndex={-1}>
        <div className="login-mark">
          <Scissors size={18} aria-hidden="true" />
          <Wordmark />
        </div>
        <h1>Logga in</h1>
        <p className="login-lead">Hantera salonger, personal, veckoschema och närvaro. Välj en demoroll för att öppna prototypen.</p>
        <p className="demo-pill">Demoläge — inga riktiga konton</p>
        <div className="login-actions">
          <Button onClick={() => enter('platform')}>Prova som plattformsägare</Button>
          <Button variant="secondary" onClick={() => enter('salon')}>
            Prova som salongsägare
          </Button>
        </div>
        <p className="login-foot">Ingen lösenordskontroll används. Rollen sparas bara i den här webbläsaren tills du loggar ut.</p>
      </main>
    </div>
  );
}
