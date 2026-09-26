import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getHintForQuestion } from "@/lib/hint";
import { GroqNotConfiguredError } from "@/lib/groq";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";
  if (!questionId) return NextResponse.json({ error: "questionId is required." }, { status: 400 });

  try {
    const hint = await getHintForQuestion(questionId);
    return NextResponse.json({ hint });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "Hints are unavailable right now." }, { status: 500 });
  }
}
