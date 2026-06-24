import { describe, it, expect } from "vitest";
import { nextSchedule, initialSchedule, SRS_MAX_BOX } from "./srs";

const NOW = new Date("2026-06-23T00:00:00.000Z");
const daysBetween = (iso: string, now: Date) =>
  Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);

describe("nextSchedule", () => {
  it("успех повышает бокс и даёт следующий интервал", () => {
    const r = nextSchedule(1, true, NOW);
    expect(r.box).toBe(2);
    expect(daysBetween(r.due_at, NOW)).toBe(3);
  });

  it("ошибка сбрасывает бокс в 1 (интервал 1 день)", () => {
    const r = nextSchedule(4, false, NOW);
    expect(r.box).toBe(1);
    expect(daysBetween(r.due_at, NOW)).toBe(1);
  });

  it("бокс не превышает максимум", () => {
    const r = nextSchedule(SRS_MAX_BOX, true, NOW);
    expect(r.box).toBe(SRS_MAX_BOX);
    expect(daysBetween(r.due_at, NOW)).toBe(35);
  });

  it("некорректный бокс трактуется как 1", () => {
    const r = nextSchedule(0, true, NOW);
    expect(r.box).toBe(2);
    expect(daysBetween(r.due_at, NOW)).toBe(3);
  });
});

describe("initialSchedule", () => {
  it("новый элемент: бокс 1, повтор через 1 день", () => {
    const r = initialSchedule(NOW);
    expect(r.box).toBe(1);
    expect(daysBetween(r.due_at, NOW)).toBe(1);
  });
});
