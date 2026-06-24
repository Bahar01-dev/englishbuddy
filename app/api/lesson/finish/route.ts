import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { nextSchedule, initialSchedule } from "@/lib/srs";
import { applyLessonCompletion } from "@/lib/streak";
import type {
  ErrorMemoryItem,
  LessonCompletionError,
  VocabularyItem,
} from "@/types";

interface FinishRequestBody {
  sessionId: string;
  scenarioTitle?: string | null;
  keyPhrases: string[];
  errors: LessonCompletionError[];
}

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/i)
      .filter((word) => word.length > 3)
  );
}

function overlapRatio(a: string, b: string): number {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let common = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) common++;
  }

  return common / Math.min(wordsA.size, wordsB.size);
}

// «english phrase — перевод» → { en, ru }
function splitPhrase(s: string): { en: string; ru: string | null } {
  const parts = s.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    return { en: parts[0].trim(), ru: parts.slice(1).join(" - ").trim() || null };
  }
  return { en: s.trim(), ru: null };
}

export async function POST(request: Request) {
  const { sessionId, scenarioTitle, keyPhrases, errors } =
    (await request.json()) as FinishRequestBody;

  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  const userId = userData.user.id;
  const now = new Date();
  const nowIso = now.toISOString();

  // Снимок текущего уровня + поля streak'а (FR-10, FR-30)
  const { data: profileSnapshot } = await supabase
    .from("profiles")
    .select("cefr_level, streak_count, longest_streak, last_active_date")
    .eq("user_id", userId)
    .single();

  // ── Streak (FR-30): обновляем серию при завершении урока (без задвоения за день) ──
  const streak = applyLessonCompletion(
    {
      streak_count: profileSnapshot?.streak_count ?? 0,
      longest_streak: profileSnapshot?.longest_streak ?? 0,
      last_active_date: profileSnapshot?.last_active_date ?? null,
    },
    now
  );
  await supabase
    .from("profiles")
    .update({
      streak_count: streak.streak_count,
      longest_streak: streak.longest_streak,
      last_active_date: streak.last_active_date,
    })
    .eq("user_id", userId);

  // FR-03: записываем scenario_title при завершении (если модель его передала)
  const sessionUpdate: {
    status: string;
    completed_at: string;
    scenario_title?: string;
    cefr_at_lesson?: string;
  } = { status: "completed", completed_at: nowIso };
  if (scenarioTitle) sessionUpdate.scenario_title = scenarioTitle;
  if (profileSnapshot?.cefr_level)
    sessionUpdate.cefr_at_lesson = profileSnapshot.cefr_level;

  await supabase
    .from("lesson_sessions")
    .update(sessionUpdate)
    .eq("id", sessionId)
    .eq("user_id", userId);

  // ── FR-04: сохраняем выученные фразы в банк (vocabulary_items) с SRS ──
  if (Array.isArray(keyPhrases) && keyPhrases.length > 0) {
    const { data: existingVocab } = await supabase
      .from("vocabulary_items")
      .select("phrase_en")
      .eq("user_id", userId);

    const known = new Set(
      ((existingVocab || []) as Pick<VocabularyItem, "phrase_en">[]).map((v) =>
        v.phrase_en.toLowerCase()
      )
    );

    const toInsert = keyPhrases
      .map(splitPhrase)
      .filter((p) => p.en && !known.has(p.en.toLowerCase()))
      .map((p) => {
        const sched = initialSchedule(now);
        return {
          user_id: userId,
          phrase_en: p.en,
          translation_ru: p.ru,
          context: scenarioTitle || null,
          source_lesson_id: sessionId,
          srs_box: sched.box,
          due_at: sched.due_at,
        };
      });

    if (toInsert.length > 0) {
      await supabase.from("vocabulary_items").insert(toInsert);
    }
  }

  // ── Память ошибок + SRS (FR-12): активная ошибка → бокс 1, повтор завтра ──
  const touchedErrorIds = new Set<string>();

  if (Array.isArray(errors) && errors.length > 0) {
    const { data: existing } = await supabase
      .from("error_memory")
      .select("*")
      .eq("user_id", userId);

    const existingItems = (existing || []) as ErrorMemoryItem[];
    const reset = nextSchedule(1, false, now); // активная ошибка: бокс 1, due завтра

    for (const item of errors) {
      if (!item.description) continue;

      let match: ErrorMemoryItem | undefined;
      if (item.isRepeat && item.topic) {
        match = existingItems.find((e) => e.topic === item.topic);
      }
      if (!match && item.topic) {
        match = existingItems.find(
          (e) =>
            e.topic === item.topic &&
            overlapRatio(e.description, item.description) > 0.4
        );
      }

      if (match) {
        touchedErrorIds.add(match.id);
        await supabase
          .from("error_memory")
          .update({
            times_seen: match.times_seen + 1,
            last_reviewed_at: nowIso,
            srs_box: reset.box,
            due_at: reset.due_at,
          })
          .eq("id", match.id);
      } else {
        const { data: inserted } = await supabase
          .from("error_memory")
          .insert({
            user_id: userId,
            description: item.description,
            topic: item.topic || null,
            srs_box: reset.box,
            due_at: reset.due_at,
          })
          .select("*")
          .single();

        if (inserted) {
          existingItems.push(inserted as ErrorMemoryItem);
          touchedErrorIds.add((inserted as ErrorMemoryItem).id);
        }
      }
    }
  }

  // ── Продвигаем по SRS то, что было «к повторению» и успешно прошло урок ──
  // (due-элементы на момент урока; ошибки, повторившиеся сейчас, исключаем — они уже сброшены)
  const [{ data: dueVocab }, { data: dueErrors }] = await Promise.all([
    supabase
      .from("vocabulary_items")
      .select("id, srs_box")
      .eq("user_id", userId)
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("error_memory")
      .select("id, srs_box")
      .eq("user_id", userId)
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(5),
  ]);

  for (const v of (dueVocab || []) as Pick<VocabularyItem, "id" | "srs_box">[]) {
    const sched = nextSchedule(v.srs_box, true, now);
    await supabase
      .from("vocabulary_items")
      .update({
        srs_box: sched.box,
        due_at: sched.due_at,
        last_reviewed_at: nowIso,
      })
      .eq("id", v.id);
  }

  for (const e of (dueErrors || []) as Pick<ErrorMemoryItem, "id" | "srs_box">[]) {
    if (touchedErrorIds.has(e.id)) continue; // повторилась сейчас — не продвигаем
    const sched = nextSchedule(e.srs_box, true, now);
    await supabase
      .from("error_memory")
      .update({
        srs_box: sched.box,
        due_at: sched.due_at,
        last_reviewed_at: nowIso,
      })
      .eq("id", e.id);
  }

  return NextResponse.json({ ok: true });
}
