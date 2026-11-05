import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CATEGORIES, STATUSES, supabase, type AutomationRequest, type Category, type Status } from '../lib/supabase';
import { errorMessage } from '../lib/errors';
import { navigate } from '../lib/router';
import { useToast } from './Toasts';
import { formatDate } from './ui';

interface Values {
  title: string;
  description: string;
  category: Category | '';
  status: Status;
}
type FieldName = 'title' | 'description' | 'category';
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY: Values = { title: '', description: '', category: '', status: 'new' };

function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.title.trim()) errors.title = 'Укажите название';
  if (!values.description.trim()) errors.description = 'Опишите задачу';
  if (!values.category) errors.category = 'Выберите категорию';
  return errors;
}

/** Без id — создание заявки, с id — просмотр и редактирование своей заявки. */
export function RequestForm({ id }: { id?: string }) {
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'ready' | 'not-found' | 'error'>(id ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [request, setRequest] = useState<AutomationRequest | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  // Синхронный флаг: второй клик до перерисовки кнопки тоже не отправит запрос.
  const savingRef = useRef(false);
  // id новой заявки генерируется один раз: если ответ на первую отправку потерялся,
  // повторная отправка упрётся в первичный ключ и не создаст дубль.
  const [newId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== '22P02') {
          setLoadError(errorMessage(error));
          setLoad('error');
        } else if (!data) {
          // Чужая заявка для RLS не существует — ответ тот же, что для несуществующей.
          setLoad('not-found');
        } else {
          setRequest(data);
          setValues({ title: data.title, description: data.description, category: data.category, status: data.status });
          setLoad('ready');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    const firstInvalid = (['title', 'description', 'category'] as const).find((f) => fieldErrors[f]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    const fields = { title: values.title.trim(), description: values.description.trim(), category: values.category };
    try {
      if (id) {
        const { data, error } = await supabase
          .from('requests')
          .update({ ...fields, status: values.status })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (data.length === 0) throw { code: 'PGRST116' };
        toast.success('Изменения сохранены');
      } else {
        const { error } = await supabase.from('requests').insert({ id: newId, ...fields });
        if (error?.code === '23505') {
          // Заявку уже сохранила предыдущая попытка, ответ на которую потерялся, — записываем актуальные поля.
          const { data, error: updateError } = await supabase.from('requests').update(fields).eq('id', newId).select('id');
          if (updateError) throw updateError;
          if (data.length === 0) throw error;
        } else if (error) {
          throw error;
        }
        toast.success('Заявка создана');
      }
      navigate('/');
    } catch (err) {
      setSaveError(errorMessage(err));
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (load === 'loading') return <p className="state muted">Загрузка заявки…</p>;
  if (load === 'not-found' || load === 'error') {
    return (
      <div className="state">
        <p className={load === 'error' ? 'form-error' : undefined} role="alert">
          {load === 'error' ? loadError : 'Заявка не найдена или у вас нет к ней доступа.'}
        </p>
        {load === 'error' && (
          <button type="button" className="btn" onClick={() => { setLoad('loading'); setAttempt((n) => n + 1); }}>
            Повторить
          </button>
        )}
        <a className="btn btn-ghost" href="#/">
          К списку заявок
        </a>
      </div>
    );
  }

  return (
    <section>
      <a className="back" href="#/">
        ← Все заявки
      </a>
      <h1>{id ? 'Заявка' : 'Новая заявка'}</h1>
      {request && (
        <p className="muted small">
          Создана {formatDate(request.created_at)}
          {request.updated_at !== request.created_at && ` · изменена ${formatDate(request.updated_at)}`}
        </p>
      )}

      <form className="panel" onSubmit={submit} noValidate>
        <fieldset className="form-body" disabled={saving}>
          {id ? (
            <fieldset className="segmented">
              <legend>Статус</legend>
              <div className="segmented-options">
                {Object.entries(STATUSES).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="status"
                      value={value}
                      checked={values.status === value}
                      onChange={() => set('status', value as Status)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="hint">Новая заявка получает статус «Новая». Менять его можно после создания.</p>
          )}

          <FormField id="title" label="Название" error={errors.title}>
            <input
              id="title"
              value={values.title}
              maxLength={200}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
              onChange={(e) => set('title', e.target.value)}
            />
          </FormField>

          <FormField id="description" label="Описание задачи" error={errors.description}>
            <textarea
              id="description"
              rows={6}
              value={values.description}
              maxLength={5000}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'description-error' : undefined}
              onChange={(e) => set('description', e.target.value)}
            />
          </FormField>

          <FormField id="category" label="Категория" error={errors.category}>
            <select
              id="category"
              value={values.category}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={errors.category ? 'category-error' : undefined}
              onChange={(e) => set('category', e.target.value as Category)}
            >
              <option value="" disabled>
                Выберите категорию
              </option>
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}

          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-busy={saving}>
              {saving ? 'Сохранение…' : id ? 'Сохранить изменения' : 'Создать заявку'}
            </button>
            <a className="btn btn-ghost" href="#/">
              Отмена
            </a>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function FormField({ id, label, error, children }: { id: FieldName; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
