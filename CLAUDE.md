# CLAUDE.md — EnglishBuddy

> Цель файла: дать Claude ориентир в проекте в **каждой новой сессии**. Держать ≤ 200 строк, актуальным и правдивым. Правила обновления — в конце.

## О проекте
EnglishBuddy — ИИ-репетитор английского языка для **B2C-самообучения** (интерфейс на русском, цель обучения — английский). Ведёт живой диалоговый урок и реально *учит* через зашитую методику, привязку к CEFR, интервальные повторения и память об ошибках — а не просто болтает. Делается для основателя (первый юзер: A1–A2, цель работа + переезд), с прицелом на монетизацию подпиской.

## Структура проекта
```
EnglishBuddy/
├── app/
│   ├── api/
│   │   ├── chat/route.ts            # стриминг-прокси к Claude (ядро диалога)
│   │   ├── lesson/start/route.ts    # создание сессии + выбор юнита силлабуса (syllabus_unit_id)
│   │   ├── lesson/finish/route.ts   # апсерт vocab/ошибок + SRS + streak, завершение
│   │   ├── tts/route.ts             # ElevenLabs TTS-прокси
│   │   └── cron/reminders/route.ts  # Vercel Cron: email-напоминания (FR-32, service_role)
│   ├── onboarding/page.tsx          # диалоговая диагностика уровня
│   ├── dashboard/page.tsx           # кабинет: уроки, прогресс, streak
│   ├── lesson/[id]/page.tsx         # экран урока (стриминг, фазы, голос)
│   ├── login | register | settings/page.tsx
│   ├── layout.tsx, page.tsx, globals.css
├── components/                      # ChatBubble, ChatInput, LessonCard, PhaseBadge,
│                                    # VoiceToggle, Loader, Logo, StartLessonButton, SignOutButton
├── lib/
│   ├── claude.ts                    # клиент Anthropic + MODEL (claude-sonnet-4-6)
│   ├── prompts/{persona,lesson,onboarding}.ts   # МЕТОДИКА репетитора («обученность»)
│   ├── syllabus/{index,seed}.ts     # юниты CEFR×трек + selectNextUnit (тема урока, без повторов)
│   ├── srs.ts, review.ts            # Leitner-расписание + очередь повторения (Фаза 4)
│   ├── streak.ts                    # серия дней + дневная цель + риск потери (Фаза 7)
│   ├── email.ts                     # Resend-напоминания + отбор адресатов (Фаза 7)
│   ├── tools.ts, stream-protocol.ts, ai-errors.ts   # tool use + протокол стрима + ошибки LLM
│   ├── speech/{useTextToSpeech,useSpeechToText}.ts
│   ├── supabase/{client,server}.ts  # SSR-клиенты
│   └── errors.ts                    # перевод ошибок Supabase Auth → ru
├── types/index.ts                   # Profile, LessonSession, ChatMessage, ErrorMemoryItem…
├── supabase/schema.sql              # таблицы + RLS + триггер профиля
├── middleware.ts                    # refresh Supabase-сессии
├── thoughts/shared/specs/2026-06-21-englishbuddy-tutor.md   # ★ АКТИВНАЯ СПЕЦИФИКАЦИЯ v1
├── Plan.md                          # ★ план реализации: фазы 0–9, прогресс, обработка ошибок LLM
└── research.md                      # ⚠ исследование ЛЕНДИНГА-ПОРТФОЛИО, НЕ репетитора
```

## Tech Stack
| Слой | Технология | Заметки |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | `runtime='nodejs'`, `maxDuration=60` для стриминга |
| Язык | TypeScript 5 | strict |
| Стили | Tailwind CSS v4 | тёмная тема `#0e0b1a`, акцент `#6D4DF0` (AA-контраст; текст на тёмном — `#a98fff`), шрифт Inter |
| ИИ | `@anthropic-ai/sdk` | модель `claude-sonnet-4-6`, стриминг, цель — tool use |
| БД/Auth | Supabase (Postgres + Auth + RLS) | `@supabase/ssr` |
| Голос | ElevenLabs TTS + Web Speech API STT | fallback на `speechSynthesis` / текст |
| Email | Resend (HTTP API) | напоминания (FR-32); gated за `RESEND_API_KEY`, cron на Vercel |
| Иконки | lucide-react | |
| Деплой | Vercel (план) | env-переменные в панели хостинга |

## Архитектура
```
User (браузер, ru UI)
  │  page.tsx (client) — стриминг fetch + reader, бейдж фазы, голос
  ▼
middleware.ts (refresh сессии)
  ▼
Route Handlers (app/api/*)  ── auth-gated, system-промпт собирается ТОЛЬКО на сервере
  ├─ /api/chat    → lib/prompts/* + профиль + память + силлабус → Anthropic (стрим)
  ├─ /api/lesson/start|finish → Supabase (sessions, vocabulary, error_memory, SRS, streak)
  └─ /api/tts     → ElevenLabs
  ▼
Supabase Postgres (RLS: auth.uid() = user_id) + Anthropic / ElevenLabs (внешние API)
```

