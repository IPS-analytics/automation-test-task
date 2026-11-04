import { STATUSES, type Status } from '../lib/supabase';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{STATUSES[status]}</span>;
}
