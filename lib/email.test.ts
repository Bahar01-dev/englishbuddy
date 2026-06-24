import { describe, it, expect } from "vitest";
import {
  selectReminderRecipients,
  type ReminderCandidateProfile,
} from "./email";

const NOW = new Date("2026-06-24T09:00:00.000Z"); // today 2026-06-24
const TODAY = "2026-06-24";
const YESTERDAY = "2026-06-23";

function profile(p: Partial<ReminderCandidateProfile>): ReminderCandidateProfile {
  return {
    user_id: "u",
    display_name: null,
    streak_count: 0,
    longest_streak: 0,
    last_active_date: null,
    ...p,
  };
}

describe("selectReminderRecipients", () => {
  it("включает пользователя с due-повторениями, который сегодня не занимался", () => {
    const r = selectReminderRecipients(
      [profile({ user_id: "a", last_active_date: YESTERDAY })],
      new Map([["a", 3]]),
      NOW
    );
    expect(r).toHaveLength(1);
    expect(r[0].user_id).toBe("a");
    expect(r[0].dueCount).toBe(3);
  });

  it("включает пользователя с серией под угрозой даже без due", () => {
    const r = selectReminderRecipients(
      [profile({ user_id: "b", streak_count: 5, last_active_date: YESTERDAY })],
      new Map(),
      NOW
    );
    expect(r).toHaveLength(1);
    expect(r[0].streakAtRisk).toBe(true);
  });

  it("исключает тех, кто уже занимался сегодня", () => {
    const r = selectReminderRecipients(
      [profile({ user_id: "c", last_active_date: TODAY })],
      new Map([["c", 10]]),
      NOW
    );
    expect(r).toHaveLength(0);
  });

  it("исключает без повода (нет due и серия не под угрозой)", () => {
    const r = selectReminderRecipients(
      [profile({ user_id: "d", last_active_date: null })],
      new Map(),
      NOW
    );
    expect(r).toHaveLength(0);
  });

  it("обрабатывает несколько пользователей корректно", () => {
    const r = selectReminderRecipients(
      [
        profile({ user_id: "a", last_active_date: YESTERDAY }), // due → да
        profile({ user_id: "b", last_active_date: TODAY }), // сегодня был → нет
        profile({ user_id: "c", streak_count: 2, last_active_date: YESTERDAY }), // риск → да
      ],
      new Map([["a", 1]]),
      NOW
    );
    expect(r.map((x) => x.user_id).sort()).toEqual(["a", "c"]);
  });
});
