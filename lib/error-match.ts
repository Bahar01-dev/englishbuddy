import type { ErrorMemoryItem, LessonCompletionError } from "@/types";

// Чистая логика сопоставления и разбора для завершения урока (lesson/finish).
// Вынесена из route-хендлера, чтобы быть тестируемой без Supabase.

/** Значимые слова (длиннее 3 символов, латиница/кириллица/цифры), нижний регистр. */
export function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/i)
      .filter((word) => word.length > 3)
  );
}

/**
 * Доля общих значимых слов относительно меньшего множества (0..1).
 * Пустое множество с любой стороны → 0.
 */
export function overlapRatio(a: string, b: string): number {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let common = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) common++;
  }

  return common / Math.min(wordsA.size, wordsB.size);
}

/** «english phrase — перевод» → { en, ru }. Без разделителя ru = null. */
export function splitPhrase(s: string): { en: string; ru: string | null } {
  const parts = s.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    return { en: parts[0].trim(), ru: parts.slice(1).join(" - ").trim() || null };
  }
  return { en: s.trim(), ru: null };
}

/**
 * Ищет существующую запись ошибки, к которой относится новая (FR-12).
 * 1) явный повтор (isRepeat) по совпадению темы;
 * 2) иначе — та же тема И пересечение описаний > 0.4.
 * Не нашли → undefined (создаётся новая запись).
 */
export function findErrorMatch(
  item: LessonCompletionError,
  existingItems: ErrorMemoryItem[]
): ErrorMemoryItem | undefined {
  let match: ErrorMemoryItem | undefined;

  if (item.isRepeat && item.topic) {
    match = existingItems.find((e) => e.topic === item.topic);
  }
  if (!match && item.topic) {
    match = existingItems.find(
      (e) =>
        e.topic === item.topic &&
        overlapRatio(e.description, item.description) > 0.4
    );
  }

  return match;
}
