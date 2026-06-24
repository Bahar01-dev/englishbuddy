import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { selectNextUnit } from "@/lib/syllabus";
import type { CefrLevel, GoalTrack } from "@/types";

export async function POST() {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  const userId = userData.user.id;

  // Выбор следующего юнита силлабуса делаем на старте и фиксируем в сессии (FR-13):
  // промпт урока пересобирается на каждом ходу в /api/chat, поэтому тема должна быть
  // стабильной в рамках одной сессии. Так же сразу выполняется запись syllabus_unit_id.
  const [{ data: profile }, { data: completed }] = await Promise.all([
    supabase
      .from("profiles")
      .select("cefr_level, goal_track")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("lesson_sessions")
      .select("syllabus_unit_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("syllabus_unit_id", "is", null),
  ]);

  const completedUnitIds = (completed || [])
    .map((s) => s.syllabus_unit_id as string | null)
    .filter((id): id is string => !!id);

  const unit = selectNextUnit(
    (profile?.cefr_level as CefrLevel | null) ?? null,
    (profile?.goal_track as GoalTrack | null) ?? null,
    completedUnitIds
  );

  const { data: session, error } = await supabase
    .from("lesson_sessions")
    .insert({
      user_id: userId,
      messages: [],
      status: "in_progress",
      syllabus_unit_id: unit?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: "Не получилось начать урок. Попробуй ещё раз." },
      { status: 500 }
    );
  }

  return NextResponse.json({ sessionId: session.id });
}
