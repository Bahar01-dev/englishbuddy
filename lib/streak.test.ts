import { describe, it, expect } from "vitest";
import {
  applyLessonCompletion,
  isGoalMetToday,
  isStreakAtRisk,
  toDateStr,
} from "./streak";

const NOW = new Date("2026-06-24T10:00:00.000Z"); // today = 2026-06-24
const YESTERDAY = "2026-06-23";
const TODAY = "2026-06-24";
const TWO_DAYS_AGO = "2026-06-22";

describe("applyLessonCompletion", () => {
  it("первый урок: серия начинается с 1", () => {
    const r = applyLessonCompletion(
      { streak_count: 0, longest_streak: 0, last_active_date: null },
      NOW
    );
    expect(r.streak_count).toBe(1);
    expect(r.longest_streak).toBe(1);
    expect(r.last_active_date).toBe(TODAY);
    expect(r.incremented).toBe(true);
  });

  it("вчера занимался → серия +1", () => {
    const r = applyLessonCompletion(
      { streak_count: 3, longest_streak: 5, last_active_date: YESTERDAY },
      NOW
    );
    expect(r.streak_count).toBe(4);
    expect(r.longest_streak).toBe(5);
    expect(r.incremented).toBe(true);
  });

  it("второй урок в тот же день не задваивает серию", () => {
    const r = applyLessonCompletion(
      { streak_count: 4, longest_streak: 5, last_active_date: TODAY },
      NOW
    );
    expect(r.streak_count).toBe(4);
    expect(r.incremented).toBe(false);
  });

  it("пропуск дня сбрасывает серию в 1", () => {
    const r = applyLessonCompletion(
      { streak_count: 7, longest_streak: 7, last_active_date: TWO_DAYS_AGO },
      NOW
    );
    expect(r.streak_count).toBe(1);
    expect(r.longest_streak).toBe(7); // рекорд сохраняется
    expect(r.incremented).toBe(true);
  });

  it("новая серия может побить рекорд longest_streak", () => {
    const r = applyLessonCompletion(
      { streak_count: 5, longest_streak: 5, last_active_date: YESTERDAY },
      NOW
    );
    expect(r.streak_count).toBe(6);
    expect(r.longest_streak).toBe(6);
  });
});

describe("isGoalMetToday", () => {
  it("true, если последний активный день — сегодня", () => {
    expect(isGoalMetToday(TODAY, NOW)).toBe(true);
  });
  it("false для вчера и null", () => {
    expect(isGoalMetToday(YESTERDAY, NOW)).toBe(false);
    expect(isGoalMetToday(null, NOW)).toBe(false);
  });
});

describe("isStreakAtRisk", () => {
  it("серия под угрозой: занимался вчера, сегодня ещё нет", () => {
    expect(
      isStreakAtRisk(
        { streak_count: 3, longest_streak: 3, last_active_date: YESTERDAY },
        NOW
      )
    ).toBe(true);
  });

  it("не под угрозой, если уже занимался сегодня", () => {
    expect(
      isStreakAtRisk(
        { streak_count: 3, longest_streak: 3, last_active_date: TODAY },
        NOW
      )
    ).toBe(false);
  });

  it("не под угрозой, если серии нет", () => {
    expect(
      isStreakAtRisk(
        { streak_count: 0, longest_streak: 0, last_active_date: null },
        NOW
      )
    ).toBe(false);
  });

  it("серия уже потеряна (разрыв ≥ 2 дней) → не считается под угрозой", () => {
    expect(
      isStreakAtRisk(
        { streak_count: 3, longest_streak: 3, last_active_date: TWO_DAYS_AGO },
        NOW
      )
    ).toBe(false);
  });
});

describe("toDateStr", () => {
  it("форматирует дату как YYYY-MM-DD", () => {
    expect(toDateStr(NOW)).toBe(TODAY);
  });
});
