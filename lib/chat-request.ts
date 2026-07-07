import type { ChatMessage } from "@/types";

// Санитайзинг истории сообщений, приходящей от клиента в /api/chat (FR-02).
// Системный промпт собирается на сервере, но сами реплики диалога клиент шлёт как есть —
// поэтому здесь ставим границы, чтобы:
//  • не отправлять в модель неограниченно большой платёж (защита от cost/DoS);
//  • отбросить мусор (пустые/битые записи, чужие роли);
//  • гарантировать корректную для Anthropic структуру (история начинается с роли user).
// Чистая функция — тестируется без сети.

export const MAX_MESSAGES = 60; // держим последние N ходов
export const MAX_MESSAGE_CHARS = 8_000; // потолок одной реплики (обрезаем)
export const MAX_TOTAL_CHARS = 120_000; // суммарный бюджет истории (срезаем старое)

export function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  const cleaned: ChatMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    cleaned.push({ role, content: trimmed.slice(0, MAX_MESSAGE_CHARS) });
  }

  // Оставляем последние MAX_MESSAGES ходов.
  let windowed = cleaned.slice(-MAX_MESSAGES);

  // Срезаем самые старые, пока не влезем в общий бюджет символов.
  let total = windowed.reduce((n, m) => n + m.content.length, 0);
  while (windowed.length > 1 && total > MAX_TOTAL_CHARS) {
    total -= windowed[0].content.length;
    windowed = windowed.slice(1);
  }

  // Anthropic требует, чтобы история начиналась с реплики пользователя —
  // после срезов первым мог оказаться assistant, убираем ведущие ходы модели.
  while (windowed.length > 0 && windowed[0].role === "assistant") {
    windowed = windowed.slice(1);
  }

  return windowed;
}
