// Централизованная обработка ошибок LLM (Anthropic) и сети.
// Две аудитории — два канала:
//  • пользователю — тёплое понятное сообщение на русском (НИКОГДА не технический текст);
//  • разработчику — структурный лог на сервере (без секретов и текста промптов).
// Файл чистый (без серверных зависимостей) — безопасно импортировать и на клиенте.

export type AiErrorKind =
  | "network"
  | "rate_limit"
  | "overloaded"
  | "bad_request"
  | "auth_config"
  | "empty_refusal"
  | "unknown";

export interface ClassifiedAiError {
  kind: AiErrorKind;
  userMessage: string;
  logLevel: "warn" | "error" | "critical";
  retryable: boolean;
  httpStatus: number; // что вернуть клиенту, если ошибка случилась ДО начала стрима
  status?: number; // исходный HTTP-статус от Anthropic, если был
  detail?: string; // безопасная техническая деталь для лога (без секретов)
}

// Каталог сообщений для пользователя (раздел «Обработка ошибок LLM» в Plan.md)
export const AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  network: "Связь прервалась. Твоё сообщение сохранено — нажми «Повторить».",
  rate_limit: "Я немного перегружен. Подожди пару секунд и попробуй снова.",
  overloaded: "Сервис сейчас загружен. Давай повторим через минутку.",
  bad_request: "Что-то пошло не так с этим запросом. Попробуй переформулировать.",
  auth_config: "У нас техническая заминка. Мы уже разбираемся — попробуй позже.",
  empty_refusal:
    "Кажется, я задумался. Переформулируй, пожалуйста, и попробуем ещё раз.",
  unknown: "Ой, что-то сломалось на нашей стороне. Попробуй ещё раз.",
};

const META: Record<
  AiErrorKind,
  { logLevel: ClassifiedAiError["logLevel"]; retryable: boolean; httpStatus: number }
> = {
  network: { logLevel: "warn", retryable: true, httpStatus: 503 },
  rate_limit: { logLevel: "warn", retryable: true, httpStatus: 429 },
  overloaded: { logLevel: "warn", retryable: true, httpStatus: 529 },
  bad_request: { logLevel: "error", retryable: false, httpStatus: 400 },
  auth_config: { logLevel: "critical", retryable: false, httpStatus: 500 },
  empty_refusal: { logLevel: "warn", retryable: true, httpStatus: 502 },
  unknown: { logLevel: "error", retryable: true, httpStatus: 502 },
};

function build(
  kind: AiErrorKind,
  status?: number,
  detail?: string
): ClassifiedAiError {
  return {
    kind,
    userMessage: AI_ERROR_MESSAGES[kind],
    status,
    detail,
    ...META[kind],
  };
}

export function classifyAiError(error: unknown): ClassifiedAiError {
  const err = error as {
    status?: number;
    name?: string;
    message?: string;
    error?: { type?: string; error?: { type?: string; message?: string } };
  };
  const status = typeof err?.status === "number" ? err.status : undefined;
  const message = typeof err?.message === "string" ? err.message : "";

  // Тип ошибки Anthropic из тела — приходит и БЕЗ http-статуса (часто через стрим)
  const apiType =
    err?.error?.error?.type ??
    err?.error?.type ??
    (/overloaded/i.test(message)
      ? "overloaded_error"
      : /rate.?limit/i.test(message)
        ? "rate_limit_error"
        : /authentication|permission|api.?key/i.test(message)
          ? "authentication_error"
          : /invalid_request|bad.?request/i.test(message)
            ? "invalid_request_error"
            : undefined);

  const detail =
    err?.error?.error?.message ?? apiType ?? (message.slice(0, 200) || undefined);

  // 1) по HTTP-статусу
  if (status === 429) return build("rate_limit", status, detail);
  if (status === 529) return build("overloaded", status, detail);
  if (status === 401 || status === 403) return build("auth_config", status, detail);
  if (status === 400 || status === 422) return build("bad_request", status, detail);
  if (status !== undefined && status >= 500) return build("overloaded", status, detail);

  // 2) по типу ошибки Anthropic (когда статуса нет)
  if (apiType === "overloaded_error" || apiType === "api_error")
    return build("overloaded", status, detail);
  if (apiType === "rate_limit_error") return build("rate_limit", status, detail);
  if (apiType === "authentication_error" || apiType === "permission_error")
    return build("auth_config", status, detail);
  if (apiType === "invalid_request_error") return build("bad_request", status, detail);

  // 3) сетевые
  if (/connection|timeout|econn|fetch|network|aborted/i.test(`${err?.name ?? ""} ${message}`)) {
    return build("network", undefined, detail);
  }

  return build("unknown", status, detail);
}

// Пустой ответ модели (ни одного текстового токена) — не сетевой сбой, отдельный случай.
export function emptyResponseError(): ClassifiedAiError {
  return build("empty_refusal");
}

// Структурный лог для разработчика. В ctx НЕ передавать секреты/текст системного промпта.
export function logAiError(
  c: ClassifiedAiError,
  ctx: Record<string, unknown> = {}
): void {
  const payload = {
    ...ctx,
    aiKind: c.kind,
    status: c.status,
    retryable: c.retryable,
    detail: c.detail,
  };
  if (c.logLevel === "critical") console.error("[AI][CRITICAL]", payload);
  else if (c.logLevel === "error") console.error("[AI]", payload);
  else console.warn("[AI]", payload);
}

// ── Управляющий «фрейм» ошибки внутри стрима ──
// Если ошибка случилась УЖЕ ПОСЛЕ первого токена (HTTP-статус менять поздно),
// сервер дописывает в поток этот маркер, а клиент превращает его в баннер.
export const AI_ERROR_PREFIX = "[[AI_ERROR:";
export const AI_ERROR_SUFFIX = "]]";

export function aiErrorFrame(kind: AiErrorKind): string {
  return `\n${AI_ERROR_PREFIX}${kind}${AI_ERROR_SUFFIX}`;
}

export function extractStreamErrorKind(text: string): AiErrorKind | null {
  const i = text.lastIndexOf(AI_ERROR_PREFIX);
  if (i === -1) return null;
  const j = text.indexOf(AI_ERROR_SUFFIX, i);
  if (j === -1) return null;
  const kind = text.slice(i + AI_ERROR_PREFIX.length, j);
  return kind in AI_ERROR_MESSAGES ? (kind as AiErrorKind) : "unknown";
}

export function stripStreamError(text: string): string {
  const i = text.lastIndexOf(AI_ERROR_PREFIX);
  return i === -1 ? text : text.slice(0, i).trimEnd();
}
