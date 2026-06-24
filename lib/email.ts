// Транзакционные email-напоминания через Resend (FR-32).
// Отправка включается только при наличии RESEND_API_KEY — без ключа функция мягко
// деградирует (лог + false), чтобы локальная разработка и сборка не падали.

import { isGoalMetToday, isStreakAtRisk } from "@/lib/streak";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ReminderCandidateProfile {
  user_id: string;
  display_name: string | null;
  streak_count: number;
  longest_streak: number;
  last_active_date: string | null;
}

export interface ReminderRecipient {
  user_id: string;
  displayName: string | null;
  dueCount: number;
  streakCount: number;
  streakAtRisk: boolean;
}

/**
 * Кого напоминать (FR-32): пользователи, которые сегодня ещё не занимались И у которых
 * есть повод — либо due-повторения, либо серия под угрозой потери. Чистая функция —
 * тестируется отдельно от БД.
 */
export function selectReminderRecipients(
  profiles: ReminderCandidateProfile[],
  dueCountByUser: Map<string, number>,
  now: Date = new Date()
): ReminderRecipient[] {
  const recipients: ReminderRecipient[] = [];

  for (const p of profiles) {
    if (isGoalMetToday(p.last_active_date, now)) continue; // уже занимались — не беспокоим

    const dueCount = dueCountByUser.get(p.user_id) ?? 0;
    const atRisk = isStreakAtRisk(
      {
        streak_count: p.streak_count,
        longest_streak: p.longest_streak,
        last_active_date: p.last_active_date,
      },
      now
    );

    if (dueCount === 0 && !atRisk) continue; // нет повода писать

    recipients.push({
      user_id: p.user_id,
      displayName: p.display_name,
      dueCount,
      streakCount: p.streak_count,
      streakAtRisk: atRisk,
    });
  }

  return recipients;
}

export interface ReminderEmailParams {
  to: string;
  displayName: string | null;
  dueCount: number;
  streakCount: number;
  streakAtRisk: boolean;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function subject(p: ReminderEmailParams): string {
  if (p.streakAtRisk && p.streakCount > 0) {
    return `🔥 Не потеряй серию из ${p.streakCount} ${p.streakCount === 1 ? "дня" : "дней"}!`;
  }
  if (p.dueCount > 0) {
    return `🔁 ${p.dueCount} ${p.dueCount === 1 ? "фраза ждёт" : "фраз ждут"} повторения`;
  }
  return "Пора на урок английского 🙂";
}

function html(p: ReminderEmailParams): string {
  const name = p.displayName || "друг";
  const lines: string[] = [
    `<p>Привет, ${name}!</p>`,
  ];

  if (p.streakAtRisk && p.streakCount > 0) {
    lines.push(
      `<p>Ты занимаешься уже <b>${p.streakCount} ${p.streakCount === 1 ? "день" : "дней"} подряд</b> — здорово! Зайди сегодня на короткий урок, чтобы не прерывать серию.</p>`
    );
  } else {
    lines.push(
      `<p>Самое время для короткого урока английского — даже 5 минут двигают вперёд.</p>`
    );
  }

  if (p.dueCount > 0) {
    lines.push(
      `<p>Кстати, ${p.dueCount} ${p.dueCount === 1 ? "фраза готова" : "фраз готовы"} к повторению — повторим их в начале урока, чтобы закрепить.</p>`
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://englishbuddy.app";
  lines.push(
    `<p><a href="${appUrl}/dashboard" style="display:inline-block;background:#7c5cfc;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">Начать урок</a></p>`,
    `<p style="color:#888;font-size:12px;">EnglishBuddy — твой ИИ-репетитор английского.</p>`
  );

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#222;">${lines.join("")}</div>`;
}

/** Отправляет напоминание. Возвращает true при успехе; false при отсутствии ключа/сбое. */
export async function sendReminderEmail(p: ReminderEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[EMAIL]", { skipped: "RESEND_API_KEY not set" });
    return false;
  }

  const from =
    process.env.REMINDER_FROM_EMAIL || "EnglishBuddy <onboarding@resend.dev>";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: p.to,
        subject: subject(p),
        html: html(p),
      }),
    });

    if (!res.ok) {
      console.warn("[EMAIL]", { route: "resend", status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[EMAIL]", {
      route: "resend",
      error: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}
