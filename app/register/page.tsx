"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/errors";
import Logo from "@/components/Logo";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(translateAuthError(error));
      return;
    }

    router.push("/onboarding");
  }

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#0e0b1a" }}
    >
      <div className="mb-8 flex w-full max-w-sm items-center justify-between">
        <Logo />
        <Link
          href="/"
          className="text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          ← На главную
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="mb-6 text-2xl font-semibold text-white">
          Регистрация
        </h1>

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

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-white/80">
              Пароль
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
            {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-[#a98fff]">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
