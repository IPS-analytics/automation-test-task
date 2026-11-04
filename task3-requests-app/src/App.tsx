import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './lib/supabase';
import { errorMessage } from './lib/errors';
import { navigate, useRoute } from './lib/router';
import { ToastProvider, useToast } from './components/Toasts';
import { AuthScreen } from './components/AuthScreen';
import { RequestsList, type Filters } from './components/RequestsList';
import { RequestForm } from './components/RequestForm';

export default function App() {
  if (!isConfigured) {
    return (
      <main className="center-screen">
        <div className="panel">
          <h1>Нет подключения к Supabase</h1>
          <p className="muted">Задайте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY и пересоберите приложение.</p>
        </div>
      </main>
    );
  }
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  // undefined — сессия ещё не прочитана, null — пользователь не вошёл.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Первым событием приходит INITIAL_SESSION с сохранённой сессией или null.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p className="center-screen muted">Загрузка…</p>;
  if (!session) return <AuthScreen />;
  // key: при смене пользователя состояние рабочей области сбрасывается целиком.
  return <Workspace key={session.user.id} email={session.user.email ?? ''} />;
}

function Workspace({ email }: { email: string }) {
  const route = useRoute();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>({ query: '', status: 'all' });
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(errorMessage(error));
      setSigningOut(false);
      return;
    }
    navigate('/');
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">
          Заявки на автоматизацию
        </a>
        <div className="account">
          <span className="account-email" title={email}>
            {email}
          </span>
          <button type="button" className="btn btn-ghost" onClick={signOut} disabled={signingOut}>
            Выйти
          </button>
        </div>
      </header>
      <main className="container">
        {route.name === 'list' && <RequestsList filters={filters} onFiltersChange={setFilters} />}
        {route.name === 'new' && <RequestForm />}
        {route.name === 'edit' && <RequestForm key={route.id} id={route.id} />}
      </main>
    </>
  );
}
