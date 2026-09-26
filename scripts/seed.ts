import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getAllChapters, getQuestionsByTopic, type Question } from "@/lib/content";
import { recomputeMastery } from "@/lib/mastery";
import { gradeAttempt } from "@/lib/assessment";

/**
 * Seeds two demo students with different attempt histories (not hand-typed
 * mastery numbers) so the dashboard visibly personalizes. Attempts go
 * through the real gradeAttempt()/recomputeMastery() pipeline, so seeded
 * mastery is exactly as trustworthy as mastery earned by actually studying.
 */

interface DemoProfile {
  username: string;
  displayName: string;
  password: string;
  dailyHourBudgetMinutes: number;
  // For each topic index (0-based, in curriculum order) within a subject,
  // how many of the topic's questions to answer, and the target accuracy.
  perTopicPlan: { topicsToTouch: number; questionsPerTopic: number; accuracy: number }[];
}

const PROFILES: DemoProfile[] = [
  {
    username: "arun-demo",
    displayName: "Arun",
    password: "demo1234",
    dailyHourBudgetMinutes: 240,
    // Strong on early topics, untouched later ones — a student ahead of schedule.
    perTopicPlan: [
      { topicsToTouch: 4, questionsPerTopic: 6, accuracy: 0.85 },
      { topicsToTouch: 1, questionsPerTopic: 4, accuracy: 0.4 }, // one visible gap
    ],
  },
  {
    username: "student-2",
    displayName: "Priya",
    password: "demo1234",
    dailyHourBudgetMinutes: 180,
    // Broader but shakier coverage — more topics touched, lower accuracy.
    perTopicPlan: [
      { topicsToTouch: 2, questionsPerTopic: 5, accuracy: 0.9 },
      { topicsToTouch: 3, questionsPerTopic: 5, accuracy: 0.45 },
    ],
  },
];

function pickAnswer(question: Question, wantCorrect: boolean): string | string[] | number | Record<string, string> {
  if (wantCorrect) return question.correct;

  switch (question.type) {
    case "mcq_single": {
      const letters = ["A", "B", "C", "D"];
      return letters.find((l) => l !== question.correct) ?? "A";
    }
    case "mcq_multi": {
      const correctSet = new Set(question.correct as string[]);
      const wrongLetter = ["A", "B", "C", "D"].find((l) => !correctSet.has(l));
      return wrongLetter ? [wrongLetter] : [];
    }
    case "numerical":
      return (question.correct as number) + (question.tolerance ?? 1) * 5 + 1;
    case "integer":
      return ((question.correct as number) + 5) % 10;
    case "matching": {
      const target = question.correct as Record<string, string>;
      const keys = Object.keys(target);
      const values = Object.values(target);
      const rotated: Record<string, string> = {};
      keys.forEach((k, i) => (rotated[k] = values[(i + 1) % values.length]));
      return rotated;
    }
  }
}

async function seedProfile(profile: DemoProfile) {
  const passwordHash = await hashPassword(profile.password);
  const user = await prisma.user.upsert({
    where: { username: profile.username },
    create: {
      username: profile.username,
      passwordHash,
      displayName: profile.displayName,
      dailyHourBudgetMinutes: profile.dailyHourBudgetMinutes,
    },
    update: {
      passwordHash,
      displayName: profile.displayName,
      dailyHourBudgetMinutes: profile.dailyHourBudgetMinutes,
    },
  });

  const chapters = getAllChapters();
  const touchedTopics = new Set<string>();

  for (const chapter of chapters) {
    const orderedTopics = [...chapter.topics].sort((a, b) => a.order - b.order);
    let topicCursor = 0;

    for (const plan of profile.perTopicPlan) {
      const slice = orderedTopics.slice(topicCursor, topicCursor + plan.topicsToTouch);
      topicCursor += plan.topicsToTouch;

      for (const topic of slice) {
        const pool = getQuestionsByTopic(topic.topicId);
        const questions = pool.slice(0, plan.questionsPerTopic);
        const targetCorrectCount = Math.round(questions.length * plan.accuracy);

        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const wantCorrect = i < targetCorrectCount;
          const submitted = pickAnswer(question, wantCorrect);
          const timeMs = question.expectedSeconds * 1000 * (wantCorrect ? 0.9 : 1.1);

          const grade = gradeAttempt(question, submitted, timeMs, null);

          await prisma.attempt.create({
            data: {
              userId: user.id,
              questionId: question.id,
              topicId: question.topicId,
              subject: chapter.subject,
              mode: "practice",
              type: question.type,
              correct: grade.correct,
              patternMarks: grade.patternMarks,
              timeAwareMarks: grade.timeAwareMarks,
              timeMs,
              expectedSeconds: question.expectedSeconds,
              rushedGuess: grade.rushedGuess,
              startedAt: new Date(Date.now() - timeMs),
              submittedAt: new Date(),
            },
          });
        }

        await recomputeMastery(user.id, topic.topicId);
        touchedTopics.add(topic.topicId);
      }
    }
  }

  console.log(`Seeded ${profile.username} (${profile.displayName}) — touched ${touchedTopics.size} topics.`);
}

async function main() {
  for (const profile of PROFILES) {
    await seedProfile(profile);
  }
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
