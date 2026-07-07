import { describe, it, expect } from "vitest";
import { overlapRatio, splitPhrase, findErrorMatch } from "./error-match";
import type { ErrorMemoryItem, LessonCompletionError } from "@/types";

function existing(
  id: string,
  description: string,
  topic: string | null
): ErrorMemoryItem {
  return {
    id,
    user_id: "u",
    description,
    topic,
    times_seen: 1,
    last_reviewed_at: "2026-06-20T00:00:00.000Z",
    srs_box: 2,
    due_at: "2026-06-25T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  };
}

describe("overlapRatio", () => {
  it("полное совпадение значимых слов → 1", () => {
    expect(overlapRatio("past simple tense", "past simple tense")).toBe(1);
  });

  it("частичное пересечение считается по меньшему множеству", () => {
    // A={past, simple}, B={past, simple, tense} → общих 2 / min(2,3) = 1
    expect(overlapRatio("past simple", "past simple tense")).toBe(1);
    // A={past, tense}, B={present, tense} → общих 1 / min(2,2) = 0.5
    expect(overlapRatio("past tense", "present tense")).toBe(0.5);
  });

  it("короткие слова (≤3 символов) игнорируются", () => {
    // "the", "a", "is" отбрасываются; остаётся только "articles"
    expect(overlapRatio("the articles", "a articles")).toBe(1);
  });

  it("нет общих значимых слов → 0", () => {
    expect(overlapRatio("prepositions place", "verb conjugation")).toBe(0);
  });

  it("пустая/односложная строка → 0 (защита от деления на ноль)", () => {
    expect(overlapRatio("", "past simple")).toBe(0);
    expect(overlapRatio("of to a", "past simple")).toBe(0);
  });
});

describe("splitPhrase", () => {
  it("разбивает по длинному тире с пробелами", () => {
    expect(splitPhrase("to apply — подавать заявку")).toEqual({
      en: "to apply",
      ru: "подавать заявку",
    });
  });

  it("поддерживает дефис и en-dash как разделитель", () => {
    expect(splitPhrase("hello - привет")).toEqual({ en: "hello", ru: "привет" });
    expect(splitPhrase("bye – пока")).toEqual({ en: "bye", ru: "пока" });
  });

  it("без разделителя → ru = null", () => {
    expect(splitPhrase("just english")).toEqual({ en: "just english", ru: null });
  });

  it("несколько тире: первое — граница en, остальное склеивается в ru", () => {
    expect(splitPhrase("check-in — регистрация — на рейс")).toEqual({
      en: "check-in",
      ru: "регистрация - на рейс",
    });
  });
});

describe("findErrorMatch", () => {
  const items = [
    existing("e1", "wrong past simple ending", "past-simple"),
    existing("e2", "misuse of articles a/the", "articles"),
  ];

  it("isRepeat + topic → матч по теме независимо от описания", () => {
    const item: LessonCompletionError = {
      description: "totally different wording",
      topic: "past-simple",
      isRepeat: true,
    };
    expect(findErrorMatch(item, items)?.id).toBe("e1");
  });

  it("без isRepeat → матч при совпадении темы и пересечении описаний > 0.4", () => {
    const item: LessonCompletionError = {
      description: "wrong past simple form",
      topic: "past-simple",
    };
    expect(findErrorMatch(item, items)?.id).toBe("e1");
  });

  it("та же тема, но описания не пересекаются → нет матча (новая запись)", () => {
    const item: LessonCompletionError = {
      description: "completely unrelated stuff here",
      topic: "past-simple",
    };
    expect(findErrorMatch(item, items)).toBeUndefined();
  });

  it("новая тема → нет матча", () => {
    const item: LessonCompletionError = {
      description: "wrong past simple ending",
      topic: "prepositions",
    };
    expect(findErrorMatch(item, items)).toBeUndefined();
  });

  it("без темы → нет матча (тема обязательна для сопоставления)", () => {
    const item: LessonCompletionError = {
      description: "wrong past simple ending",
    };
    expect(findErrorMatch(item, items)).toBeUndefined();
  });

  it("isRepeat=true, но тема отсутствует → падает в overlap-ветку, матча нет", () => {
    const item: LessonCompletionError = {
      description: "wrong past simple ending",
      isRepeat: true,
    };
    expect(findErrorMatch(item, items)).toBeUndefined();
  });
});
