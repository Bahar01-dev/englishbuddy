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
  it("форматирует дату как YYYY-MM-DD (UTC по умолчанию)", () => {
    expect(toDateStr(NOW)).toBe(TODAY);
  });

  it("сдвигает границу дня по часовому поясу (UTC+5 = −300)", () => {
    // 22:00 UTC 24-го = 03:00 26-го... нет: 24-го 22:00 UTC + 5ч = 25-го 03:00 местного.
    const lateUtc = new Date("2026-06-24T22:00:00.000Z");
    expect(toDateStr(lateUtc)).toBe("2026-06-24"); // по UTC ещё 24-е
    expect(toDateStr(lateUtc, -300)).toBe("2026-06-25"); // по UTC+5 уже 25-е
  });
});

describe("applyLessonCompletion c часовым поясом", () => {
  it("ночной урок в UTC+5 засчитывается локальным днём, а не UTC-вчера", () => {
    // 24-е 21:00 UTC = 25-е 02:00 в UTC+5. Прошлый урок был 24-го (по местному).
    const lateUtc = new Date("2026-06-24T21:00:00.000Z");
    const r = applyLessonCompletion(
      { streak_count: 2, longest_streak: 2, last_active_date: "2026-06-24" },
      lateUtc,
      -300
    );
    expect(r.last_active_date).toBe("2026-06-25");
    expect(r.streak_count).toBe(3); // продолжение серии, а не сброс
    expect(r.incremented).toBe(true);
  });
});
