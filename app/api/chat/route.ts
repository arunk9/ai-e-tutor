import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendTutorMessage } from "@/lib/tutor";
import { GroqNotConfiguredError } from "@/lib/groq";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const topicId = typeof body?.topicId === "string" ? body.topicId : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!topicId || !message) {
    return NextResponse.json({ error: "topicId and message are required." }, { status: 400 });
  }

  try {
    const reply = await sendTutorMessage(user.id, topicId, message);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "Tutor is unavailable right now." }, { status: 500 });
  }
}
