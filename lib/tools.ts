// Anthropic tool use — структурированный вывод модели вместо хрупких текстовых маркеров (FR-05).
// Модель отдаёт фазу урока / итоги / результат диагностики через вызовы инструментов,
// валидируемые по JSON-схеме самим Anthropic, а не регулярками по тексту.

const setPhaseTool = {
  name: "set_phase",
  description:
    "Указывает текущую фазу урока для интерфейса. Вызывай ОДИН раз в КОНЦЕ своего хода, ПОСЛЕ обычного текста ответа ученику (никогда не раньше текста — иначе ученик дольше видит пустой экран).",
  input_schema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "string",
        enum: ["review", "explanation", "practice", "summary"],
        description:
          "review — повторение пройденного; explanation — объяснение темы; practice — ролевая практика; summary — итог.",
      },
    },
    required: ["phase"],
  },
};

const completeLessonTool = {
  name: "complete_lesson",
  description:
    "Вызови ОДИН раз, когда урок завершён (после итогового сообщения), чтобы сохранить результаты урока.",
  input_schema: {
    type: "object" as const,
    properties: {
      scenario_title: {
        type: "string",
        description: "Краткое название темы/сценария урока на русском (например, «Запись к врачу»).",
      },
      key_phrases: {
        type: "array",
        items: { type: "string" },
        description: "3-5 ключевых фраз урока. Формат: «английская фраза — перевод».",
      },
      errors: {
        type: "array",
        description: "Заметные неточности в речи ученика за урок (может быть пустым).",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "Краткое описание ошибки на русском." },
            topic: { type: "string", description: "Тема/категория ошибки." },
            is_repeat: {
              type: "boolean",
              description: "true, если это повтор уже известной ошибки пользователя.",
            },
          },
          required: ["description"],
        },
      },
    },
    required: ["scenario_title", "key_phrases"],
  },
};

const finishDiagnosisTool = {
  name: "finish_diagnosis",
  description:
    "Вызови ОДИН раз в конце онбординга, когда понял цель и уровень пользователя, чтобы сохранить их.",
  input_schema: {
    type: "object" as const,
    properties: {
      goal: { type: "string", description: "Краткое описание цели пользователя на русском." },
      level_description: { type: "string", description: "Свободное описание уровня пользователя." },
      cefr_level: {
        type: "string",
        enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
        description: "Оценка уровня по CEFR.",
      },
      cefr_confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Насколько уверена оценка уровня.",
      },
      goal_track: {
        type: "string",
        enum: ["work", "relocation", "conversational", "general"],
        description: "Трек цели.",
      },
    },
    required: ["cefr_level", "cefr_confidence", "goal", "goal_track"],
  },
};

export const LESSON_TOOLS = [setPhaseTool, completeLessonTool];
export const ONBOARDING_TOOLS = [finishDiagnosisTool];
