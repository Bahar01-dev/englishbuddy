import Link from "next/link";
import { Settings, BookOpen } from "lucide-react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isGoalMetToday, DEFAULT_TZ_OFFSET_MINUTES } from "@/lib/streak";
import StartLessonButton from "@/components/StartLessonButton";
import LessonCard from "@/components/LessonCard";
import Logo from "@/components/Logo";
import SignOutButton from "@/components/SignOutButton";
import type { LessonSession } from "@/types";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, goal, cefr_level, cefr_confidence, streak_count, daily_goal, last_active_date"
    )
    .eq("user_id", data.user.id)
    .single();

  const { data: sessions } = await supabase
    .from("lesson_sessions")
    .select("id, user_id, scenario_title, messages, status, created_at, completed_at")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false });

  const nowIso = new Date().toISOString();
  const [{ count: vocabCount }, { count: dueVocab }, { count: dueErrors }] =
    await Promise.all([
      supabase
        .from("vocabulary_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id),
      supabase
        .from("vocabulary_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .lte("due_at", nowIso),
      supabase
        .from("error_memory")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .lte("due_at", nowIso),
    ]);

  const dueCount = (dueVocab ?? 0) + (dueErrors ?? 0);

  const lessonSessions = (sessions || []) as LessonSession[];

  const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const cefrIndex = profile?.cefr_level
    ? CEFR_LEVELS.indexOf(profile.cefr_level)
    : -1;
  const cefrProgress = cefrIndex >= 0 ? ((cefrIndex + 1) / CEFR_LEVELS.length) * 100 : 0;
  const learnedPhrases = vocabCount ?? 0;

  const streakCount = profile?.streak_count ?? 0;
  const dailyGoal = profile?.daily_goal ?? 1;
  // Server-компонент: пояс устройства недоступен, считаем по домашнему UTC+5 (см. roadmap).
  const goalMetToday = isGoalMetToday(
    profile?.last_active_date ?? null,
    new Date(),
    DEFAULT_TZ_OFFSET_MINUTES
  );

  const displayName =
    profile?.display_name || data.user.email?.split("@")[0] || "друг";

  const completedCount = lessonSessions.filter(
    (session) => session.status === "completed"
  ).length;
  const inProgressCount = lessonSessions.filter(
    (session) => session.status === "in_progress"
  ).length;

  return (
    <div className="flex flex-1 flex-col" style={{ backgroundColor: "#0e0b1a" }}>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-6">
        <Logo />

        <nav className="flex items-center gap-3">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/20 hover:text-white"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Настройки
          </Link>
          <SignOutButton className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/20 hover:text-white" />
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Привет, {displayName}!
          </h1>
          {profile?.goal ? (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/80">
              🎯 {profile.goal}
            </span>
          ) : (
            <Link
              href="/settings"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#a98fff] transition-opacity hover:opacity-80"
            >
              Настроить цель →
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
          {cefrIndex >= 0 ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-xs text-white/40">Твой уровень</div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {profile?.cefr_level}
                    {profile?.cefr_confidence === "low" && (
                      <span className="ml-2 align-middle text-xs font-normal text-white/40">
                        (уточним по ходу)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm text-white/60">
                  <div>
                    🌱 Выучено фраз: <span className="text-white">{learnedPhrases}</span>
                  </div>
                  {dueCount > 0 && (
                    <div className="mt-1 text-[#a98fff]">
                      🔁 К повторению: {dueCount}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#6D4DF0] transition-all"
                    style={{ width: `${cefrProgress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-white/30">
                  {CEFR_LEVELS.map((lvl) => (
                    <span
                      key={lvl}
                      className={lvl === profile?.cefr_level ? "text-[#a98fff]" : ""}
                    >
                      {lvl}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">
                Уровень ещё не определён — пройди короткую диагностику.
              </p>
              <Link
                href="/onboarding"
                className="rounded-xl bg-[#6D4DF0] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Пройти
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {streakCount > 0 ? "🔥" : "✨"}
            </span>
            <div>
              <div className="text-lg font-semibold text-white">
                {streakCount > 0
                  ? `${streakCount} ${streakCount === 1 ? "день" : "дней"} подряд`
                  : "Начни свою серию"}
              </div>
              <div className="text-xs text-white/40">
                Цель: {dailyGoal} {dailyGoal === 1 ? "урок" : "урока"} в день
              </div>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              goalMetToday
                ? "bg-[#6D4DF0]/20 text-[#a98fff]"
                : "border border-white/10 text-white/50"
            }`}
          >
            {goalMetToday ? "✓ Цель на сегодня" : "Цель не выполнена"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/5 px-4 py-5 text-center">
            <div className="text-2xl font-semibold text-white">
              {lessonSessions.length}
            </div>
            <div className="mt-1 text-xs text-white/40">Всего уроков</div>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-5 text-center">
            <div className="text-2xl font-semibold text-white">
              {completedCount}
            </div>
            <div className="mt-1 text-xs text-white/40">Завершено</div>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-5 text-center">
            <div className="text-2xl font-semibold text-white">
              {inProgressCount}
            </div>
            <div className="mt-1 text-xs text-white/40">В процессе</div>
          </div>
        </div>

        <StartLessonButton />

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-white">История уроков</h2>

          {lessonSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center">
              <BookOpen className="h-8 w-8 text-white/40" aria-hidden="true" />
              <p className="text-white/60">
                Пока нет ни одного урока — начни первый, нажав кнопку выше.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lessonSessions.map((session) => (
                <LessonCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
