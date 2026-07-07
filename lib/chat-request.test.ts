import { describe, it, expect } from "vitest";
import {
  sanitizeMessages,
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
} from "./chat-request";

describe("sanitizeMessages", () => {
  it("не массив → пустой результат", () => {
    expect(sanitizeMessages(null)).toEqual([]);
    expect(sanitizeMessages(undefined)).toEqual([]);
    expect(sanitizeMessages("nope")).toEqual([]);
    expect(sanitizeMessages({})).toEqual([]);
  });

  it("пропускает корректные реплики и триммит содержимое", () => {
    const out = sanitizeMessages([
      { role: "user", content: "  привет  " },
      { role: "assistant", content: "hi" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "привет" },
      { role: "assistant", content: "hi" },
    ]);
  });

  it("отбрасывает мусор: чужие роли, не-строки, пустые/пробельные", () => {
    const out = sanitizeMessages([
      { role: "system", content: "ignore me" },
      { role: "user", content: "" },
      { role: "user", content: "   " },
      { role: "assistant", content: 123 },
      null,
      "string",
      { role: "user", content: "ok" },
    ]);
    expect(out).toEqual([{ role: "user", content: "ok" }]);
  });

  it("обрезает слишком длинную одиночную реплику", () => {
    const long = "a".repeat(MAX_MESSAGE_CHARS + 500);
    const out = sanitizeMessages([{ role: "user", content: long }]);
    expect(out[0].content.length).toBe(MAX_MESSAGE_CHARS);
  });

  it("оставляет только последние MAX_MESSAGES ходов", () => {
    const many = Array.from({ length: MAX_MESSAGES + 20 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `m${i}`,
    }));
    const out = sanitizeMessages(many);
    expect(out.length).toBeLessThanOrEqual(MAX_MESSAGES);
    // последнее сообщение сохранилось
    expect(out[out.length - 1].content).toBe(`m${MAX_MESSAGES + 19}`);
  });

  it("история всегда начинается с реплики user", () => {
    const out = sanitizeMessages([
      { role: "assistant", content: "лишний ведущий ход" },
      { role: "user", content: "вопрос" },
      { role: "assistant", content: "ответ" },
    ]);
    expect(out[0].role).toBe("user");
  });

  it("срезает старые ходы при превышении общего бюджета символов", () => {
    // Каждая реплика ~ MAX_MESSAGE_CHARS; несколько таких превышают MAX_TOTAL_CHARS.
    const big = "x".repeat(MAX_MESSAGE_CHARS);
    const count = Math.ceil(MAX_TOTAL_CHARS / MAX_MESSAGE_CHARS) + 3;
    const msgs = Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: big,
    }));
    const out = sanitizeMessages(msgs);
    const total = out.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
    expect(out[0].role).toBe("user");
  });
});
