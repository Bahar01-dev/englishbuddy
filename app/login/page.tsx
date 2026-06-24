"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/errors";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "link_expired") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "Ссылка устарела или уже использована. Запроси новую через «Забыли пароль?»."
      );
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(translateAuthError(error));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("goal")
      .eq("user_id", data.user.id)
      .single();

    setLoading(false);

    if (profile?.goal) {
      router.push("/dashboard");
    } else {
      router.push("/onboarding");
    }
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
        <h1 className="mb-6 text-2xl font-semibold text-white">Вход</h1>

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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm text-white/80">
                Пароль
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-white/50 transition-colors hover:text-[#a98fff]"
              >
                Забыли пароль?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
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
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-[#a98fff]">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
