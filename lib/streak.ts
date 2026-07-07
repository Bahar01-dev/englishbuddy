// Логика streak'а (FR-30): последовательные дни с выполненной дневной целью.
// Чистые функции — считаются по датам (YYYY-MM-DD), чтобы быть тестируемыми и не
// задваивать счётчик при нескольких уроках за день.
//
// «День» считается по локальному времени пользователя, а не по UTC: иначе для
// RU-часовых поясов (UTC+3…+5) урок ночью попадал бы в «предыдущий» день и ломал
// серию на границе суток. Локальную зону передаём смещением tzOffsetMinutes —
// ровно то, что отдаёт Date.prototype.getTimezoneOffset() в браузере (UTC−local,
// напр. для МСК = −180). Default 0 = UTC (для серверных вызовов без клиента).

// Запасной часовой пояс, когда клиент не прислал свой offset (напр. серверный cron
// напоминаний). UTC+5 = Казахстан (домашний пояс основателя). getTimezoneOffset()
// отдаёт UTC−local, поэтому UTC+5 = −300 минут.
export const DEFAULT_TZ_OFFSET_MINUTES = -300;

export interface StreakState {
  streak_count: number;
  longest_streak: number;
  last_active_date: string | null; // 'YYYY-MM-DD' | null
}

export interface StreakUpdate {
  streak_count: number;
  longest_streak: number;
  last_active_date: string; // 'YYYY-MM-DD'
  incremented: boolean; // изменился ли счётчик в этом завершении (для UI)
}

export function toDateStr(d: Date, tzOffsetMinutes = 0): string {
  // getTimezoneOffset() = UTC − local, поэтому локальное время = utc − offset.
  return new Date(d.getTime() - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Обновление streak'а при завершении урока.
 * - тот же день → не задваиваем (incremented=false);
 * - вчера → +1 (продолжение серии);
 * - разрыв ≥ 2 дней или первый урок → серия начинается с 1.
 */
export function applyLessonCompletion(
  state: StreakState,
  now: Date = new Date(),
  tzOffsetMinutes = 0
): StreakUpdate {
  const today = toDateStr(now, tzOffsetMinutes);
  const last = state.last_active_date;
  const longest = state.longest_streak ?? 0;
  const current = state.streak_count ?? 0;

  if (last === today) {
    const streak = current || 1;
    return {
      streak_count: streak,
      longest_streak: Math.max(longest, streak),
      last_active_date: today,
      incremented: false,
    };
  }

  const nextStreak = last && daysBetween(last, today) === 1 ? current + 1 : 1;

  return {
    streak_count: nextStreak,
    longest_streak: Math.max(longest, nextStreak),
    last_active_date: today,
    incremented: true,
  };
}

/** Выполнена ли дневная цель сегодня (для отображения на dashboard). */
export function isGoalMetToday(
  lastActiveDate: string | null,
  now: Date = new Date(),
  tzOffsetMinutes = 0
): boolean {
  return !!lastActiveDate && lastActiveDate === toDateStr(now, tzOffsetMinutes);
}

/**
 * Серия под угрозой: есть активный streak, последний урок был вчера, сегодня ещё
 * не занимались → если не зайти сегодня, серия прервётся (триггер для напоминаний 7.4).
 */
export function isStreakAtRisk(
  state: StreakState,
  now: Date = new Date(),
  tzOffsetMinutes = 0
): boolean {
  if (!state.last_active_date || (state.streak_count ?? 0) <= 0) return false;
  return daysBetween(state.last_active_date, toDateStr(now, tzOffsetMinutes)) === 1;
}
