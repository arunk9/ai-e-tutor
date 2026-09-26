import { prisma } from "@/lib/db";
import { getProgram, type Subject } from "@/lib/content";
import { getTopicPriorities, type TopicPriority } from "@/lib/recommend";
import { getISTParts, daysSinceIST } from "@/lib/time";
import type { User } from "@prisma/client";

export interface WeekInfo {
  weekNumber: number; // unbounded, 1-indexed from the student's first day
  pattern: "main" | "advanced";
  phaseLabel: string;
  weekday: string;
  isTestDay: boolean;
  dateStr: string;
}

/** Odd week = Main pattern, even week = Advanced pattern (plan.md rule). Phase label cycles through the 8 authored phases. */
export function getWeekInfo(user: Pick<User, "createdAt">, now: Date = new Date()): WeekInfo {
  const program = getProgram();
  const { dateStr, weekday } = getISTParts(now);

  const daysSince = Math.max(0, daysSinceIST(user.createdAt, now));
  const weekNumber = Math.floor(daysSince / 7) + 1;
  const pattern: "main" | "advanced" = weekNumber % 2 === 1 ? "main" : "advanced";

  const cyclicIndex = ((weekNumber - 1) % program.weeks.length) + 1;
  const phaseLabel = program.weeks.find((w) => w.weekNumber === cyclicIndex)?.phaseLabel ?? "Study Week";

  const isTestDay = weekday === program.testDayOfWeek;

  return { weekNumber, pattern, phaseLabel, weekday, isTestDay, dateStr };
}

export interface DailyBlock {
  topicId: string;
  subject: Subject;
  title: string;
  minutes: number;
  reason: TopicPriority["bucket"];
}

const BLOCK_MINUTES = 45;
const MIN_BLOCK_MINUTES = 20;

/**
 * Fills the day's minute budget by round-robining across the three
 * subjects' priority queues (gap > due_review > new_topic), so every
 * subject gets attention instead of one subject eating the whole budget.
 */
function buildDailyBlocks(priorities: TopicPriority[], totalMinutes: number): DailyBlock[] {
  const subjects: Subject[] = ["maths", "physics", "chemistry"];
  const queues = new Map<Subject, TopicPriority[]>(
    subjects.map((s) => [s, priorities.filter((p) => p.subject === s)])
  );

  const blocks: DailyBlock[] = [];
  let remaining = totalMinutes;
  let subjectIdx = 0;
  let stall = 0;

  while (remaining >= MIN_BLOCK_MINUTES && stall < subjects.length) {
    const subject = subjects[subjectIdx % subjects.length];
    subjectIdx++;
    const queue = queues.get(subject)!;
    const next = queue.shift();

    if (!next) {
      stall++;
      continue;
    }
    stall = 0;

    const minutes = Math.min(BLOCK_MINUTES, remaining);
    blocks.push({ topicId: next.topicId, subject, title: next.title, minutes, reason: next.bucket });
    remaining -= minutes;
  }

  return blocks;
}

/**
 * Returns (creating if needed) today's StudyDay row. The plan is decided
 * once, the first time it's read each day, so it doesn't shuffle under the
 * student as they study — mastery updates only affect *tomorrow's* plan.
 */
export async function getOrCreateTodayPlan(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const week = getWeekInfo(user);

  const existing = await prisma.studyDay.findUnique({ where: { userId_date: { userId, date: week.dateStr } } });
  if (existing) return { studyDay: existing, week };

  const plannedMinutes = week.isTestDay ? 0 : user.dailyHourBudgetMinutes;
  let plannedBlocks: DailyBlock[] = [];

  if (!week.isTestDay) {
    const priorities = await getTopicPriorities(userId);
    plannedBlocks = buildDailyBlocks(priorities, plannedMinutes);
  }

  const studyDay = await prisma.studyDay.create({
    data: {
      userId,
      date: week.dateStr,
      weekNumber: week.weekNumber,
      isTestDay: week.isTestDay,
      plannedMinutes,
      plannedBlocks: plannedBlocks as unknown as object,
    },
  });

  return { studyDay, week };
}

/** Consecutive closed-out study days, most recent first, allowing today to still be open. */
export async function getStreak(userId: string): Promise<number> {
  const days = await prisma.studyDay.findMany({
    where: { userId, closed: true },
    orderBy: { date: "desc" },
    take: 60,
    select: { date: true },
  });
  if (days.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = Date.parse(`${days[i - 1].date}T00:00:00Z`);
    const cur = Date.parse(`${days[i].date}T00:00:00Z`);
    if (Math.round((prev - cur) / 86_400_000) === 1) streak++;
    else break;
  }
  return streak;
}

export async function closeStudyDay(userId: string, minutesStudied: number, topicsTouched: string[]) {
  const week = getWeekInfo(await prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  return prisma.studyDay.update({
    where: { userId_date: { userId, date: week.dateStr } },
    data: { closed: true, closedAt: new Date(), minutesStudied, topicsTouched: topicsTouched as unknown as object },
  });
}
