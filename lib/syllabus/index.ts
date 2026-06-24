import type { CefrLevel, GoalTrack } from "@/types";
import { SYLLABUS_UNITS } from "@/lib/syllabus/seed";

// Силлабус: структурированная прогрессия юнитов под CEFR и трек цели (FR-13).
// Репетитор берёт следующий незавершённый юнит при старте урока; темы не повторяются.

export interface SyllabusUnit {
  id: string;          // стабильный идентификатор (по нему считается «пройденность»)
  level: CefrLevel;    // целевой уровень юнита
  track: GoalTrack;    // трек цели: work | relocation | conversational | general
  title: string;       // краткое название темы (ru) — также fallback для scenario_title
  grammarFocus: string; // грамматический фокус (ru)
  vocab: string[];     // ключевая лексика, формат «english — перевод»
  scenario: string;    // сценарий ролевой практики (ru): какую роль играет репетитор
}

export { SYLLABUS_UNITS };

const LEVEL_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function getUnitById(id: string | null | undefined): SyllabusUnit | null {
  if (!id) return null;
  return SYLLABUS_UNITS.find((u) => u.id === id) ?? null;
}

// Подходит ли юнит под трек пользователя: точное совпадение, либо общий юнит,
// либо у пользователя трек general/не задан (тогда годится любой).
function trackMatches(unit: SyllabusUnit, track: GoalTrack | null): boolean {
  if (!track || track === "general") return true;
  return unit.track === track || unit.track === "general";
}

/**
 * Выбирает следующий незавершённый юнит силлабуса.
 * Идёт от текущего уровня пользователя вверх (A1→C2), внутри уровня — по порядку
 * в массиве. Если на текущем уровне и выше всё пройдено по треку — берёт любой
 * непройденный по треку (на случай пропусков снизу). Если всё пройдено — null
 * (тогда репетитор подбирает свежую тему сам).
 *
 * @param level   CEFR-уровень пользователя (null → стартуем с A1)
 * @param track   трек цели (null/general → подходит любой юнит)
 * @param completedUnitIds id юнитов из завершённых уроков
 */
export function selectNextUnit(
  level: CefrLevel | null,
  track: GoalTrack | null,
  completedUnitIds: string[]
): SyllabusUnit | null {
  const done = new Set(completedUnitIds);
  const startIdx = Math.max(0, LEVEL_ORDER.indexOf(level ?? "A1"));

  // От текущего уровня и выше — приоритет прогрессии по уровню.
  for (let i = startIdx; i < LEVEL_ORDER.length; i++) {
    const lvl = LEVEL_ORDER[i];
    const unit = SYLLABUS_UNITS.find(
      (u) => u.level === lvl && trackMatches(u, track) && !done.has(u.id)
    );
    if (unit) return unit;
  }

  // Не нашли выше — подбираем любой непройденный по треку (включая уровни ниже).
  const fallback = SYLLABUS_UNITS.find(
    (u) => trackMatches(u, track) && !done.has(u.id)
  );
  return fallback ?? null;
}
