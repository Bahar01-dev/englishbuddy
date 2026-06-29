import { NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/claude";
import { createServerClient } from "@/lib/supabase/server";
import { buildLessonSystemPrompt } from "@/lib/prompts/lesson";
import { buildOnboardingSystemPrompt } from "@/lib/prompts/onboarding";
import { LESSON_TOOLS, ONBOARDING_TOOLS } from "@/lib/tools";
import { buildReviewQueue } from "@/lib/review";
import { getUnitById } from "@/lib/syllabus";
import {
  phaseFrame,
  completeFrame,
  diagnosisFrame,
} from "@/lib/stream-protocol";
import {
  classifyAiError,
  emptyResponseError,
  logAiError,
  aiErrorFrame,
  type ClassifiedAiError,
} from "@/lib/ai-errors";
import type { ChatMessage, ErrorMemoryItem, VocabularyItem } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOKENS = 2048;
const MAX_RETRIES = 2;

// Минимальная форма событий стрима Anthropic — чтобы не зависеть от точных имён типов SDK.
type StreamEvent = {
  type: string;
  delta?: { type: string; text?: string; partial_json?: string };
  content_block?: { type: string; name?: string };
};

interface ChatRequestBody {
  kind?: "lesson" | "onboarding";
  messages?: ChatMessage[];
  sessionId?: string;
  goal?: string;
  level?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function prepend(
  first: IteratorResult<StreamEvent>,
  it: AsyncIterator<StreamEvent>
): AsyncIterator<StreamEvent> {
  let used = false;
  return {
    async next() {
      if (!used) {
        used = true;
        return first;
      }
      return it.next();
    },
  };
}

async function openStreamWithRetry(
  params: {
    system: string;
    messages: ChatMessage[];
    tools: typeof LESSON_TOOLS | typeof ONBOARDING_TOOLS;
  },
  logCtx: Record<string, unknown>
): Promise<AsyncIterator<StreamEvent>> {
  // Prompt caching (GA на claude-sonnet-4-6, без beta-заголовков): кешируем
  //  • системный блок (вместе с tools, т.к. tools рендерятся раньше system) —
  //    в пределах одного урока он стабилен, повторные ходы читают кеш ~0.1× стоимости;
  //  • хвост истории — каждый следующий ход переиспользует префикс предыдущего.
  // Эффект: резко ниже time-to-first-token на 2-м и далее ходах, особенно к концу урока.
  const cachedSystem = [
    {
      type: "text" as const,
      text: params.system,
      cache_control: { type: "ephemeral" as const },
    },
  ];
  const lastIdx = params.messages.length - 1;
  const cachedMessages = params.messages.map((m, i) =>
    i === lastIdx
      ? {
          role: m.role,
          content: [
            {
              type: "text" as const,
              text: m.content,
              cache_control: { type: "ephemeral" as const },
            },
          ],
        }
      : m
  );

  for (let attempt = 0; ; attempt++) {
    try {
      const s = anthropic.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: cachedSystem,
        messages: cachedMessages,
        tools: params.tools,
      });
      const it = s[Symbol.asyncIterator]() as AsyncIterator<StreamEvent>;
      // Первый await поднимает ранние ошибки (auth / 429 / сеть) — здесь их ловим и ретраим.
      const first = await it.next();
      return prepend(first, it);
    } catch (err) {
      const c = classifyAiError(err);
      logAiError(c, { ...logCtx, attempt });
      if (c.retryable && attempt < MAX_RETRIES) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw c;
    }
  }
}

function toolFrame(name: string, rawJson: string): string | null {
  let input: Record<string, unknown>;
  try {
    input = rawJson ? JSON.parse(rawJson) : {};
  } catch {
    return null; // битый JSON инструмента — defensive, фрейм не шлём
  }
  if (name === "set_phase" && typeof input.phase === "string") {
    return phaseFrame(input.phase);
  }
  if (name === "complete_lesson") {
    return completeFrame(input);
  }
  if (name === "finish_diagnosis") {
    return diagnosisFrame(input);
  }
  return null;
}

