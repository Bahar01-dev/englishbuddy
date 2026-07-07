"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTextToSpeech } from "@/lib/speech/useTextToSpeech";
import {
  AI_ERROR_MESSAGES,
  extractStreamErrorKind,
} from "@/lib/ai-errors";
import { parseStream, type LessonCompleteData } from "@/lib/stream-protocol";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import Loader from "@/components/Loader";
import PhaseBadge from "@/components/PhaseBadge";
import type { ChatMessage, LessonPhase } from "@/types";

const LESSON_START_MESSAGE: ChatMessage = { role: "user", content: "Начни урок." };

function visibleMessages(messages: ChatMessage[]): ChatMessage[] {
  if (
    messages.length > 0 &&
    messages[0].role === LESSON_START_MESSAGE.role &&
    messages[0].content === LESSON_START_MESSAGE.content
  ) {
    return messages.slice(1);
  }
  return messages;
}

export default function LessonPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<LessonPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [completion, setCompletion] = useState<LessonCompleteData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceEnabledRef = useRef(false);
  const { speak } = useTextToSpeech();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data: session } = await supabase
        .from("lesson_sessions")
        .select("id, messages, status")
        .eq("id", sessionId)
        .single();

      if (!session) {
        router.replace("/dashboard");
        return;
      }

      if (session.status === "completed") {
        setSessionCompleted(true);
      }

      // Системный промпт собирается на сервере (FR-02) — здесь грузим только настройку голоса.
      const { data: profile } = await supabase
        .from("profiles")
        .select("voice_enabled")
        .eq("user_id", userData.user.id)
        .single();

      if (cancelled) return;

      voiceEnabledRef.current = !!profile?.voice_enabled;
      setInitializing(false);

      const existingMessages = (session.messages || []) as ChatMessage[];
      if (existingMessages.length === 0) {
        sendToAssistant([LESSON_START_MESSAGE]);
      } else {
        setMessages(existingMessages);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function persistMessages(updated: ChatMessage[]) {
    const supabase = createClient();
    await supabase
      .from("lesson_sessions")
      .update({ messages: updated })
      .eq("id", sessionId);
  }

  function failWith(history: ChatMessage[], message: string) {
    setLoading(false);
    setError(message);
    setPendingRetry(true);
    setMessages(history);
  }

  async function sendToAssistant(history: ChatMessage[]) {
    setLoading(true);
    setError(null);
    setPendingRetry(false);
    setMessages([...history, { role: "assistant", content: "" }]);

    let response: Response;
    try {
      response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "lesson", sessionId, messages: history }),
      });
    } catch {
      failWith(history, AI_ERROR_MESSAGES.network);
      return;
    }

    // Ошибка ДО стрима — сервер прислал понятное русское сообщение
    if (!response.ok || !response.body) {
      let message = AI_ERROR_MESSAGES.unknown;
      try {
        const data = await response.json();
        if (data?.message) message = data.message as string;
      } catch {
        // тело не JSON — оставляем универсальное сообщение
      }
      failWith(history, message);
      return;
    }

    let full = "";
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });

        const parsed = parseStream(full);
        if (parsed.phase) setCurrentPhase(parsed.phase);
        setMessages([
          ...history,
          { role: "assistant", content: parsed.text },
        ]);
      }
    } catch {
      failWith(history, AI_ERROR_MESSAGES.network);
      return;
    }

    // Ошибка В СЕРЕДИНЕ стрима пришла управляющим маркером
    const streamErrorKind = extractStreamErrorKind(full);
    if (streamErrorKind) {
      failWith(history, AI_ERROR_MESSAGES[streamErrorKind]);
      return;
    }

    const parsed = parseStream(full);
    if (parsed.phase) setCurrentPhase(parsed.phase);

    const finalMessages: ChatMessage[] = [
      ...history,
      { role: "assistant", content: parsed.text },
    ];
    setMessages(finalMessages);
    setLoading(false);
    await persistMessages(finalMessages);

    if (voiceEnabledRef.current && parsed.text.trim()) {
      speak(parsed.text);
    }

    // Итоги урока приходят структурой через tool use (complete_lesson)
    if (parsed.complete) {
      setSessionCompleted(true);
      setCompletion(parsed.complete);
      await finishLesson(parsed.complete);
    }
  }

  async function finishLesson(data: LessonCompleteData) {
    const errors = (data.errors ?? []).map((e) => ({
      description: e.description,
      topic: e.topic,
      isRepeat: e.is_repeat,
    }));
    try {
      await fetch("/api/lesson/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scenarioTitle: data.scenario_title ?? null,
          keyPhrases: data.key_phrases ?? [],
          errors,
          tzOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      });
    } catch {
      // Урок уже завершён локально — повторная попытка не критична для UX.
    }
  }

  // Safety-net (FR-05): если модель почему-то не вызвала complete_lesson,
  // пользователь может завершить урок вручную.
  async function handleManualFinish() {
    if (loading) return;
    setSessionCompleted(true);
    try {
      await fetch("/api/lesson/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scenarioTitle: null,
          keyPhrases: [],
          errors: [],
          tzOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      });
    } catch {
      // некритично — статус обновится при следующем заходе
    }
  }

  async function handleSend(text: string) {
    if (sessionCompleted) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    await persistMessages(history);
    sendToAssistant(history);
  }

  function handleRetry() {
    sendToAssistant(messages);
  }

  if (initializing) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <h1 className="sr-only">Урок английского</h1>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-background px-4 py-3">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            ← К урокам
          </Link>
          <div className="flex items-center gap-3">
            <PhaseBadge phase={currentPhase} />
            {!sessionCompleted && (
              <button
                onClick={handleManualFinish}
                disabled={loading}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-40"
              >
                Завершить урок
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
          {visibleMessages(messages).map((message, index) => (
            <ChatBubble key={index} role={message.role} content={message.content} />
          ))}

          {loading && (
            <div className="flex justify-start">
              <Loader />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-start gap-2 rounded-xl bg-correction-bg px-4 py-3 text-sm text-correction-text">
              <p>{error}</p>
              {pendingRetry && (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-white px-3 py-1 font-medium text-correction-text transition-opacity hover:opacity-80"
                >
                  Повторить
                </button>
              )}
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {sessionCompleted && !completion && (
          <div className="border-t border-zinc-200 bg-white px-4 py-3 text-center text-sm text-muted">
            Этот урок завершён.{" "}
            <Link href="/dashboard" className="font-medium text-accent">
              На главную
            </Link>
          </div>
        )}

        <ChatInput onSend={handleSend} disabled={loading || sessionCompleted} />
      </div>

      {completion && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
            <h2 className="text-xl font-semibold text-foreground">
              Урок завершён! 🎉
            </h2>
            <p className="mt-2 text-sm text-muted">
              Сегодня ты разобрал(а) такие фразы:
            </p>

            <ul className="mt-4 space-y-2 text-left">
              {(completion.key_phrases ?? []).map((phrase, index) => (
                <li
                  key={index}
                  className="rounded-xl bg-success-bg px-3 py-2 text-sm text-success-text"
                >
                  {phrase}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-medium text-white transition-opacity hover:opacity-90"
            >
              На главную
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
