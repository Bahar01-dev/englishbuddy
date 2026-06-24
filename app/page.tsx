import Link from "next/link";
import { Compass, BrainCircuit, Smile } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";

const FEATURES = [
  {
    icon: Compass,
    title: "Персональный план",
    description: "Подбирает темы под твою ситуацию",
  },
  {
    icon: BrainCircuit,
    title: "Память об ошибках",
    description: "Запоминает что даётся сложно и возвращается к этому",
  },
  {
    icon: Smile,
    title: "Без осуждения",
    description: "Практикуй сколько угодно, AI не устаёт и не судит",
  },
];

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col" style={{ backgroundColor: "#0e0b1a" }}>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6">
        <Logo />

        <nav className="flex items-center gap-3">
          {data.user ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-[#6D4DF0] px-5 py-2 font-medium text-white transition-opacity hover:opacity-90"
            >
              В кабинет
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-[#6D4DF0] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Начать бесплатно
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">
          Говори по-английски уверенно
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/60">
          AI-репетитор который подстраивается под твою цель — работа, переезд,
          учёба или путешествия
        </p>

        <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6D4DF0]/15 text-[#a98fff]">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="font-medium text-white">{feature.title}</div>
              <div className="text-sm text-white/60">{feature.description}</div>
            </div>
          ))}
        </div>

        <Link
          href={data.user ? "/dashboard" : "/register"}
          className="mt-12 rounded-xl bg-[#6D4DF0] px-8 py-3 font-medium text-white transition-opacity hover:opacity-90"
        >
          Попробовать бесплатно
        </Link>
      </main>
    </div>
  );
}
