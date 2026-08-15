# EnglishBuddy

**ИИ-репетитор английского языка, который ведёт живой урок и действительно учит — а не просто болтает.**

🔗 **Демо:** [englishbuddy-vert.vercel.app](https://englishbuddy-vert.vercel.app)

Интерфейс на русском, язык обучения — английский. Продукт для самостоятельного изучения: пользователь проходит диалоговую диагностику уровня, затем занимается уроками, которые подстраиваются под его цель (работа, переезд, учёба, путешествия).

---

## Чем отличается от «чата с ИИ»

Обычный языковой чат-бот не помнит, что вы уже проходили, и не возвращается к вашим ошибкам. Здесь под диалогом лежит обучающее ядро:

| Механика | Что делает |
|---|---|
| **CEFR-диагностика** | Модель сама определяет уровень A1–C2 в диалоговом онбординге, без анкет и тестов |
| **Силлабус** | Темы уроков берутся из юнитов «CEFR × трек», пройденные не повторяются |
| **SRS (Leitner)** | Выученные фразы и допущенные ошибки возвращаются на повторение по интервальному расписанию |
| **Память об ошибках** | Повторные ошибки распознаются и отрабатываются адресно |
| **Фазы урока** | `review → explanation → practice → summary`, видны пользователю бейджем |
| **Streak и напоминания** | Серия дней, дневная цель, email-напоминания по крону |

Методика («обученность» репетитора) реализована промпт-инжинирингом в [`lib/prompts/`](lib/prompts/), без файн-тюнинга — это сознательное архитектурное решение: дёшево, гибко и управляемо.

## Стек

| Слой | Технология |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Язык | TypeScript 5 (strict) |
| Стили | Tailwind CSS v4, тёмная тема |
| ИИ | `@anthropic-ai/sdk`, модель `claude-sonnet-4-6`, стриминг + tool use |
| БД / Auth | Supabase (Postgres + Auth + RLS) через `@supabase/ssr` |
| Голос | ElevenLabs TTS + Web Speech API STT (с fallback на `speechSynthesis`) |
| Email | Resend + Vercel Cron |
| Тесты | Vitest — 62 юнит-теста на обучающем ядре |
| Деплой | Vercel |

## Архитектура

```
Браузер (ru UI) — стриминг fetch + reader, бейдж фазы, голос
  │
  ▼
middleware.ts — refresh Supabase-сессии
  │
  ▼
Route Handlers (app/api/*) — все auth-gated
  ├─ /api/chat            → промпты + профиль + память + силлабус → Anthropic (стрим)
  ├─ /api/lesson/start    → создание сессии, выбор юнита силлабуса
  ├─ /api/lesson/finish   → апсерт словаря/ошибок + SRS + streak
  ├─ /api/tts             → ElevenLabs
  └─ /api/cron/reminders  → Vercel Cron, email-напоминания
  │
  ▼
Supabase Postgres (RLS: auth.uid() = user_id)
```

Два решения, на которые стоит обратить внимание при чтении кода:

**System-промпт собирается только на сервере.** Клиент не может его передать или подменить — иначе методику можно было бы обойти одним запросом из консоли.

**Структурированный вывод через Anthropic tool use.** Фаза урока, итоги и результат диагностики приходят как валидируемые вызовы инструментов ([`lib/tools.ts`](lib/tools.ts)), а не текстовыми маркерами вроде `PHASE:` с разбором регулярками. Это убирает целый класс багов парсинга стрима.

## Структура

```
app/
  api/{chat,lesson,tts,cron}/   # route handlers
  onboarding/                   # диалоговая CEFR-диагностика
  lesson/[id]/                  # экран урока
  dashboard/                    # прогресс, streak, история
lib/
  prompts/                      # методика репетитора
  syllabus/                     # юниты CEFR × трек, выбор следующей темы
  srs.ts, review.ts             # интервальные повторения
  streak.ts, email.ts           # удержание
  tools.ts, stream-protocol.ts  # tool use + протокол стрима
supabase/
  schema.sql, migrations/       # таблицы, RLS, триггеры
```

## Локальный запуск

```bash
git clone https://github.com/Bahar01-dev/englishbuddy.git
cd englishbuddy
npm install
cp .env.example .env    # заполнить своими ключами
npm run dev             # → http://localhost:3000
```

Схему БД накатить из [`supabase/schema.sql`](supabase/schema.sql) и [`supabase/migrations/`](supabase/migrations/) в свой проект Supabase.

### Переменные окружения

Все ключи перечислены в [`.env.example`](.env.example). Обязательные:

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Клиент Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверные операции и крон |
| `ANTHROPIC_API_KEY` | Диалог с моделью |
| `ELEVENLABS_API_KEY` | Озвучка |

Опциональные: `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` — без них email-напоминания просто отключаются.

> `.env` в `.gitignore` и никогда не попадал в историю репозитория. В `.env.example` только плейсхолдеры.

## Команды

```bash
npm run dev      # дев-сервер
npm test         # Vitest (62 теста)
npm run build    # продакшн-сборка
npm run lint     # ESLint
```

## Статус

v1: фазы 0–7 готовы (безопасность API, tool use, CEFR-диагностика, SRS, силлабус, голос, удержание). В работе фаза 8 — полировка и acceptance-gate. Монетизация (Stripe) заложена в модель данных, но вынесена в P1.

Известный техдолг открыто ведётся в [`roadmap.md`](roadmap.md).
