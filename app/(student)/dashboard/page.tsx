import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAllChapters, getProgram } from "@/lib/content";
import { getAllMasteryForUser } from "@/lib/mastery";
import { getOrCreateTodayPlan, getStreak, type DailyBlock } from "@/lib/planner";
import { getRecommendations, type Recommendation } from "@/lib/recommend";
import { daysUntilWeekday } from "@/lib/time";
import { ChapterCoverage } from "@/components/ChapterCoverage";
import { WeekStrip } from "@/components/WeekStrip";
import { DailyPlan } from "@/components/DailyPlan";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [chapters, masteryRows, { studyDay, week }, recommendations, streak] = await Promise.all([
    getAllChapters(),
    getAllMasteryForUser(user.id),
    getOrCreateTodayPlan(user.id),
    getRecommendations(user.id, 5),
    getStreak(user.id),
  ]);

  const masteryByTopic = new Map(masteryRows.map((r) => [r.topicId, r]));
  const coverageChapters = chapters.map((c) => ({
    subject: c.subject,
    title: c.title,
    topics: c.topics.map((t) => ({
      topicId: t.topicId,
      title: t.title,
      order: t.order,
      mastery: masteryByTopic.get(t.topicId)?.mastery ?? 0,
      attemptsCount: masteryByTopic.get(t.topicId)?.attemptsCount ?? 0,
    })),
  }));

  const program = getProgram();
  const cyclicIndex = ((week.weekNumber - 1) % program.weeks.length) + 1;
  const daysToTest = week.isTestDay ? 0 : daysUntilWeekday(program.testDayOfWeek, week.weekday);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">Hi {user.displayName}</h1>
        <p className="text-sm text-zinc-500">
          {week.phaseLabel} &mdash; {week.pattern === "main" ? "JEE Main" : "JEE Advanced"} pattern this week
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
        <StatTile label="Next weekly test" value={week.isTestDay ? "Today" : `In ${daysToTest} day${daysToTest === 1 ? "" : "s"}`} />
        <StatTile label="Daily budget" value={`${user.dailyHourBudgetMinutes} min`} />
      </div>

      <WeekStrip weeks={program.weeks} currentCyclicIndex={cyclicIndex} actualWeekNumber={week.weekNumber} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ChapterCoverage chapters={coverageChapters} />
        <div className="space-y-6">
          <DailyPlan
            blocks={studyDay.plannedBlocks as unknown as DailyBlock[]}
            isTestDay={week.isTestDay}
            plannedMinutes={studyDay.plannedMinutes}
            alreadyClosed={studyDay.closed}
          />
          <NextUpPanel recommendations={recommendations} />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function NextUpPanel({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold">What&apos;s Next</h3>
      <ul className="space-y-2">
        {recommendations.map((r) => (
          <li key={r.topicId} className="flex items-center justify-between text-sm">
            <Link href={`/study/${r.topicId}`} className="hover:underline">
              {r.title}
            </Link>
            <span className="text-xs text-zinc-500">{Math.round(r.mastery * 100)}%</span>
          </li>
        ))}
        {recommendations.length === 0 && <li className="text-sm text-zinc-500">You&apos;re fully caught up!</li>}
      </ul>
    </div>
  );
}
