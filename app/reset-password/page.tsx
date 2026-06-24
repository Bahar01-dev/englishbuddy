"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/errors";
import Logo from "@/components/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // null — проверяем сессию; true — ссылка валидна; false — нет/просрочена
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов.");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(translateAuthError(error));
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#0e0b1a" }}
    >
      <div className="mb-8 flex w-full max-w-sm items-center justify-between">
        <Logo />
        <Link
          href="/login"
          className="text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          ← Ко входу
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="mb-6 text-2xl font-semibold text-white">Новый пароль</h1>

        {hasSession === null ? (
          <p className="text-sm text-white/60">Проверяем ссылку…</p>
        ) : hasSession === false ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl bg-correction-bg px-4 py-3 text-sm text-correction-text">
              Ссылка недействительна или устарела. Запроси новую.
            </p>
            <Link
              href="/forgot-password"
              className="text-center text-sm font-medium text-[#a98fff]"
            >
              Запросить ссылку заново
            </Link>
          </div>
        ) : done ? (
          <p className="rounded-xl bg-success-bg px-4 py-3 text-sm text-success-text">
            Пароль обновлён! Перенаправляем в кабинет…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm text-white/80">
                Новый пароль
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-[#a98fff]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="confirm" className="text-sm text-white/80">
                Повтори пароль
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-[#a98fff]"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-correction-bg px-4 py-2 text-sm text-correction-text">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-xl bg-[#6D4DF0] px-4 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Сохраняем..." : "Сохранить пароль"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
