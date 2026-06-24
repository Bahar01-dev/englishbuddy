import type { AuthError } from "@supabase/supabase-js";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Неверный email или пароль.",
  "User already registered": "Пользователь с таким email уже существует.",
  "Email not confirmed": "Email ещё не подтверждён. Проверь почту.",
  "Password should be at least 6 characters":
    "Пароль должен быть не менее 6 символов.",
  "Unable to validate email address: invalid format":
    "Некорректный формат email.",
  "email rate limit exceeded":
    "Слишком много попыток отправки письма. Подожди немного и попробуй снова.",
};

export function translateAuthError(error: AuthError | null): string {
  if (!error) {
    return "Что-то пошло не так. Попробуй ещё раз.";
  }

  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (error.message.includes(key)) {
      return message;
    }
  }

  return "Что-то пошло не так. Попробуй ещё раз.";
}
