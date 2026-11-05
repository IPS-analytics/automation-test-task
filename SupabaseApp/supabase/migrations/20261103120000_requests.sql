-- Заявки на автоматизацию.
-- Доступ ограничен на уровне базы: RLS пускает пользователя только к его строкам,
-- права на колонки не дают подменить автора, статус при создании и даты.

create table public.requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Длина считается по сохраняемому значению; строка из одних пробелов не проходит.
  title       text not null check (char_length(title) between 1 and 200 and title ~ '[^[:space:]]'),
  description text not null check (char_length(description) between 1 and 5000 and description ~ '[^[:space:]]'),
  category    text not null check (category in ('bot', 'integration', 'report', 'other')),
  status      text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index requests_user_id_created_at_idx on public.requests (user_id, created_at desc);

-- updated_at выставляет база, а не клиент.
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger requests_set_updated_at
  before update on public.requests
  for each row execute function public.set_updated_at();

alter table public.requests enable row level security;

create policy requests_select_own on public.requests
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy requests_insert_own on public.requests
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy requests_update_own on public.requests
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Удаления в интерфейсе нет: политики DELETE нет, и RLS его запрещает.

-- Анонимам доступа нет. При создании клиент передаёт только id (ключ идемпотентности),
-- название, описание и категорию: user_id = auth.uid() и status = 'new' ставят значения по умолчанию.
revoke all on table public.requests from anon, authenticated;
grant select on table public.requests to authenticated;
grant insert (id, title, description, category) on table public.requests to authenticated;
grant update (title, description, category, status) on table public.requests to authenticated;
