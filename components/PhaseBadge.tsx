import type { LessonPhase } from "@/types";

interface PhaseBadgeProps {
  phase: LessonPhase | null;
}

const LABELS: Record<LessonPhase, string> = {
  review: "Повторение",
  explanation: "Объяснение",
  practice: "Практика",
  summary: "Итог",
};

const STYLES: Record<LessonPhase, string> = {
  review: "bg-accent/10 text-accent",
  explanation: "bg-accent/10 text-accent",
  practice: "bg-correction-bg text-correction-text",
  summary: "bg-success-bg text-success-text",
};

export default function PhaseBadge({ phase }: PhaseBadgeProps) {
  if (!phase) return null;

  return (
    <span
      className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STYLES[phase]}`}
    >
      {LABELS[phase]}
    </span>
  );
}
