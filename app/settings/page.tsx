"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VoiceToggle from "@/components/VoiceToggle";
import SignOutButton from "@/components/SignOutButton";
import Loader from "@/components/Loader";

export default function SettingsPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, goal")
        .eq("user_id", data.user.id)
        .single();

      setDisplayName(profile?.display_name || "");
      setGoal(profile?.goal || "");
      setLoading(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        goal: goal.trim() || null,
      })
      .eq("user_id", data.user.id);

    setSaving(false);

    if (updateError) {
      setError("Не получилось сохранить изменения. Попробуй ещё раз.");
      return;
    }

    setSaved(true);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background px-4 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Настройки</h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            ← К урокам
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="display_name" className="text-sm text-foreground">
              Имя
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Как тебя называть?"
              className="rounded-xl border border-zinc-200 px-4 py-2 outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="goal" className="text-sm text-foreground">
              Моя цель
            </label>
            <textarea
              id="goal"
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Например: уверенно говорить на собеседованиях"
              className="resize-none rounded-xl border border-zinc-200 px-4 py-2 outline-none focus:border-accent"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-correction-bg px-4 py-2 text-sm text-correction-text">
              {error}
            </p>
          )}

          {saved && (
            <p className="rounded-xl bg-success-bg px-4 py-2 text-sm text-success-text">
              Изменения сохранены.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </form>

        <VoiceToggle />

        <SignOutButton />
      </div>
    </div>
  );
}
