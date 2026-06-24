// Интервальные повторения по Лейтнеру (spaced repetition).
// Боксы 1..5 с растущими интервалами; при успехе бокс растёт, при ошибке — сброс в 1.
// Интервалы можно откалибровать после реального использования (Open Question 1 спецификации).

export const SRS_INTERVALS_DAYS = [1, 3, 7, 16, 35];
export const SRS_MAX_BOX = SRS_INTERVALS_DAYS.length; // 5

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SrsSchedule {
  box: number;
  due_at: string; // ISO-строка
}

function dueAfter(box: number, now: Date): string {
  const days = SRS_INTERVALS_DAYS[box - 1];
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

/**
 * Новое расписание после повторения.
 * @param box текущий бокс (>=1)
 * @param success удалось ли вспомнить/применить
 */
export function nextSchedule(
  box: number,
  success: boolean,
  now: Date = new Date()
): SrsSchedule {
  const current =
    Number.isFinite(box) && box >= 1 ? Math.min(Math.floor(box), SRS_MAX_BOX) : 1;
  const nextBox = success ? Math.min(current + 1, SRS_MAX_BOX) : 1;
  return { box: nextBox, due_at: dueAfter(nextBox, now) };
}

/** Расписание для только что выученного элемента: бокс 1, первое повторение завтра. */
export function initialSchedule(now: Date = new Date()): SrsSchedule {
  return { box: 1, due_at: dueAfter(1, now) };
}
