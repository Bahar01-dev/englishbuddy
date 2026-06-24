import Link from "next/link";
import { Zap } from "lucide-react";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-white">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6D4DF0]/20 text-[#a98fff]">
        <Zap className="h-5 w-5" aria-hidden="true" fill="currentColor" />
      </span>
      <span className="text-lg font-semibold">EnglishBuddy</span>
    </Link>
  );
}
