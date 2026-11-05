import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** false, если приложение собрано без переменных окружения Supabase. */
export const isConfigured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost', key || 'not-configured');

// В базе хранятся коды, в интерфейсе — подписи.
export const CATEGORIES = { bot: 'Бот', integration: 'Интеграция', report: 'Отчёт', other: 'Другое' } as const;
export const STATUSES = { new: 'Новая', in_progress: 'В работе', done: 'Завершена' } as const;

export type Category = keyof typeof CATEGORIES;
export type Status = keyof typeof STATUSES;

export interface AutomationRequest {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  created_at: string;
  updated_at: string;
}
