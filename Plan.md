# Plan.md — План реализации EnglishBuddy (v1)

> **Назначение.** Рабочий пошаговый план превращения текущего прототипа-чат-бота в обучающую систему по [активной спецификации](thoughts/shared/specs/2026-06-21-englishbuddy-tutor.md). Источник истины по требованиям — спецификация; этот файл — карта исполнения и трекер прогресса.
> **Дата создания:** 2026-06-21. **Статус:** P0 фазы 0–7 готовы; осталась Фаза 8 (полировка + acceptance-gate). Фаза 9 — P1.
> **Как обновлять:** см. раздел [«Механизм автообновления»](#механизм-автообновления). Правило: закрыл задачу → в той же сессии обнови её статус в таблице фазы И в [сводной таблице прогресса](#сводная-таблица-прогресса).

---

## 0. Отправная точка (что уже есть)

Прототип функционально цельный, но архитектурно это «умный ролевой чат-бот», а не обучающая система (см. раздел 2 спецификации). Подтверждено аудитом кода:

| Область | Файл | Состояние | Что не так |
|---|---|---|---|
| Стриминг-прокси | [app/api/chat/route.ts](app/api/chat/route.ts) | ⚠️ работает с дырами | нет auth; `system` принимается от клиента; `max_tokens: 1024` |
| Старт/финиш урока | [app/api/lesson/start/route.ts](app/api/lesson/start/route.ts), [finish/route.ts](app/api/lesson/finish/route.ts) | ⚠️ частично | finish есть auth, но нет SRS/vocabulary/scenario_title-апсерта |
| Промпт урока | [lib/prompts/lesson.ts](lib/prompts/lesson.ts) | ⚠️ устарел | хрупкие маркеры `PHASE:`/`LESSON_COMPLETE:`; коррекция «сразу recast» вместо элицитации |
| Схема БД | [supabase/schema.sql](supabase/schema.sql) | ⚠️ неполная | нет CEFR, SRS, `vocabulary_items`, streak, `syllabus_unit_id`, полей подписки |
| Голос | [app/api/tts/route.ts](app/api/tts/route.ts), [lib/speech/](lib/speech/) | ✅ базово | нужна ревизия fallback/ошибок |
| Онбординг | [app/onboarding/page.tsx](app/onboarding/page.tsx), [lib/prompts/onboarding.ts](lib/prompts/onboarding.ts) | ⚠️ устарел | свободный `level_description`, нет адаптивной CEFR-диагностики |

**Вывод:** не переписываем — расширяем каркас, чиним дыры, достраиваем ядро (решение №2 в CLAUDE.md).

---

## Карта фаз (обзор)

| # | Фаза | Готовое состояние | P0/P1 | Зависит от |
|---|---|---|---|---|
| 0 | Подготовка и миграция данных | БД и секреты готовы под всё ядро | P0 | — |
| 1 | Безопасность API + обработка ошибок LLM | Роуты закрыты, ошибки LLM → русские сообщения | P0 | 0 |
| 2 | Структурированный вывод (tool use) | Фазы/итоги/диагностика без текстовых маркеров | P0 | 1 |
| 3 | CEFR-диагностика и прогресс | ИИ определяет уровень A1–C2, прогресс виден | P0 | 2 |
| 4 | SRS + банк выученного | Фразы/ошибки повторяются по расписанию | P0 | 2 |
| 5 | Силлабус + методика элицитации | Темы не повторяются, коррекция по 5.3, 4 фазы | P0 | 3, 4 |
| 6 | Голос (упрочнение) | TTS/STT с корректными fallback | P0 | 1 |
| 7 | Удержание: streak, прогресс, напоминания | Streak, дневная цель, email-напоминания | P0 | 3, 4 |
| 8 | Полировка и acceptance-gate | Сквозной прогон, a11y, адаптив, чистый build | P0 | все |
| 9 | Монетизация (Stripe/paywall) | Оплата и лимиты | P1 | 0, 8 |

Зависимости в виде графа:

```
0 ─┬─ 1 ─┬─ 2 ─┬─ 3 ─┬─ 5 ── 8 ── 9
   │      │     └─ 4 ─┘     │
   │      └──────── 6 ──────┤
   └──────────────── 7 ─────┘   (7 зависит от 3 и 4)
```

---

## Условные обозначения статусов

`⬜ не начато` · `🟦 в работе` · `✅ готово` · `🟥 заблокировано` · `➖ не входит в v1`

В колонке **«Тест»**: `manual` — ручной чекпойнт; `unit` — unit-тест на чистую функцию; `e2e` — сквозной прогон. (Автотест-фреймворка пока нет — см. CLAUDE.md; для чистых функций SRS/диагностики закладываем unit-тесты при добавлении логики.)

---

## Фаза 0 — Подготовка и миграция данных

**Готовое состояние:** одна миграция БД покрывает всё обучающее ядро и монетизацию (без будущих ломающих миграций — FR-40). Секреты чисты. Локальный запуск работает на новой схеме.

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 0.1 Гигиена секретов: `.env.example` с плейсхолдерами; `.env*` в `.gitignore` и не в индексе git (проверено) | `.env.example`, `.gitignore` | manual | ✅ |
| 0.2 Миграция схемы: расширить `profiles` (cefr_level, cefr_confidence, native_language, goal_track, daily_goal, streak_count, longest_streak, last_active_date, plan, subscription_status, subscription_period_end) | [supabase/schema.sql](supabase/schema.sql), [migrations/0001](supabase/migrations/0001_learning_core.sql) | manual | ✅ |
| 0.3 Новая таблица `vocabulary_items` (+ SRS-поля srs_box, due_at, times_reviewed, last_reviewed_at) | [supabase/schema.sql](supabase/schema.sql), [migrations/0001](supabase/migrations/0001_learning_core.sql) | manual | ✅ |
| 0.4 Расширить `error_memory` SRS-полями (srs_box, due_at) | [supabase/schema.sql](supabase/schema.sql), [migrations/0001](supabase/migrations/0001_learning_core.sql) | manual | ✅ |
| 0.5 Расширить `lesson_sessions` (syllabus_unit_id, cefr_at_lesson; гарантировать `scenario_title`) | [supabase/schema.sql](supabase/schema.sql), [migrations/0001](supabase/migrations/0001_learning_core.sql) | manual | ✅ |
| 0.6 RLS-политика на `vocabulary_items` (`auth.uid() = user_id`), сохранить триггер автопрофиля | [supabase/schema.sql](supabase/schema.sql), [migrations/0001](supabase/migrations/0001_learning_core.sql) | manual | ✅ |
| 0.7 Обновить типы под новую схему | [types/index.ts](types/index.ts) | manual | ✅ |
| 0.8 Применить миграцию в Supabase, проверить Table Editor | [migrations/0001](supabase/migrations/0001_learning_core.sql) | manual | ✅ (4 таблицы отвечают 200 OK) |

**Критерии готовности:** миграция применяется без ошибок; новые поля/таблицы видны в Supabase; регистрация по-прежнему создаёт `profiles` через триггер; `.env.example` содержит только плейсхолдеры; `git status` не показывает `.env`. Раздел «Структура проекта» и `schema.sql` в CLAUDE.md синхронизированы.

**Зависимости:** нет. Это фундамент для фаз 3, 4, 5, 7, 9.

---

## Фаза 1 — Безопасность API + централизованная обработка ошибок LLM

**Готовое состояние:** все API-роуты закрыты авторизацией; системный промпт собирается только на сервере; любая ошибка модели/сети превращается в понятное русское сообщение пользователю и структурированный лог разработчику. ⚠️ **Это узловая фаза для требования заказчика об обработке ошибок LLM** — детали в разделе [«Обработка ошибок LLM»](#обработка-ошибок-llm).

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 1.1 Auth-gate на `/api/chat` и `/api/tts` (`getUser()` → 401) (FR-01) | [app/api/chat/route.ts](app/api/chat/route.ts), [app/api/tts/route.ts](app/api/tts/route.ts) | manual | ✅ (curl → 401 на обоих) |
| 1.2 Сервер собирает `system` сам: `/api/chat` принимает `{ kind, sessionId, messages }`, грузит профиль+память+темы; `system` от клиента игнорируется (FR-02) | [app/api/chat/route.ts](app/api/chat/route.ts) | manual | ✅ |
| 1.3 Поднять `max_tokens` до 2048 (FR-06) | [app/api/chat/route.ts](app/api/chat/route.ts) | manual | ✅ |
| 1.4 **Модуль классификации ошибок LLM** `classifyAiError()` → `{ kind, userMessage(ru), logLevel, retryable, httpStatus }` + каталог сообщений | [lib/ai-errors.ts](lib/ai-errors.ts) | manual* | ✅ |
| 1.5 Протокол ошибок в стриме: до первого токена → HTTP-статус + JSON `{ code, message }`; в середине стрима → управляющий маркер `[[AI_ERROR:kind]]` | [app/api/chat/route.ts](app/api/chat/route.ts), [lib/ai-errors.ts](lib/ai-errors.ts) | manual* | ✅ |
| 1.6 Структурное логирование на сервере (`[AI]` + kind/status/userId/sessionId) без утечки секретов | [lib/ai-errors.ts](lib/ai-errors.ts), роуты | manual | ✅ |
| 1.7 Клиент: баннер с русским сообщением + кнопка «Повторить» (сообщение пользователя уже в БД) | [app/lesson/[id]/page.tsx](app/lesson/[id]/page.tsx), [app/onboarding/page.tsx](app/onboarding/page.tsx) | manual | ✅ |
| 1.8 Ретрай с бэкоффом для `retryable` (429/529/сеть) до первого токена | [app/api/chat/route.ts](app/api/chat/route.ts) | manual* | ✅ |

> \* unit-тесты для `classifyAiError`/стрим-протокола/ретраев запланированы, но test-фреймворк в проекте пока не заведён (см. CLAUDE.md). Проверка выполнена через live-curl (401) + `npm run build`/`lint`. Заведение фреймворка — отдельное решение (предлагается в Фазе 8 или раньше по желанию).

**Критерии готовности:** запрос без сессии → 401 на всех роутах; `system` от клиента игнорируется/не принимается; при искусственно вызванной ошибке (битый ключ, отключённая сеть, mock-429) пользователь видит русское сообщение из каталога, в консоли сервера — структурный лог; build/lint чисто.

**Зависимости:** Фаза 0. Блокирует 2, 6.

---

## Фаза 2 — Структурированный вывод через tool use

**Готовое состояние:** фаза урока, итоги урока и результат диагностики поступают через Anthropic **tool use**, а не текстовые маркеры. Парсинг регулярками `PHASE:`/`LESSON_COMPLETE:`/`ONBOARDING_COMPLETE:` удалён. Ручная кнопка «Завершить урок» сохранена как safety-net (FR-05).

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 2.1 Инструменты: `set_phase`, `complete_lesson` (scenario_title, key_phrases, errors[]), `finish_diagnosis` (goal, level_description, cefr_level, cefr_confidence, goal_track) | [lib/tools.ts](lib/tools.ts) | live-test ✅ | ✅ |
| 2.2 `/api/chat`: передаёт `tools`, обрабатывает `tool_use`-блоки, стримит текст + структуру через фреймы | [app/api/chat/route.ts](app/api/chat/route.ts), [lib/stream-protocol.ts](lib/stream-protocol.ts) | manual | ✅ |
| 2.3 Переписан промпт урока под tool use (порядок: текст → инструмент в конце хода) | [lib/prompts/lesson.ts](lib/prompts/lesson.ts) | live-test ✅ | ✅ |
| 2.4 Переписан промпт онбординга под `finish_diagnosis` | [lib/prompts/onboarding.ts](lib/prompts/onboarding.ts) | manual | ✅ |
| 2.5 Клиент: бейдж фазы (+ «review») и экран завершения из tool-данных, regex-парсинг удалён | [app/lesson/[id]/page.tsx](app/lesson/[id]/page.tsx), [app/onboarding/page.tsx](app/onboarding/page.tsx), [components/PhaseBadge.tsx](components/PhaseBadge.tsx) | manual | ✅ |
| 2.6 `scenario_title` пишется при finish из tool-вывода (FR-03) | [app/api/lesson/finish/route.ts](app/api/lesson/finish/route.ts) | manual | ✅ |
| 2.7 Defensive: битый tool-JSON игнорируется + ручная кнопка «Завершить урок» (safety-net) | [app/lesson/[id]/page.tsx](app/lesson/[id]/page.tsx) | manual | ✅ |

> Архитектурная находка: инструмент нужно вызывать ПОСЛЕ текста (в конце хода) — если вызвать раньше, модель останавливается без текста. Зашито в промпты; проверено живым запросом (`text -> tool_use` за один проход, без лишних вызовов модели).

**Критерии готовности:** в коде нет regex по `PHASE:`/`*_COMPLETE:`; бейдж фазы и завершение работают; после урока в БД заполнен `scenario_title`; при подавлении tool-вызова кнопка «Завершить урок» доводит урок до конца без падения.

**Зависимости:** Фаза 1. Блокирует 3, 4, 5.

---

## Фаза 3 — CEFR-диагностика и прогресс

**Готовое состояние:** ИИ определяет уровень A1–C2 через адаптивную диалоговую диагностику (5.6) без ручного выбора; уровень и его рост видны на dashboard; есть переоценка во времени.

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 3.1 Промпт диагностики: адаптивная сложность 5–8 обменов, оценка по тому КАК отвечает, без стресса (5.6); ручной выбор уровня убран из онбординга | [lib/prompts/onboarding.ts](lib/prompts/onboarding.ts), [app/onboarding/page.tsx](app/onboarding/page.tsx) | manual | ✅ |
| 3.2 Сохранение `cefr_level`/`cefr_confidence`/`goal_track` из `finish_diagnosis` (поля обязательны в инструменте) | [lib/tools.ts](lib/tools.ts), [app/onboarding/page.tsx](app/onboarding/page.tsx) | manual | ✅ |
| 3.3 Dashboard: CEFR-уровень + прогресс-бар A1→C2, «выучено N фраз», счётчики уроков (FR-11) | [app/dashboard/page.tsx](app/dashboard/page.tsx) | manual | ✅ |
| 3.4 История прогресса: снимок `cefr_at_lesson` при завершении урока (FR-10) | [app/api/lesson/finish/route.ts](app/api/lesson/finish/route.ts) | manual | ✅* |
| 3.5 L1/L2-соотношение + i+1 по уровню CEFR в промпте урока (5.4) | [lib/prompts/lesson.ts](lib/prompts/lesson.ts) | manual | ✅ |

> \* Реализован снимок уровня на момент урока (лёгкая история прогресса). Активная переоценка с явным предложением «ты вырос до B1» — **P1** (так и помечено в спецификации, раздел P1).

**Критерии готовности:** новый пользователь проходит диалоговую диагностику → в `profiles` появляется `cefr_level` (любой из A1–C2) + `cefr_confidence`; dashboard показывает уровень и прогресс; уровень не спрашивается «в лоб» и не выбирается вручную.

**Зависимости:** Фаза 2. Блокирует 5, 7.

---

## Фаза 4 — SRS + банк выученного

**Готовое состояние:** выученные фразы сохраняются (FR-04); фразы и ошибки имеют расписание повторов (Leitner); due-элементы предъявляются в фазе Review (FR-12).

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 4.0 Завести test-фреймворк **Vitest** (скрипт `test`) | [package.json](package.json) | — | ✅ |
| 4.1 `lib/srs.ts`: `nextSchedule(box, success)` → `{ box, due_at }`, боксы 1/3/7/16/35 дней + `initialSchedule` | [lib/srs.ts](lib/srs.ts), [lib/srs.test.ts](lib/srs.test.ts) | **unit ✅ (5)** | ✅ |
| 4.2 Апсерт `vocabulary_items` из `complete_lesson` (phrase_en/translation_ru/context/source_lesson_id) + дедуп (FR-04) | [app/api/lesson/finish/route.ts](app/api/lesson/finish/route.ts) | manual | ✅ |
| 4.3 SRS-апдейт `error_memory` (box/due_at) при finish | [app/api/lesson/finish/route.ts](app/api/lesson/finish/route.ts) | manual | ✅ |
| 4.4 Review-очередь: due из `vocabulary_items` + `error_memory`, `due_at <= now()`, сортировка, лимит | [lib/review.ts](lib/review.ts), [lib/review.test.ts](lib/review.test.ts), [app/api/chat/route.ts](app/api/chat/route.ts) | **unit ✅ (4)** | ✅ |
| 4.5 Фаза Review в промпте урока (если есть due — начать с повторения 2–4) (5.5) | [lib/prompts/lesson.ts](lib/prompts/lesson.ts) | manual | ✅ |
| 4.6 Dashboard: счётчик «🔁 К повторению» (due сегодня) | [app/dashboard/page.tsx](app/dashboard/page.tsx) | manual | ✅ |

> Продвижение по SRS при успешном повторении делается на `lesson/finish`: элементы, бывшие due на момент урока, продвигаются на след. бокс; ошибки, повторившиеся в этом уроке, сбрасываются в бокс 1. Бонусом из Фазы 1 закрыт unit-тест-фреймворк (4.0).

**Критерии готовности:** после урока в `vocabulary_items` появляются фразы с переводом и контекстом; `due_at` рассчитывается по Leitner; следующий урок при наличии due начинается с Review; unit-тесты `srs.ts` зелёные (успех→бокс растёт, ошибка→сброс в 1).

**Зависимости:** Фаза 2. Блокирует 5, 7.

---

## Фаза 5 — Силлабус + методика элицитации

**Готовое состояние:** темы не повторяются (силлабус + `scenario_title`); коррекция ошибок по протоколу элицитации (5.3); урок идёт в 4 фазы (5.5).

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 5.1 `lib/syllabus/`: структура юнитов (тема+грамм.фокус+лексика+сценарий) под CEFR и треки work/relocation-conversational (FR-13) | [lib/syllabus/index.ts](lib/syllabus/index.ts) | unit | ✅ |
| 5.2 `selectNextUnit(level, track, completedUnitIds)` → следующий незавершённый юнит | [lib/syllabus/index.ts](lib/syllabus/index.ts), [lib/syllabus/index.test.ts](lib/syllabus/index.test.ts) | **unit ✅ (12)** | ✅ |
| 5.3 Подключить выбор юнита к сборке промпта урока, писать `syllabus_unit_id` (на старте сессии) | [app/api/lesson/start/route.ts](app/api/lesson/start/route.ts), [app/api/chat/route.ts](app/api/chat/route.ts) | manual | ✅ |
| 5.4 Протокол элицитации (сигнал → шанс переформулировать → recast на 2-й неудаче) в промпте (5.3, FR-14) | [lib/prompts/lesson.ts](lib/prompts/lesson.ts) | manual | ✅ |
| 5.5 Полная 4-фазная структура (Review/Presentation/Practice/Wrap-up) в промпте (5.5) | [lib/prompts/lesson.ts](lib/prompts/lesson.ts) | manual | ✅ |
| 5.6 Seed стартовых юнитов A1–A2 для work + relocation/conversational | [lib/syllabus/seed.ts](lib/syllabus/seed.ts) | manual | ✅ |

**Критерии готовности:** два урока подряд не дают одинаковую тему; при ошибке ученика репетитор сначала даёт шанс самому исправиться и только потом recast; в БД пишется `syllabus_unit_id`; unit-тест выбора юнита зелёный.

> Архитектурное решение по 5.3: юнит выбирается и пишется в `lesson_sessions.syllabus_unit_id` **на старте урока** (`/api/lesson/start`), а не на finish — потому что промпт урока пересобирается на каждом ходу в `/api/chat`, и тема должна быть стабильной в рамках сессии. `/api/chat` читает юнит сессии по `getUnitById` и подаёт его в промпт. «Не повторять тему» теперь опирается на id завершённых юнитов (надёжнее, чем на `scenario_title`). Бонус: заведён `vitest.config.ts` с алиасом `@/` — теперь unit-тесты могут импортировать значения из модулей.

**Зависимости:** Фазы 3, 4. Блокирует 8.

---

## Фаза 6 — Голос (упрочнение)

**Готовое состояние:** TTS (ElevenLabs + fallback `speechSynthesis`) и STT (Web Speech, `en-US`) работают с корректной деградацией; превышение квоты ElevenLabs не ломает UI (FR-20–22).

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 6.1 `/api/tts`: нет ключа/квота (401/429) → `{ error: 'tts_unavailable' }`, не 500 (+ guard на битый JSON, dev-лог `[TTS]`) | [app/api/tts/route.ts](app/api/tts/route.ts) | manual | ✅ |
| 6.2 `useTextToSpeech`: ok→audio blob, иначе fallback `speechSynthesis` (`lang='en-US'`); без наложения озвучек, освобождение blob-URL | [lib/speech/useTextToSpeech.ts](lib/speech/useTextToSpeech.ts) | manual | ✅ |
| 6.3 `useSpeechToText`: `isSupported=false` → кнопка микрофона скрыта (FR-21) | [lib/speech/useSpeechToText.ts](lib/speech/useSpeechToText.ts), [components/ChatInput.tsx](components/ChatInput.tsx) | manual | ✅ |
| 6.4 Автоозвучка при `voice_enabled` + ручная «🔊» на каждой реплике (FR-22) | [app/lesson/[id]/page.tsx](app/lesson/[id]/page.tsx), [components/ChatBubble.tsx](components/ChatBubble.tsx) | manual | ✅ |

**Критерии готовности:** в Chrome/Edge микрофон распознаёт английскую речь; «🔊» проигрывает ElevenLabs или браузерный голос; при невалидном ключе ElevenLabs TTS работает через fallback без ошибок в UI; в Firefox кнопка микрофона скрыта, ввод текстом.

> Бо́льшая часть голоса была в каркасе прототипа (auth, fallback, скрытие микрофона, авто-озвучка, ручная «🔊» в [ChatBubble.tsx](components/ChatBubble.tsx)). Упрочнение в этой фазе: `/api/tts` не отдаёт 500 на битый JSON и логирует сбои ElevenLabs (`[TTS]`); `useTextToSpeech` останавливает предыдущую озвучку (нет наложений авто+ручной) и освобождает blob-URL; добавлен экспортируемый `stop()`.

**Зависимости:** Фаза 1.

---

## Фаза 7 — Удержание: streak, прогресс, напоминания

**Готовое состояние:** streak и дневная цель считаются и видны; email-напоминания возвращают пользователя (FR-30–32).

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 7.1 Логика streak (`streak_count`, `longest_streak`, `last_active_date`, дневная цель) | [lib/streak.ts](lib/streak.ts), [lib/streak.test.ts](lib/streak.test.ts), [finish/route.ts](app/api/lesson/finish/route.ts) | **unit ✅ (12)** | ✅ |
| 7.2 Dashboard: streak + дневная цель (FR-30) | [app/dashboard/page.tsx](app/dashboard/page.tsx) | manual | ✅ |
| 7.3 Email-провайдер **Resend** + транзакционный шаблон (gated за `RESEND_API_KEY`) | [lib/email.ts](lib/email.ts), [lib/email.test.ts](lib/email.test.ts) | **unit ✅ (5)** | ✅ |
| 7.4 Cron-роут: выборка пользователей с due/риском потери streak → email (FR-32) | [app/api/cron/reminders/route.ts](app/api/cron/reminders/route.ts), [vercel.json](vercel.json) | manual | ✅ |

**Критерии готовности:** завершение урока инкрементит streak в тот же день и не задваивает; пропуск дня сбрасывает streak по правилу; cron-роут руками отдаёт корректный список адресатов; unit-тесты streak зелёные.

> Решение по 7.3: выбран **Resend** (Open Question 3 спецификации). Отправка включается только при наличии `RESEND_API_KEY` — без ключа `sendReminderEmail` мягко деградирует (лог + false), сборка/локалка не падают. Cron-роут защищён `CRON_SECRET` (Vercel Cron шлёт его в `Authorization`), поддерживает `?dryRun=1` для ручной проверки списка адресатов без отправки; email берутся из `auth.users` через admin API (service_role). Расписание — ежедневно 09:00 UTC ([vercel.json](vercel.json)). Новые env: `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (в `.env.example`). Отбор адресатов вынесен в чистую `selectReminderRecipients` с unit-тестами.

**Зависимости:** Фазы 3, 4.

---

## Фаза 8 — Полировка и acceptance-gate

**Готовое состояние:** проект проходит acceptance-критерии спецификации (разделы 3, 9) и чек-лист CLAUDE.md перед сервером.

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 8.1 a11y: `aria-label` на иконочных кнопках, контраст ≥ 4.5:1 | [globals.css](app/globals.css), dark-страницы, [Loader.tsx](components/Loader.tsx), [lesson/[id]](app/lesson/[id]/page.tsx) | manual | ✅ |
| 8.2 Адаптив 360/768/1280px; sticky-ввод на `/lesson/[id]` | страницы | manual | ✅\* |
| 8.3 `npm run build` и `npm run lint` — чисто | — | manual | ✅ |
| 8.4 Аудит: все `app/api/*` требуют сессию; `system` не принимается от клиента | роуты | manual | ✅ |
| 8.5 Сквозной прогон: регистрация → диагностика → урок (текст+голос) → завершение → dashboard | — | **e2e** | 🟦 трассировка кода ✅, живой прогон за пользователем |
| 8.6 Проверка: `scenario_title`, фразы, SRS, streak, CEFR сохраняются | — | e2e | 🟦 трассировка кода ✅, живой прогон за пользователем |
| 8.7 Деплой Vercel: env в панели, redirect-URL Supabase Auth на боевой домен | — | manual | ⬜ (отложено: нет домена) |

**Критерии готовности:** весь чек-лист «Тестирование» из CLAUDE.md зелёный; сквозной сценарий проходит без технических ошибок в UI; секретов в git нет.

> **Что сделано (8.1–8.4):** контраст — акцент затемнён до `#6D4DF0` (токен + кнопки/заливки тёмной темы; white-on-accent 5.29, accent-on-light 5.04), акцент-текст/бордеры на тёмном → `#a98fff` (7.45); все реальные AA-провалы устранены. aria-label на иконочных кнопках уже были (mic/send/volume/voice-toggle); добавлены `aria-live` на `Loader` и sr-only `<h1>` на урок. auth-аудит: `chat`/`tts`/`lesson/*` → 401 без сессии, `system` только на сервере; `cron/reminders` защищён `CRON_SECRET` (системный job).
> **\*8.2:** адаптивные контейнеры/брейкпоинты на месте, ввод урока закреплён снизу через flex-колонку; визуальная сверка на 3 ширинах — ручной шаг пользователя.
> **8.5/8.6:** пути сохранения прослежены по коду (scenario_title/syllabus_unit_id, vocabulary_items+SRS, error_memory+SRS, streak, cefr) — все записываются в `lesson/finish`/`lesson/start`/онбординге. Живой e2e требует боевых ключей Supabase/Anthropic + браузер → за пользователем.
> **8.7:** деплой отложен (нет домена). Перед проментом: задать `CRON_SECRET` (иначе cron-роут открыт), env в панели Vercel, redirect-URL Supabase Auth.
> Скан a11y отметил отсутствие skip-link/некоторых landmark — большинство ложные (флагует `.css`/`layout`); skip-навигация отложена как minor.

**Зависимости:** все P0-фазы.

---

## Фаза 9 — Монетизация (P1)

**Готовое состояние:** Stripe Checkout + webhooks, paywall, free-tier лимиты, управление подпиской в UI. Поля данных уже заложены в Фазе 0 (FR-40), миграции-ломки не требуется.

| Задача | Файлы | Тест | Статус |
|---|---|---|---|
| 9.1 Stripe Checkout + webhooks (обновление `subscription_status`/`period_end`) | `app/api/stripe/*` (новый) | manual | ➖ P1 |
| 9.2 Paywall + free-tier лимиты | middleware/страницы | manual | ➖ P1 |
| 9.3 Управление подпиской в `/settings` | [app/settings/page.tsx](app/settings/page.tsx) | manual | ➖ P1 |

**Критерии готовности:** оплата проходит в тестовом режиме, статус подписки отражается в `profiles`, лимиты применяются.

**Зависимости:** Фазы 0, 8.

---

## Обработка ошибок LLM

> **Требование заказчика (приоритетное):** если модель вернула ошибку — пользователь видит понятное русское сообщение, **а не технический текст**; разработчик видит структурный лог. Реализуется в Фазе 1, применяется везде, где вызывается Anthropic.

### Принципы
1. **Две аудитории — два канала.** Пользователю — короткое тёплое русское сообщение (в стиле персоны репетитора). Разработчику — структурный лог на сервере с кодом/контекстом. Технические детали (статус, stack, тело ответа) пользователю **не показываем никогда**.
2. **Единая точка классификации** — `lib/ai-errors.ts`, `classifyAiError(error)`. Все роуты, дёргающие модель, проходят через неё.
3. **Сообщение пользователя уже сохранено в БД** до вызова модели → «Повторить» безопасно (идемпотентно).
4. **Стрим: два режима ошибки.** Ошибка *до первого токена* → корректный HTTP-статус + JSON `{ code }`. Ошибка *в середине стрима* → управляющий control-фрейм в конце потока (напр. `\nAI_ERROR:network`), который клиент ловит и заменяет на баннер; уже напечатанный текст остаётся.
5. **Деградация, а не падение.** Сбой tool use → показать текст + ручная кнопка «Завершить урок». Сбой TTS → браузерный голос. Никаких 500 в UI.

### Каталог сообщений (план реализации в `lib/ai-errors.ts`)

| kind | Триггер | Сообщение пользователю (ru) | Лог (level) | retryable |
|---|---|---|---|---|
| `network` | fetch/timeout, обрыв стрима | «Связь прервалась. Твоё сообщение сохранено — нажми «Повторить».» | warn | да |
| `rate_limit` | Anthropic 429 | «Я немного перегружен. Подожди пару секунд и попробуй снова.» | warn | да |
| `overloaded` | Anthropic 529 | «Сервис сейчас загружен. Давай повторим через минутку.» | warn | да |
| `bad_request` | 400 (контекст/токены) | «Что-то пошло не так с этим запросом. Попробуй переформулировать.» | error | нет |
| `auth_config` | 401/403 (ключ/конфиг) | «У нас техническая заминка. Мы уже разбираемся — попробуй позже.» | **critical** | нет |
| `tool_parse` | tool не вызван/битый JSON | *(текст показываем; баннер не нужен)* + кнопка «Завершить урок» | error | нет |
| `empty_refusal` | пустой/отказной ответ | «Кажется, я задумался. Переформулируй, пожалуйста, и попробуем ещё раз.» | warn | да |
| `unknown` | всё прочее | «Ой, что-то сломалось на нашей стороне. Попробуй ещё раз.» | error | да |

### Формат лога разработчика (план)
```
console.error('[AI]', {
  kind, status, retryable,
  sessionId, userId, requestId,   // requestId из заголовка Anthropic
  route: '/api/chat',
  message: err.message,           // без секретов/полного промпта
});
```
- Секреты (`ANTHROPIC_API_KEY`, тело system-промпта) в логи **не попадают**.
- `auth_config` (битый/просроченный ключ) — уровень `critical`: это проблема конфигурации прода, не ошибка пользователя.

**Тесты:** unit на `classifyAiError` (маппинг кода → kind/сообщение/retryable); ручная проверка каждого kind через подмену (битый ключ, отключённая сеть, mock-429, подавление tool-вызова).

---

## Сводная таблица прогресса

> Обновлять после **каждой** закрытой задачи. «План» — целевой объём фазы; «Факт» — что реально сделано; «Блокеры» — что мешает.

| Фаза | План (P0) | Факт | Статус | Блокеры |
|---|---|---|---|---|
| 0 — Подготовка и миграция данных | 8 задач | 8/8 | ✅ готово | — |
| 1 — Безопасность + ошибки LLM | 8 задач | 8/8 | ✅ готово | unit-тесты отложены (нет фреймворка) |
| 2 — Tool use | 7 задач | 7/7 | ✅ готово | — |
| 3 — CEFR-диагностика и прогресс | 5 задач | 5/5 | ✅ готово | явная переоценка уровня → P1 |
| 4 — SRS + банк выученного | 7 задач (вкл. 4.0 Vitest) | 7/7 | ✅ готово | — |
| 5 — Силлабус + элицитация | 6 задач | 6/6 | ✅ готово | — |
| 6 — Голос | 4 задачи | 4/4 | ✅ готово | — |
| 7 — Удержание | 4 задачи | 4/4 | ✅ готово | — |
| 8 — Полировка + acceptance | 7 задач | 4/7 + 2🟦 | 🟦 в работе | 8.5/8.6 живой e2e и 8.7 деплой — за пользователем (нет домена) |
| 9 — Монетизация | — | — | ➖ P1 | после v1 |

**Легенда статуса фазы:** ⬜ не начато · 🟦 в работе · ✅ готово · 🟥 заблокировано · ➖ вне v1.

---

## Механизм автообновления

Этот план обязан оставаться правдивым. Правило: **закрыл задачу → в той же сессии обнови статус.**

| Событие | Что обновить в `Plan.md` |
|---|---|
| Закрыта задача фазы | Статус задачи в таблице фазы + строку фазы в [сводной таблице](#сводная-таблица-прогресса) (Факт `n/N`) |
| Фаза полностью закрыта | Статус фазы → ✅; отметить выполнение критериев готовности |
| Появился блокер | Колонка «Блокеры» в сводной таблице + при необходимости 🟥 |
| Изменились требования | Сначала [спецификация](thoughts/shared/specs/2026-06-21-englishbuddy-tutor.md) (источник истины), затем этот план |
| Изменилась схема/структура | [supabase/schema.sql](supabase/schema.sql) и/или CLAUDE.md (разделы «Структура»/«Tech Stack») в той же сессии |
| Факт важен между сессиями | Память Claude (`memory/`, индекс `MEMORY.md`) |

**Самопроверка в начале сессии:** сверить статусы в `Plan.md` с реальным кодом; при расхождении — сначала исправить план, потом работать. Этот пункт продублирован в CLAUDE.md (раздел «Самообновление»).
