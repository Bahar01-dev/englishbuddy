import { describe, it, expect } from "vitest";
import { buildReviewQueue } from "./review";
import type { VocabularyItem, ErrorMemoryItem } from "@/types";

const NOW = new Date("2026-06-23T12:00:00.000Z");
const iso = (offsetDays: number) =>
  new Date(NOW.getTime() + offsetDays * 86_400_000).toISOString();

function vocab(id: string, dueOffset: number, extra: Partial<VocabularyItem> = {}): VocabularyItem {
  return {
    id,
    user_id: "u",
    phrase_en: `phrase ${id}`,
    translation_ru: `перевод ${id}`,
    context: null,
    source_lesson_id: null,
    srs_box: 1,
    due_at: iso(dueOffset),
    times_reviewed: 0,
    last_reviewed_at: null,
    created_at: iso(-1),
    ...extra,
  };
}

function err(id: string, dueOffset: number): ErrorMemoryItem {
  return {
    id,
    user_id: "u",
    description: `ошибка ${id}`,
    topic: "грамматика",
    times_seen: 1,
    last_reviewed_at: iso(-1),
    srs_box: 1,
    due_at: iso(dueOffset),
    created_at: iso(-1),
  };
}

describe("buildReviewQueue", () => {
  it("берёт только due-элементы (due_at <= now)", () => {
    const q = buildReviewQueue([vocab("a", -1), vocab("b", 2)], [], NOW);
    expect(q.map((i) => i.id)).toEqual(["a"]);
  });

  it("объединяет vocab и errors и сортирует по due_at", () => {
    const q = buildReviewQueue([vocab("v", -1)], [err("e", -2)], NOW);
    expect(q.map((i) => i.id)).toEqual(["e", "v"]); // e просрочен сильнее
  });

  it("уважает лимит", () => {
    const all = [vocab("a", -5), vocab("b", -4), vocab("c", -3), vocab("d", -2)];
    expect(buildReviewQueue(all, [], NOW, 2)).toHaveLength(2);
  });

  it("формирует текст фразы с переводом", () => {
    const q = buildReviewQueue([vocab("a", -1, { phrase_en: "hello", translation_ru: "привет" })], [], NOW);
    expect(q[0].text).toBe("hello — привет");
  });
});
