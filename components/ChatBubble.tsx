"use client";

import { Sparkles, Volume2 } from "lucide-react";
import { useTextToSpeech } from "@/lib/speech/useTextToSpeech";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBubble({ role, content }: ChatBubbleProps) {
  const isAssistant = role === "assistant";
  const { speak } = useTextToSpeech();

  return (
    <div className={`flex gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div
        className={`flex max-w-[80%] items-end gap-2 rounded-2xl px-4 py-2 text-sm sm:text-base ${
          isAssistant
            ? "bg-white text-foreground shadow-sm"
            : "bg-accent text-white"
        }`}
      >
        <span className="whitespace-pre-wrap">{content}</span>

        {isAssistant && content && (
          <button
            onClick={() => speak(content)}
            aria-label="Озвучить"
            className="flex-shrink-0 text-muted transition-colors hover:text-accent"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
