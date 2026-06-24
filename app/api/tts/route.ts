import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export async function POST(request: Request) {
  // FR-01: только авторизованный пользователь
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Битый JSON не должен давать 500 — деградируем в tts_unavailable (FR-20).
  let text: string | undefined;
  try {
    ({ text } = (await request.json()) as { text?: string });
  } catch {
    return NextResponse.json({ error: "tts_unavailable" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !text?.trim()) {
    return NextResponse.json({ error: "tts_unavailable" }, { status: 400 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      }
    );

    if (!response.ok || !response.body) {
      // Нет ключа/квота (401/429) или иной сбой ElevenLabs — не показываем пользователю
      // техническую ошибку, клиент уйдёт в браузерный fallback. Лог для разработчика.
      console.warn("[TTS]", { route: "/api/tts", status: response.status });
      return NextResponse.json({ error: "tts_unavailable" }, { status: 502 });
    }

    return new Response(response.body, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch {
    return NextResponse.json({ error: "tts_unavailable" }, { status: 502 });
  }
}