export async function POST(request: Request) {
  // FR-01: только авторизованный пользователь
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { code: "unauthorized", message: "Нужно войти в аккаунт." },
      { status: 401 }
    );
  }
  const userId = userData.user.id;

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { code: "bad_request", message: "Некорректный запрос." },
      { status: 400 }
    );
  }

  const kind = body.kind === "onboarding" ? "onboarding" : "lesson";
  const messages = Array.isArray(body.messages) ? body.messages : [];

  // FR-02: системный промпт собирается ТОЛЬКО на сервере, клиент его не передаёт
  let system: string;
  if (kind === "onboarding") {
    system = buildOnboardingSystemPrompt(body.goal ?? "");
  } else {
    const nowIso = new Date().toISOString();
    const [
      { data: profile },
      { data: errorItems },
      { data: pastSessions },
      { data: dueVocab },
      { data: dueErrors },
      { data: currentSession },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("goal, level_description, cefr_level")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("error_memory")
        .select("*")
        .eq("user_id", userId)
        .order("times_seen", { ascending: false })
        .order("last_reviewed_at", { ascending: false })
        .limit(5),
      supabase
        .from("lesson_sessions")
        .select("scenario_title")
        .eq("user_id", userId)
        .not("scenario_title", "is", null)
        .neq("id", body.sessionId ?? "00000000-0000-0000-0000-000000000000")
        .limit(50),
      supabase
        .from("vocabulary_items")
        .select("*")
        .eq("user_id", userId)
        .lte("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(10),
      supabase
        .from("error_memory")
        .select("*")
        .eq("user_id", userId)
        .lte("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(10),
      supabase
        .from("lesson_sessions")
        .select("syllabus_unit_id")
        .eq("id", body.sessionId ?? "00000000-0000-0000-0000-000000000000")
        .eq("user_id", userId)
        .single(),
    ]);

    const unit = getUnitById(currentSession?.syllabus_unit_id ?? null);

    const reviewItems = buildReviewQueue(
      (dueVocab || []) as VocabularyItem[],
      (dueErrors || []) as ErrorMemoryItem[]
    ).map((item) => item.text);

    system = buildLessonSystemPrompt({
      goal: profile?.goal ?? null,
      levelDescription: profile?.level_description ?? null,
      cefrLevel: profile?.cefr_level ?? null,
      reviewItems,
      errorMemory: (errorItems || []) as ErrorMemoryItem[],
      pastTopics: (pastSessions || [])
        .map((s) => s.scenario_title as string | null)
        .filter((t): t is string => !!t),
      unit,
    });
  }

  const tools = kind === "onboarding" ? ONBOARDING_TOOLS : LESSON_TOOLS;
  const logCtx = { route: "/api/chat", kind, userId, sessionId: body.sessionId };

  let iterator: AsyncIterator<StreamEvent>;
  try {
    iterator = await openStreamWithRetry({ system, messages, tools }, logCtx);
  } catch (classified) {
    const c = classified as ClassifiedAiError;
    return NextResponse.json(
      { code: c.kind, message: c.userMessage },
      { status: c.httpStatus }
    );
  }

  const it = iterator;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let toolName = "";
      let toolBuf = "";
      let sawText = false;
      let sawTool = false;

      try {
        while (true) {
          const next = await it.next();
          if (next.done) break;
          const event = next.value;

          if (event.type === "content_block_start") {
            if (event.content_block?.type === "tool_use") {
              toolName = event.content_block.name ?? "";
              toolBuf = "";
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta" && event.delta.text) {
              sawText = true;
              controller.enqueue(encoder.encode(event.delta.text));
            } else if (event.delta?.type === "input_json_delta") {
              toolBuf += event.delta.partial_json ?? "";
            }
          } else if (event.type === "content_block_stop") {
            if (toolName) {
              const frame = toolFrame(toolName, toolBuf);
              if (frame) {
                // set_phase сам по себе — НЕ ответ ученику (это только бейдж фазы).
                // Засчитываем как «ответ» лишь содержательные инструменты, иначе ход
                // из одного set_phase без текста сохранится в БД пустым (FR-баг).
                if (toolName === "complete_lesson" || toolName === "finish_diagnosis") {
                  sawTool = true;
                }
                controller.enqueue(encoder.encode(frame));
              }
              toolName = "";
              toolBuf = "";
            }
          }
        }

        if (!sawText && !sawTool) {
          const c = emptyResponseError();
          logAiError(c, logCtx);
          controller.enqueue(encoder.encode(aiErrorFrame(c.kind)));
        }
      } catch (err) {
        // Ошибка В СЕРЕДИНЕ стрима → дописываем управляющий маркер, клиент покажет баннер
        const c = classifyAiError(err);
        logAiError(c, { ...logCtx, phase: "mid-stream" });
        controller.enqueue(encoder.encode(aiErrorFrame(c.kind)));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
