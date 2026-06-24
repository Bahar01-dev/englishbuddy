// Логика streak'а (FR-30): последовательные дни с выполненной дневной целью.
// Чистые функции — считаются по датам (YYYY-MM-DD), чтобы быть тестируемыми и не
// задваивать счётчик при нескольких уроках за день. Дата берётся по UTC (серверная).

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

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  now: Date = new Date()
): StreakUpdate {
  const today = toDateStr(now);
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
  now: Date = new Date()
): boolean {
  return !!lastActiveDate && lastActiveDate === toDateStr(now);
}

/**
 * Серия под угрозой: есть активный streak, последний урок был вчера, сегодня ещё
 * не занимались → если не зайти сегодня, серия прервётся (триггер для напоминаний 7.4).
 */
export function isStreakAtRisk(
  state: StreakState,
  now: Date = new Date()
): boolean {
  if (!state.last_active_date || (state.streak_count ?? 0) <= 0) return false;
  return daysBetween(state.last_active_date, toDateStr(now)) === 1;
}
