import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Колбэк Supabase Auth (PKCE): обменивает code из письма на сессию и ведёт дальше.
// Используется для восстановления пароля (next=/reset-password) и подтверждения email.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Нет кода или обмен не удался (ссылка просрочена/уже использована).
  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
