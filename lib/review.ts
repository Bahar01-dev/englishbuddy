import type { VocabularyItem, ErrorMemoryItem } from "@/types";

// Очередь повторения = due-элементы из vocabulary_items + error_memory,
// отсортированные по дате «пора повторить», ограниченные лимитом (спецификация 8.1).

export interface ReviewItem {
  kind: "vocab" | "error";
  id: string;
  text: string; // что повторить (для подстановки в промпт)
  due_at: string;
  box: number;
}

export function buildReviewQueue(
  vocab: VocabularyItem[],
  errors: ErrorMemoryItem[],
  now: Date = new Date(),
  limit = 5
): ReviewItem[] {
  const nowMs = now.getTime();
  const items: ReviewItem[] = [];

  for (const v of vocab) {
    if (new Date(v.due_at).getTime() <= nowMs) {
      items.push({
        kind: "vocab",
        id: v.id,
        text: v.translation_ru ? `${v.phrase_en} — ${v.translation_ru}` : v.phrase_en,
        due_at: v.due_at,
        box: v.srs_box,
      });
    }
  }

  for (const e of errors) {
    if (new Date(e.due_at).getTime() <= nowMs) {
      items.push({
        kind: "error",
        id: e.id,
        text: e.topic ? `${e.description} (тема: ${e.topic})` : e.description,
        due_at: e.due_at,
        box: e.srs_box,
      });
    }
  }

  items.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  return items.slice(0, limit);
}
