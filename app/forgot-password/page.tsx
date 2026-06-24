"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/errors";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(translateAuthError(error));
      return;
    }
    // Не раскрываем, существует ли email — показываем нейтральный успех.
    setSent(true);
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
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Восстановление пароля
        </h1>

        {sent ? (
          <div className="mt-4 flex flex-col gap-4">
            <p className="rounded-xl bg-success-bg px-4 py-3 text-sm text-success-text">
              Если аккаунт с таким email существует, мы отправили на него ссылку
              для сброса пароля. Проверь почту (и папку «Спам»).
            </p>
            <Link
              href="/login"
              className="text-center text-sm font-medium text-[#a98fff]"
            >
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-white/60">
              Введи email — пришлём ссылку, чтобы задать новый пароль.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm text-white/80">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? "Отправляем..." : "Отправить ссылку"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
