import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { drawPractice, recordAttempt, type SubmittedAnswer } from "@/lib/assessment";
import { getQuestion } from "@/lib/content";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const url = new URL(request.url);
  const topicId = url.searchParams.get("topicId") ?? "";
  const count = Number(url.searchParams.get("count") ?? "5");
  if (!topicId) return NextResponse.json({ error: "topicId is required." }, { status: 400 });

  const questions = await drawPractice(user.id, topicId, count);
  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";
  const submitted = body?.submitted as SubmittedAnswer;
  const timeMs = Number(body?.timeMs ?? 0);
  const startedAt = body?.startedAt ? new Date(body.startedAt) : new Date(Date.now() - timeMs);

  const question = getQuestion(questionId);
  if (!question) return NextResponse.json({ error: "Unknown question." }, { status: 404 });

  const grade = await recordAttempt({ userId: user.id, question, submitted, timeMs, startedAt, mode: "practice" });

  return NextResponse.json({
    ...grade,
    correctAnswer: question.correct,
    solution: question.solution,
  });
}