## 5 ключевых решений и почему
1. **«Обученность» = методика в промптах, без fine-tuning.** Дёшево, гибко, управляемо; промпт-инжиниринг даёт ~90% результата. Методика живёт в `lib/prompts/*` (см. раздел 5 спецификации).
2. **Расширяем существующий каркас, не переписываем.** Каркас рабочий (онбординг→урок→память→голос); быстрее к результату, чиним дыры поверх.
3. **Структурированный вывод через Anthropic tool use** (целевое, заменяет хрупкие текстовые маркеры `PHASE:`/`LESSON_COMPLETE:`). Убирает целый класс багов парсинга. До миграции — defensive-парсинг + ручная кнопка «Завершить урок».
4. **Обучающее ядро = CEFR + SRS + силлабус.** Уровень определяет сам ИИ (диагностика, A1–C2); выученное и ошибки идут в интервальные повторения (Leitner); темы — из силлабуса, без повторов. Это превращает чат-бота в обучающую систему.
5. **Подписка заложена в модель данных, оплата — позже (P1).** Поля `plan`/`subscription_*`/лимиты в схеме; Stripe/paywall не строим в v1, но включаем без миграции-ломки.

## Тестирование
- **Сейчас автотестов НЕТ** (нет test-фреймворка). Проверка — через критерии готовности фаз в `Plan.md` и acceptance-критерии спецификации (раздел 3, 7).
- При добавлении логики (SRS, диагностика, апсерт памяти) — закладывать unit-тесты на чистые функции (`lib/srs.ts`, сопоставление ошибок в `lesson/finish`).
- **Чек-лист перед сервером:**
  - [ ] `npm run build` и `npm run lint` — чисто
  - [ ] Все `app/api/*` требуют сессию (401 без auth); system-промпт НЕ принимается от клиента
  - [ ] Секреты не в git; `.env` в `.gitignore`, `.env.example` — плейсхолдеры
  - [ ] Сквозной прогон: регистрация → диагностика → урок (текст+голос) → завершение → dashboard
  - [ ] `scenario_title` и выученные фразы сохраняются в БД
  - [ ] Адаптив 360/768/1280px; aria-label на иконочных кнопках

## Документация
| Файл | Что содержит | Когда обновлять |
|---|---|---|
| `CLAUDE.md` (этот) | Карта проекта, стек, решения, команды | При смене стека/структуры/ключевых решений |
| `thoughts/shared/specs/2026-06-21-englishbuddy-tutor.md` | Требования, методика, модель данных, P0/P1/P2 | При изменении требований/scope — **источник истины** |
| `Plan.md` | Фазы 0–9, задачи, обработка ошибок LLM, таблица прогресса | После каждой закрытой задачи/фазы |
| `thoughts/shared/e2e-checklist.md` | Ручной e2e-прогон (acceptance-gate 8.5/8.6) | При изменении флоу/ядра; вести «Журнал прогона» |
| `supabase/schema.sql` | Схема БД, RLS, триггеры | При любой смене модели данных |
| `research.md` | ⚠ Исследование лендинга-портфолио (НЕ репетитора) | Не использовать для продукта-репетитора |
| `~/.claude/.../memory/` | Кросс-сессионные факты и решения | Через механизм памяти Claude |

## Commands
```bash
npm run dev      # дев-сервер → http://localhost:3000
npm run build    # продакшн-сборка (прогнать перед деплоем)
npm run lint     # ESLint
npm run start    # запуск собранного приложения
# Деплой: Vercel; env-переменные задать в панели; проверить redirect-URL Supabase Auth на боевой домен
```
**Env (`.env`, не коммитить):** `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.

## Самообновление (механизм поддержания актуальности)
Claude обязан держать документацию в синхроне с кодом. Правило: **«поменял X → обнови Y в той же сессии».**

| Изменение в коде | Обнови |
|---|---|
| Новые папки/модули/роуты | «Структура проекта» + «Архитектура» в этом файле |
| Смена библиотеки/модели/версии | «Tech Stack» здесь |
| Архитектурное решение | «5 ключевых решений» здесь + спецификация |
| Изменение требований/scope | Спецификация (источник истины), затем сверить этот файл |
| Изменение таблиц/RLS | `supabase/schema.sql` + раздел 8 спецификации |
| Факт, важный между сессиями | Память Claude (`memory/`, индекс `MEMORY.md`) |

**Самопроверка в начале сессии:** свериться, что разделы «Структура» и «Tech Stack» совпадают с реальными файлами/`package.json`; при расхождении — сначала исправить CLAUDE.md, потом работать. **Лимит файла — 200 строк:** при росте выносить детали в спецификацию, здесь оставлять только карту-ориентир.
