"use client";

import { useCallback, useRef } from "react";

export function useTextToSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Останавливает текущую озвучку (и ElevenLabs-аудио, и браузерный синтез),
  // чтобы авто-озвучка и ручные клики не накладывались друг на друга.
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const fallbackSpeak = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      stop(); // не накладываем новую озвучку на текущую

      let objectUrl: string | null = null;
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (response.ok) {
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          const audio = new Audio(objectUrl);
          audioRef.current = audio;
          const cleanup = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (audioRef.current === audio) audioRef.current = null;
          };
          audio.onended = cleanup;
          audio.onerror = cleanup;
          await audio.play();
          return;
        }
      } catch {
        // Сбой ElevenLabs/сети/autoplay — освобождаем ресурс и уходим в fallback.
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        audioRef.current = null;
      }

      // tts_unavailable или ошибка — браузерный синтез речи (FR-20).
      fallbackSpeak(text);
    },
    [stop, fallbackSpeak]
  );

  return { speak, stop };
}
