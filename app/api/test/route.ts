import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submitPaper, type SubmittedAnswer } from "@/lib/assessment";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const paperId = typeof body?.paperId === "string" ? body.paperId : "";
  if (!paperId) return NextResponse.json({ error: "paperId is required." }, { status: 400 });

  const paper = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!paper || paper.userId !== user.id) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  const answers = (body?.answers ?? {}) as Record<string, SubmittedAnswer>;
  const timings = (body?.timings ?? {}) as Record<string, number>;

  const updated = await submitPaper(paperId, answers, timings);
  return NextResponse.json(updated);
}
