"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SignOutButtonProps {
  className?: string;
}

export default function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <button
      onClick={handleSignOut}
      className={
        className ||
        "rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-100"
      }
    >
      Выйти
    </button>
  );
}
