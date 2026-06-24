import { describe, it, expect } from "vitest";
import { selectNextUnit, getUnitById, SYLLABUS_UNITS } from "./index";

describe("selectNextUnit", () => {
  it("новый пользователь A1/work → первый непройденный юнит A1 по треку work", () => {
    const unit = selectNextUnit("A1", "work", []);
    expect(unit).not.toBeNull();
    expect(unit!.level).toBe("A1");
    expect(unit!.track).toBe("work");
    // первый в массиве для A1/work
    expect(unit!.id).toBe("a1-work-introductions");
  });

  it("пропускает уже пройденные юниты", () => {
    const unit = selectNextUnit("A1", "work", ["a1-work-introductions"]);
    expect(unit!.id).toBe("a1-work-asking-help");
  });

  it("когда все юниты текущего уровня по треку пройдены — поднимается на уровень выше", () => {
    const a1Work = SYLLABUS_UNITS.filter(
      (u) => u.level === "A1" && u.track === "work"
    ).map((u) => u.id);
    const unit = selectNextUnit("A1", "work", a1Work);
    expect(unit).not.toBeNull();
    expect(unit!.level).toBe("A2");
    expect(unit!.track).toBe("work");
  });

  it("два последовательных вызова не дают одинаковую тему (не повторяет)", () => {
    const first = selectNextUnit("A1", "relocation", [])!;
    const second = selectNextUnit("A1", "relocation", [first.id])!;
    expect(second.id).not.toBe(first.id);
  });

  it("уровень B1 без своих юнитов → fallback на любой непройденный по треку", () => {
    // в seed нет B1 — должен вернуть непройденный юнит (из A-уровней), не упасть
    const unit = selectNextUnit("B1", "conversational", []);
    expect(unit).not.toBeNull();
    expect(unit!.track === "conversational" || unit!.track === "general").toBe(true);
  });

  it("track general/null подходит любой юнит", () => {
    const unit = selectNextUnit("A1", null, []);
    expect(unit).not.toBeNull();
    expect(unit!.level).toBe("A1");
  });

  it("уровень null трактуется как A1", () => {
    const unit = selectNextUnit(null, "work", []);
    expect(unit!.level).toBe("A1");
  });

  it("все юниты пройдены → null", () => {
    const allIds = SYLLABUS_UNITS.map((u) => u.id);
    expect(selectNextUnit("A1", "work", allIds)).toBeNull();
  });
});

describe("getUnitById", () => {
  it("находит юнит по id", () => {
    expect(getUnitById("a1-work-introductions")?.title).toBe("Знакомство с коллегами");
  });

  it("null/неизвестный id → null", () => {
    expect(getUnitById(null)).toBeNull();
    expect(getUnitById("does-not-exist")).toBeNull();
  });
});

describe("seed-инварианты", () => {
  it("id юнитов уникальны", () => {
    const ids = SYLLABUS_UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("у каждого юнита есть лексика и сценарий", () => {
    for (const u of SYLLABUS_UNITS) {
      expect(u.vocab.length).toBeGreaterThan(0);
      expect(u.scenario.trim().length).toBeGreaterThan(0);
    }
  });
});
