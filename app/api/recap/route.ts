import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWeekInfo } from "@/lib/planner";
import { getTopicPriorities } from "@/lib/recommend";
import { getISTDayBoundsUTC } from "@/lib/time";
import { generateRecap, type RecapStats } from "@/lib/recap";
import { GroqNotConfiguredError } from "@/lib/groq";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const week = getWeekInfo(user);
  const studyDay = await prisma.studyDay.findUnique({ where: { userId_date: { userId: user.id, date: week.dateStr } } });
  if (!studyDay || !studyDay.closed) {
    return NextResponse.json({ error: "Close out today first." }, { status: 400 });
  }
  if (studyDay.recapText) {
    return NextResponse.json({ recapText: studyDay.recapText });
  }

  const { start, end } = getISTDayBoundsUTC(week.dateStr);
  const attempts = await prisma.attempt.findMany({ where: { userId: user.id, createdAt: { gte: start, lt: end } } });
  const accuracy = attempts.length ? attempts.filter((a) => a.correct).length / attempts.length : null;

  const priorities = await getTopicPriorities(user.id);
  const gapsOpen = priorities.filter((p) => p.bucket === "gap").length;
  const nextUp = priorities.find((p) => p.bucket !== "polished");

  const stats: RecapStats = {
    minutes: studyDay.minutesStudied,
    topicsDone: (studyDay.topicsTouched as unknown as string[]).length,
    accuracy,
    gapsOpen,
    tomorrowFirstBlock: nextUp?.title ?? null,
  };

  let recapText: string;
  try {
    recapText = await generateRecap(stats);
  } catch (err) {
    if (!(err instanceof GroqNotConfiguredError)) throw err;
    const accuracyPart = accuracy != null ? ` at ${Math.round(accuracy * 100)}% accuracy` : "";
    const gapsPart = gapsOpen > 0 ? `${gapsOpen} topic${gapsOpen === 1 ? "" : "s"} still need attention.` : "No open gaps right now — nice work.";
    recapText = `You studied ${stats.minutes} minutes across ${stats.topicsDone} topic${stats.topicsDone === 1 ? "" : "s"} today${accuracyPart}. ${gapsPart}`;
  }

  await prisma.studyDay.update({ where: { id: studyDay.id }, data: { recapText } });
  return NextResponse.json({ recapText });
}
