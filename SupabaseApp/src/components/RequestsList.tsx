import { useEffect, useState } from 'react';
import { CATEGORIES, STATUSES, supabase, type AutomationRequest, type Status } from '../lib/supabase';
import { errorMessage } from '../lib/errors';
import { StatusBadge, formatDate } from './ui';

export interface Filters {
  query: string;
  status: Status | 'all';
}

type Item = Pick<AutomationRequest, 'id' | 'title' | 'category' | 'status' | 'created_at'>;

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function RequestsList({ filters, onFiltersChange }: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // RLS отдаёт только заявки текущего пользователя — фильтр по user_id не нужен.
    supabase
      .from('requests')
      .select('id, title, category, status, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(errorMessage(error));
        else setItems(data);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setError('');
    setAttempt((n) => n + 1);
  }

  // Заявок у одного сотрудника немного, поэтому поиск и фильтр работают на клиенте мгновенно.
  const query = filters.query.trim().toLowerCase();
  const visible = (items ?? []).filter(
    (r) => (filters.status === 'all' || r.status === filters.status) && r.title.toLowerCase().includes(query),
  );
  const isFiltered = query !== '' || filters.status !== 'all';

  function body() {
    if (error) {
      return (
        <div className="state">
          <p className="form-error" role="alert">
            {error}
          </p>
          <button type="button" className="btn" onClick={retry}>
            Повторить
          </button>
        </div>
      );
    }
    if (items === null) return <p className="state muted">Загрузка…</p>;
    if (items.length === 0) {
      return (
        <div className="state">
          <p>У вас пока нет заявок.</p>
          <a className="btn btn-primary" href="#/new">
            Создать первую заявку
          </a>
        </div>
      );
    }
    if (visible.length === 0) {
      return (
        <div className="state">
          <p>По вашему запросу ничего не найдено.</p>
          <button type="button" className="btn" onClick={() => onFiltersChange({ query: '', status: 'all' })}>
            Сбросить фильтры
          </button>
        </div>
      );
    }
    return (
      <ul className="cards">
        {visible.map((r) => (
          <li key={r.id}>
            <a className="card" href={`#/requests/${r.id}`}>
              <span className="card-title">{r.title}</span>
              <StatusBadge status={r.status} />
              <span className="card-meta">
                {CATEGORIES[r.category]} · {formatDate(r.created_at)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Мои заявки</h1>
          {items && items.length > 0 && (
            <p className="muted small">{isFiltered ? `Найдено ${visible.length} из ${items.length}` : `Всего ${items.length}`}</p>
          )}
        </div>
        <a className="btn btn-primary" href="#/new">
          + Новая заявка
        </a>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Поиск по названию"
          aria-label="Поиск по названию"
          value={filters.query}
          onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
        />
        <select
          aria-label="Фильтр по статусу"
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as Filters['status'] })}
        >
          <option value="all">Все статусы</option>
          {Object.entries(STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {body()}
    </section>
  );
}
