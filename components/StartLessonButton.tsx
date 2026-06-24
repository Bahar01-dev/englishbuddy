"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export default function StartLessonButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lesson/start", { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.sessionId) {
        throw new Error("Не получилось начать урок");
      }

      router.push(`/lesson/${data.sessionId}`);
    } catch {
      setError("Не получилось начать урок. Попробуй ещё раз.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#6D4DF0] px-6 py-3 text-center font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Zap className="h-4 w-4" aria-hidden="true" fill="currentColor" />
        {loading ? "Готовим урок..." : "Начать новый урок"}
      </button>

      {error && <p className="text-sm text-correction-text">{error}</p>}
    </div>
  );
}
