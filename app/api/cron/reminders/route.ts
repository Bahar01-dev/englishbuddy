import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  selectReminderRecipients,
  sendReminderEmail,
  isEmailConfigured,
  type ReminderCandidateProfile,
} from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cron-роут напоминаний (FR-32). Вызывается Vercel Cron (см. vercel.json) или вручную.
// Использует service_role (обход RLS) — данные всех пользователей. Защищён CRON_SECRET.
// ?dryRun=1 — вернуть список адресатов без отправки писем (для ручной проверки).

export async function GET(request: Request) {
  // Защита: Vercel Cron присылает Authorization: Bearer ${CRON_SECRET}.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const now = new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceClient();

  // Профили + due-элементы (vocab/errors) одним заходом.
  const [{ data: profiles }, { data: dueVocab }, { data: dueErrors }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "user_id, display_name, streak_count, longest_streak, last_active_date"
        ),
      supabase
        .from("vocabulary_items")
        .select("user_id")
        .lte("due_at", nowIso),
      supabase.from("error_memory").select("user_id").lte("due_at", nowIso),
    ]);

  // Считаем due по пользователю.
  const dueCountByUser = new Map<string, number>();
  for (const row of [...(dueVocab || []), ...(dueErrors || [])]) {
    const uid = (row as { user_id: string }).user_id;
    dueCountByUser.set(uid, (dueCountByUser.get(uid) ?? 0) + 1);
  }

  const recipients = selectReminderRecipients(
    (profiles || []) as ReminderCandidateProfile[],
    dueCountByUser,
    now
  );

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      emailConfigured: isEmailConfigured(),
      candidates: recipients.length,
      recipients: recipients.map((r) => ({
        user_id: r.user_id,
        dueCount: r.dueCount,
        streakAtRisk: r.streakAtRisk,
      })),
    });
  }

  // Email пользователей лежит в auth.users — берём через admin API и мапим по id.
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map<string, string>();
  for (const u of usersData?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }

  let sent = 0;
  for (const r of recipients) {
    const email = emailById.get(r.user_id);
    if (!email) continue;
    const ok = await sendReminderEmail({
      to: email,
      displayName: r.displayName,
      dueCount: r.dueCount,
      streakCount: r.streakCount,
      streakAtRisk: r.streakAtRisk,
    });
    if (ok) sent++;
  }

  return NextResponse.json({
    emailConfigured: isEmailConfigured(),
    candidates: recipients.length,
    sent,
  });
}
