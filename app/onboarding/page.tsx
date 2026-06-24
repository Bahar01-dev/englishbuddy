"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AI_ERROR_MESSAGES, extractStreamErrorKind } from "@/lib/ai-errors";
import { parseStream, type DiagnosisData } from "@/lib/stream-protocol";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import Loader from "@/components/Loader";
import type { ChatMessage } from "@/types";

type Goal = "work" | "relocation" | "study" | "travel";

const GOALS: { id: Goal; title: string; subtitle: string }[] = [
  { id: "work", title: "Работа", subtitle: "Переговоры, письма, созвоны" },
  { id: "relocation", title: "Переезд", subtitle: "Жизнь в англоязычной стране" },
  { id: "study", title: "Учёба", subtitle: "Университет, IELTS/TOEFL" },
  { id: "travel", title: "Путешествия", subtitle: "Отели, маршруты, общение" },
];

const GOAL_LABELS: Record<Goal, string> = {
  work: "Работа",
  relocation: "Переезд",
  study: "Учёба",
  travel: "Путешествия",
};

const WELCOME_MESSAGES: Record<Goal, string> = {
  work:
    "Привет! Буду твоим репетитором английского для работы. Давай я пойму твой уровень — без экзаменов, просто поболтаем. Попробуй рассказать мне о себе по-английски: кем работаешь и чем занимаешься? Не переживай за ошибки 🙂",
  relocation:
    "Привет! Готовишься к переезду — отличная цель. Давай по-дружески пойму твой уровень. Расскажи по-английски, куда планируешь переезжать и почему? Спокойно, ошибаться тут можно 🙂",
  study:
    "Привет! Учёба на английском — это серьёзно, помогу. Сначала пойму твой уровень в разговоре, без тестов. Расскажи по-английски, что и где учишь? Не бойся ошибок 🙂",
  travel:
    "Привет! Путешествия — классная мотивация. Давай пойму твой уровень в лёгкой беседе. Расскажи по-английски, куда любишь ездить и куда хочешь? Ошибки — это нормально 🙂",
};

function toApiMessages(history: ChatMessage[]): ChatMessage[] {
  const firstUserIndex = history.findIndex((m) => m.role === "user");
  return firstUserIndex === -1 ? [] : history.slice(firstUserIndex);
}

function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl gap-2 px-4 pt-6">
      {[1, 2].map((n) => (
        <div
          key={n}
          className="h-1.5 flex-1 rounded-full"
          style={{
            backgroundColor:
              n === step ? "#7c5cfc" : n < step ? "#6d4fc4" : "rgba(255,255,255,0.1)",
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function failWith(history: ChatMessage[], message: string) {
    setLoading(false);
    setError(message);
    setPendingRetry(true);
    setMessages(history);
  }

  async function sendToAssistant(history: ChatMessage[]) {
    if (!selectedGoal) return;

    setLoading(true);
    setError(null);
    setPendingRetry(false);
    setMessages([...history, { role: "assistant", content: "" }]);

    let response: Response;
    try {
      response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "onboarding",
          messages: toApiMessages(history),
          goal: GOAL_LABELS[selectedGoal],
        }),
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
        setMessages([...history, { role: "assistant", content: parsed.text }]);
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
    const finalMessages: ChatMessage[] = [
      ...history,
      { role: "assistant", content: parsed.text },
    ];
    setMessages(finalMessages);
    setLoading(false);

    // Результат диагностики приходит структурой через tool use (finish_diagnosis)
    if (parsed.diagnosis) {
      await finishOnboarding(parsed.diagnosis);
    }
  }

  async function finishOnboarding(diagnosis: DiagnosisData) {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const update: Record<string, string> = {};
    if (diagnosis.goal) update.goal = diagnosis.goal;
    if (diagnosis.level_description)
      update.level_description = diagnosis.level_description;
    if (diagnosis.cefr_level) update.cefr_level = diagnosis.cefr_level;
    if (diagnosis.cefr_confidence)
      update.cefr_confidence = diagnosis.cefr_confidence;
    if (diagnosis.goal_track) update.goal_track = diagnosis.goal_track;

    if (Object.keys(update).length > 0) {
      await supabase.from("profiles").update(update).eq("user_id", data.user.id);
    }

    router.push("/dashboard");
  }

  function handleSend(text: string) {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    sendToAssistant(history);
  }

  function handleRetry() {
    sendToAssistant(messages);
  }

  function handleStartDiagnostic() {
    if (!selectedGoal) return;
    setMessages([{ role: "assistant", content: WELCOME_MESSAGES[selectedGoal] }]);
    setStep(2);
  }

  if (step === 1) {
    return (
      <div className="flex flex-1 flex-col" style={{ backgroundColor: "#0e0b1a" }}>
        <ProgressBar step={1} />

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
          <h1 className="text-2xl font-semibold text-white">Какая у тебя цель?</h1>
          <p className="mt-2 text-sm text-white/60">
            А уровень я определю сам в коротком разговоре — выбирать ничего не нужно
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {GOALS.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => setSelectedGoal(goal.id)}
                className={`rounded-2xl border px-5 py-4 text-left transition-colors ${
                  selectedGoal === goal.id
                    ? "border-[#a98fff] bg-[#6D4DF0]/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="font-medium text-white">{goal.title}</div>
                <div className="mt-1 text-sm text-white/60">{goal.subtitle}</div>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-8">
            <button
              type="button"
              onClick={handleStartDiagnostic}
              disabled={!selectedGoal}
              className="w-full rounded-xl bg-[#6D4DF0] px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Продолжить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col" style={{ backgroundColor: "#0e0b1a" }}>
      <ProgressBar step={2} />

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
          {messages.map((message, index) => (
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

        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}
