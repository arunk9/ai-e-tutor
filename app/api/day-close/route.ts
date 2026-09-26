import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { closeStudyDay, getWeekInfo } from "@/lib/planner";
import { getISTDayBoundsUTC } from "@/lib/time";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const week = getWeekInfo(user);
  const { start, end } = getISTDayBoundsUTC(week.dateStr);

  const todaysAttempts = await prisma.attempt.findMany({
    where: { userId: user.id, createdAt: { gte: start, lt: end } },
    select: { topicId: true, timeMs: true },
  });

  const minutesStudied = Math.round(todaysAttempts.reduce((sum, a) => sum + a.timeMs, 0) / 60_000);
  const topicsTouched = Array.from(new Set(todaysAttempts.map((a) => a.topicId)));

  const studyDay = await closeStudyDay(user.id, minutesStudied, topicsTouched);
  return NextResponse.json(studyDay);
}
