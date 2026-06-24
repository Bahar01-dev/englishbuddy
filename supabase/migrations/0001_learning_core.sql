-- Миграция 0001 — обучающее ядро (CEFR + SRS + силлабус) + монетизация (модель данных)
-- САМОДОСТАТОЧНА и ИДЕМПОТЕНТНА: работает и на ПУСТОЙ базе (создаст всё с нуля),
-- и на базе со СТАРЫМИ таблицами (просто добавит новые поля, данные не теряются).
-- Можно выполнять повторно без вреда. Применять в Supabase → SQL Editor.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 1. Базовые таблицы (создаются, только если их ещё нет)
-- ─────────────────────────────────────────────────────────────

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  goal text,
  level_description text,
  voice_enabled boolean default false,
  cefr_level text,
  cefr_confidence text,
  native_language text default 'ru',
  goal_track text,
  daily_goal int default 1,
  streak_count int default 0,
  longest_streak int default 0,
  last_active_date date,
  plan text default 'free',
  subscription_status text default 'none',
  subscription_period_end timestamptz,
  created_at timestamptz default now()
);

create table if not exists error_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  description text not null,
  topic text,
  times_seen int default 1,
  last_reviewed_at timestamptz default now(),
  srs_box int default 1,
  due_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scenario_title text,
  syllabus_unit_id text,
  cefr_at_lesson text,
  messages jsonb not null default '[]',
  status text default 'in_progress',
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  phrase_en text not null,
  translation_ru text,
  context text,
  source_lesson_id uuid,
  srs_box int default 1,
  due_at timestamptz default now(),
  times_reviewed int default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Новые поля для СТАРЫХ таблиц (если таблицы уже существовали)
--    На свежесозданных таблицах это просто no-op.
-- ─────────────────────────────────────────────────────────────

alter table profiles add column if not exists cefr_level text;
alter table profiles add column if not exists cefr_confidence text;
alter table profiles add column if not exists native_language text default 'ru';
alter table profiles add column if not exists goal_track text;
alter table profiles add column if not exists daily_goal int default 1;
alter table profiles add column if not exists streak_count int default 0;
alter table profiles add column if not exists longest_streak int default 0;
alter table profiles add column if not exists last_active_date date;
alter table profiles add column if not exists plan text default 'free';
alter table profiles add column if not exists subscription_status text default 'none';
alter table profiles add column if not exists subscription_period_end timestamptz;

alter table error_memory add column if not exists srs_box int default 1;
alter table error_memory add column if not exists due_at timestamptz default now();

alter table lesson_sessions add column if not exists scenario_title text;
alter table lesson_sessions add column if not exists syllabus_unit_id text;
alter table lesson_sessions add column if not exists cefr_at_lesson text;

-- ─────────────────────────────────────────────────────────────
-- 3. Row Level Security (включение идемпотентно)
-- ─────────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table error_memory enable row level security;
alter table lesson_sessions enable row level security;
alter table vocabulary_items enable row level security;

drop policy if exists "users manage own profile" on profiles;
create policy "users manage own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own error memory" on error_memory;
create policy "users manage own error memory" on error_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own lesson sessions" on lesson_sessions;
create policy "users manage own lesson sessions" on lesson_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own vocabulary" on vocabulary_items;
create policy "users manage own vocabulary" on vocabulary_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Автосоздание профиля при регистрации (идемпотентно)
-- ─────────────────────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
