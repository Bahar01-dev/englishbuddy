export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type CefrConfidence = "low" | "medium" | "high";

export type GoalTrack = "work" | "relocation" | "conversational" | "general";

export interface Profile {
  user_id: string;
  display_name: string | null;
  goal: string | null;
  level_description: string | null;
  voice_enabled: boolean;
  // обучающее ядро (CEFR + прогресс)
  cefr_level: CefrLevel | null;
  cefr_confidence: CefrConfidence | null;
  native_language: string | null;
  goal_track: GoalTrack | null;
  // удержание
  daily_goal: number;
  streak_count: number;
  longest_streak: number;
  last_active_date: string | null;
  // монетизация (модель данных)
  plan: string;
  subscription_status: string;
  subscription_period_end: string | null;
  created_at: string;
}

export interface VocabularyItem {
  id: string;
  user_id: string;
  phrase_en: string;
  translation_ru: string | null;
  context: string | null;
  source_lesson_id: string | null;
  srs_box: number;
  due_at: string;
  times_reviewed: number;
  last_reviewed_at: string | null;
  created_at: string;
}

export interface ErrorMemoryItem {
  id: string;
  user_id: string;
  description: string;
  topic: string | null;
  times_seen: number;
  last_reviewed_at: string;
  srs_box: number;
  due_at: string;
  created_at: string;
}

export type LessonStatus = "in_progress" | "completed";

export type LessonPhase = "review" | "explanation" | "practice" | "summary";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LessonSession {
  id: string;
  user_id: string;
  scenario_title: string | null;
  syllabus_unit_id: string | null;
  cefr_at_lesson: string | null;
  messages: ChatMessage[];
  status: LessonStatus;
  created_at: string;
  completed_at: string | null;
}

export interface LessonCompletionError {
  description: string;
  topic?: string;
  isRepeat?: boolean;
}

export interface LessonCompletion {
  keyPhrases: string[];
  errors: LessonCompletionError[];
}
