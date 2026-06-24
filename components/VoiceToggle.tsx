"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VoiceToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("voice_enabled")
        .eq("user_id", data.user.id)
        .single();

      setEnabled(!!profile?.voice_enabled);
      setLoading(false);
    });
  }, []);

  async function toggle() {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const next = !enabled;
    setEnabled(next);

    await supabase
      .from("profiles")
      .update({ voice_enabled: next })
      .eq("user_id", data.user.id);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-pressed={enabled}
      aria-label="Озвучивать ответы автоматически"
      className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm transition-opacity disabled:opacity-60"
    >
      <span className="text-sm font-medium text-foreground">
        Озвучивать ответы автоматически
      </span>
      <span
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          enabled ? "bg-accent" : "bg-zinc-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
