// Протокол передачи СТРУКТУРЫ внутри текстового потока (server → client).
// Модель отдаёт структуру через tool use; сервер извлекает её и дописывает в поток
// управляющими «фреймами», а клиент их вырезает из видимого текста и разбирает.
// Файл чистый (isomorphic) — импортируется и на сервере, и на клиенте.

export type LessonPhase = "review" | "explanation" | "practice" | "summary";

export interface LessonCompleteData {
  scenario_title?: string;
  key_phrases?: string[];
  errors?: { description: string; topic?: string; is_repeat?: boolean }[];
}

export interface DiagnosisData {
  goal?: string;
  level_description?: string;
  cefr_level?: string;
  cefr_confidence?: string;
  goal_track?: string;
}

const PHASE_TAG = "PHASE";
const COMPLETE_TAG = "COMPLETE";
const DIAGNOSIS_TAG = "DIAGNOSIS";

// JSON кодируем в base64 (UTF-8-safe), чтобы содержимое не конфликтовало с разделителями «]]».
function encodeB64(json: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(json, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(json)));
}
function decodeB64(b64: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
  return decodeURIComponent(escape(atob(b64)));
}

// ── Сервер: построение фреймов ──
export function phaseFrame(phase: string): string {
  return `\n[[${PHASE_TAG}:${phase}]]`;
}
export function completeFrame(data: LessonCompleteData): string {
  return `\n[[${COMPLETE_TAG}:${encodeB64(JSON.stringify(data))}]]`;
}
export function diagnosisFrame(data: DiagnosisData): string {
  return `\n[[${DIAGNOSIS_TAG}:${encodeB64(JSON.stringify(data))}]]`;
}

// ── Клиент: разбор потока ──
export interface ParsedStream {
  text: string; // видимый текст без всех управляющих фреймов
  phase: LessonPhase | null;
  complete: LessonCompleteData | null;
  diagnosis: DiagnosisData | null;
}

const FRAME_RE = /\n?\[\[(PHASE|COMPLETE|DIAGNOSIS):([^\]]*)\]\]/g;
const VALID_PHASES: LessonPhase[] = ["review", "explanation", "practice", "summary"];

export function parseStream(full: string): ParsedStream {
  let phase: LessonPhase | null = null;
  let complete: LessonCompleteData | null = null;
  let diagnosis: DiagnosisData | null = null;

  let match: RegExpExecArray | null;
  FRAME_RE.lastIndex = 0;
  while ((match = FRAME_RE.exec(full)) !== null) {
    const [, tag, payload] = match;
    try {
      if (tag === PHASE_TAG) {
        if ((VALID_PHASES as string[]).includes(payload)) phase = payload as LessonPhase;
      } else if (tag === COMPLETE_TAG) {
        complete = JSON.parse(decodeB64(payload)) as LessonCompleteData;
      } else if (tag === DIAGNOSIS_TAG) {
        diagnosis = JSON.parse(decodeB64(payload)) as DiagnosisData;
      }
    } catch {
      // битый фрейм игнорируем — defensive
    }
  }

  // Вырезаем все завершённые фреймы + возможный «хвост» незакрытого фрейма в конце потока.
  let text = full.replace(FRAME_RE, "");
  const lastOpen = text.lastIndexOf("[[");
  if (lastOpen !== -1 && text.indexOf("]]", lastOpen) === -1) {
    text = text.slice(0, lastOpen);
  }

  return { text: text.trimEnd(), phase, complete, diagnosis };
}
