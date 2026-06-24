create extension if not exists pgcrypto;

-- profiles: создаётся автоматически после регистрации (триггер на auth.users)
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  goal text,
  level_description text,
  voice_enabled boolean default false,
  -- обучающее ядро (CEFR + прогресс)
  cefr_level text,                    -- 'A1'..'C2', nullable до диагностики
  cefr_confidence text,               -- low | medium | high
  native_language text default 'ru',
  goal_track text,                    -- work | relocation | conversational | general
  -- удержание (streak / дневная цель)
  daily_goal int default 1,
  streak_count int default 0,
  longest_streak int default 0,
  last_active_date date,
  -- монетизация (только модель данных в v1)
  plan text default 'free',
  subscription_status text default 'none',
  subscription_period_end timestamptz,
  created_at timestamptz default now()
);

-- vocabulary_items: банк выученных фраз + SRS (Leitner)
create table vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  phrase_en text not null,
  translation_ru text,
  context text,                       -- пример употребления/сценарий
  source_lesson_id uuid,
  srs_box int default 1,              -- Leitner box
  due_at timestamptz default now(),
  times_reviewed int default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- error_memory: конкретные повторяющиеся ошибки пользователя (+ SRS, чтобы тоже повторялись)
create table error_memory (
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

-- lesson_sessions: история уроков
create table lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scenario_title text,                -- обязательно заполнять при finish (FR-03)
  syllabus_unit_id text,              -- какой юнит силлабуса пройден
  cefr_at_lesson text,                -- срез уровня на момент урока
  messages jsonb not null default '[]',
  status text default 'in_progress',
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Row Level Security
alter table profiles enable row level security;
alter table vocabulary_items enable row level security;
alter table error_memory enable row level security;
alter table lesson_sessions enable row level security;

create policy "users manage own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own vocabulary" on vocabulary_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own error memory" on error_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own lesson sessions" on lesson_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Автосоздание профиля при регистрации
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
