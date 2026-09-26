import { prisma } from "@/lib/db";
import { getQuestion } from "@/lib/content";

const RECENT_WINDOW = 10;
const RECENCY_DECAY_DAYS = 14;
const DIFFICULTY_WEIGHT: Record<string, number> = { easy: 1, medium: 1.5, hard: 2 };

export interface MasterySignals {
  mastery: number;
  accuracy: number;
  difficultyAcc: number;
  speedEfficiency: number;
  recency: number;
  consistency: number;
  attemptsCount: number;
  lastAttemptAt: Date | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Same taper the grader uses: full credit up to expected time, tapering to 0.7x by 2x-slow. */
function speedFactorFor(timeMs: number, expectedSeconds: number): number {
  const ratio = timeMs / (expectedSeconds * 1000);
  if (ratio <= 1) return 1;
  return clamp(1 - 0.3 * clamp(ratio - 1, 0, 1), 0.7, 1);
}

/**
 * Recomputes and persists mastery for one (user, topic) pair from that
 * topic's recent Attempt rows. Called once right after an attempt is graded
 * — never from the tutor/LLM path.
 */
export async function recomputeMastery(userId: string, topicId: string): Promise<MasterySignals> {
  const recent = await prisma.attempt.findMany({
    where: { userId, topicId },
    orderBy: { createdAt: "desc" },
    take: RECENT_WINDOW,
  });
  const attemptsCount = await prisma.attempt.count({ where: { userId, topicId } });

  if (recent.length === 0) {
    const empty: MasterySignals = {
      mastery: 0,
      accuracy: 0,
      difficultyAcc: 0,
      speedEfficiency: 0,
      recency: 0,
      consistency: 0,
      attemptsCount: 0,
      lastAttemptAt: null,
    };
    await prisma.masteryTopic.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: { userId, topicId, subject: (await inferSubject(topicId)) ?? "maths", ...empty },
      update: empty,
    });
    return empty;
  }

  const n = recent.length;
  const correctCount = recent.filter((a) => a.correct).length;
  const accuracy = correctCount / n;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const a of recent) {
    const difficulty = getQuestion(a.questionId)?.difficulty ?? "medium";
    const w = DIFFICULTY_WEIGHT[difficulty] ?? 1.5;
    weightedSum += w * (a.correct ? 1 : 0);
    weightTotal += w;
  }
  const difficultyAcc = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const speedEfficiency = recent.reduce((sum, a) => sum + speedFactorFor(a.timeMs, a.expectedSeconds), 0) / n;

  const lastAttemptAt = recent[0].createdAt;
  const daysSinceLast = (Date.now() - lastAttemptAt.getTime()) / (24 * 60 * 60 * 1000);
  const recency = clamp(1 - daysSinceLast / RECENCY_DECAY_DAYS, 0, 1);

  const p = accuracy;
  const consistency = 1 - 4 * p * (1 - p);

  const mastery = clamp(
    0.35 * accuracy + 0.2 * difficultyAcc + 0.2 * speedEfficiency + 0.15 * recency + 0.1 * consistency,
    0,
    1
  );

  const signals: MasterySignals = { mastery, accuracy, difficultyAcc, speedEfficiency, recency, consistency, attemptsCount, lastAttemptAt };

  const subject = (await inferSubject(topicId)) ?? recent[0].subject;
  await prisma.masteryTopic.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId, subject, ...signals },
    update: signals,
  });

  return signals;
}

async function inferSubject(topicId: string): Promise<string | null> {
  const { getTopic } = await import("@/lib/content");
  return getTopic(topicId)?.subject ?? null;
}

/**
 * A topic is a "gap" if mastery is below threshold, the most recent test
 * (not practice) attempt on it was wrong, or the student is repeatedly
 * rushing/slow-but-correct on it (last 5 attempts).
 */
export async function isTopicGap(userId: string, topicId: string): Promise<boolean> {
  const snapshot = await prisma.masteryTopic.findUnique({ where: { userId_topicId: { userId, topicId } } });
  if (!snapshot || snapshot.attemptsCount === 0) return false;
  if (snapshot.mastery < 0.6) return true;

  const lastTest = await prisma.attempt.findFirst({
    where: { userId, topicId, mode: "test" },
    orderBy: { createdAt: "desc" },
  });
  if (lastTest && !lastTest.correct) return true;

  const lastFive = await prisma.attempt.findMany({
    where: { userId, topicId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const rushedOrSlow = lastFive.filter((a) => {
    if (a.rushedGuess) return true;
    const factor = speedFactorFor(a.timeMs, a.expectedSeconds);
    return a.correct && factor < 0.85;
  });
  return rushedOrSlow.length >= 2;
}

export async function getAllMasteryForUser(userId: string) {
  return prisma.masteryTopic.findMany({ where: { userId } });
}
