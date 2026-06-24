import Link from "next/link";
import type { LessonSession } from "@/types";

interface LessonCardProps {
  session: LessonSession;
}

export default function LessonCard({ session }: LessonCardProps) {
  const isCompleted = session.status === "completed";
  const date = new Date(session.created_at).toLocaleDateString("ru-RU");

  return (
    <Link
      href={`/lesson/${session.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/20"
    >
      <div className="flex flex-col">
        <span className="font-medium text-white">
          {session.scenario_title || "Новый урок"}
        </span>
        <span className="text-sm text-white/60">{date}</span>
      </div>

      <span
        className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
          isCompleted
            ? "bg-success-bg text-success-text"
            : "bg-correction-bg text-correction-text"
        }`}
      >
        {isCompleted ? "Завершён" : "В процессе"}
      </span>
    </Link>
  );
}
