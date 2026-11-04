import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/errors';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setNotice('');

    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Проверьте адрес электронной почты.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }

    setPending(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) setError(errorMessage(error));
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) {
        setError(errorMessage(error));
      } else if (!data.session) {
        // Включено подтверждение email: сессии нет, пока пользователь не перейдёт по ссылке.
        // Пустой identities означает, что адрес уже зарегистрирован.
        if (data.user?.identities?.length === 0) {
          setError('Пользователь с таким email уже зарегистрирован. Войдите.');
        } else {
          setNotice(`Письмо для подтверждения отправлено на ${address}. Перейдите по ссылке и войдите.`);
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="center-screen">
      <div className="panel auth">
        <h1>Заявки на автоматизацию</h1>
        <p className="muted">Оставьте заявку и следите за её статусом.</p>

        <div className="tabs" role="tablist" aria-label="Вход или регистрация">
          <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => switchMode('signin')}>
            Вход
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchMode('signup')}>
            Регистрация
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && <span className="hint">Не меньше 6 символов</span>}
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Подождите…' : mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </main>
  );
}
