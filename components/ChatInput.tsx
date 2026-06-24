"use client";

import { useState } from "react";
import { Mic, Send } from "lucide-react";
import { useSpeechToText } from "@/lib/speech/useSpeechToText";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const { isSupported, isListening, start, stop } = useSpeechToText();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleMicClick() {
    if (isListening) {
      stop();
      return;
    }

    start((transcript) => {
      setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-zinc-200 bg-white p-3"
    >
      {isSupported && (
        <button
          type="button"
          onClick={handleMicClick}
          disabled={disabled}
          aria-label={isListening ? "Остановить распознавание речи" : "Голосовой ввод"}
          aria-pressed={isListening}
          className={`flex flex-shrink-0 items-center justify-center rounded-full p-2 transition-colors disabled:opacity-40 ${
            isListening ? "bg-accent/10 text-accent animate-pulse" : "text-muted hover:text-foreground"
          }`}
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Напиши ответ..."
        aria-label="Сообщение"
        disabled={disabled}
        className="flex-1 resize-none rounded-xl border border-zinc-200 px-4 py-2 outline-none focus:border-accent disabled:opacity-60"
      />

      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Отправить"
        className="flex flex-shrink-0 items-center justify-center rounded-full bg-accent p-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Send className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );
}
