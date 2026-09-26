import { getAllChapters, type Subject } from "@/lib/content";
import { getAllMasteryForUser } from "@/lib/mastery";

export type PriorityBucket = "gap" | "due_review" | "new_topic" | "polished";

export interface TopicPriority {
  topicId: string;
  subject: Subject;
  title: string;
  order: number;
  estimatedMinutes: number;
  mastery: number;
  attemptsCount: number;
  lastAttemptAt: Date | null;
  bucket: PriorityBucket;
  score: number;
}

const GAP_THRESHOLD = 0.6;
const POLISHED_THRESHOLD = 0.85;
const DUE_REVIEW_AFTER_DAYS = 3;

/**
 * Ranks every topic in the curriculum for one student. This is the single
 * source of truth both the daily planner and the "what's next" recommender
 * read from, so a topic's priority is computed exactly once per call.
 */
export async function getTopicPriorities(userId: string): Promise<TopicPriority[]> {
  const chapters = getAllChapters();
  const masteryRows = await getAllMasteryForUser(userId);
  const masteryByTopic = new Map(masteryRows.map((r) => [r.topicId, r]));

  const results: TopicPriority[] = [];

  for (const chapter of chapters) {
    for (const topic of chapter.topics) {
      const snapshot = masteryByTopic.get(topic.topicId);
      const mastery = snapshot?.mastery ?? 0;
      const attemptsCount = snapshot?.attemptsCount ?? 0;
      const lastAttemptAt = snapshot?.lastAttemptAt ?? null;

      let bucket: PriorityBucket;
      let score: number;

      if (attemptsCount === 0) {
        const prereqsSatisfied = topic.prerequisites.every(
          (pid) => (masteryByTopic.get(pid)?.mastery ?? 0) >= GAP_THRESHOLD
        );
        if (!prereqsSatisfied) continue; // not unlocked yet
        bucket = "new_topic";
        score = 30 - topic.order * 0.1;
      } else if (mastery < GAP_THRESHOLD) {
        bucket = "gap";
        score = 100 + (GAP_THRESHOLD - mastery) * 100;
      } else if (mastery < POLISHED_THRESHOLD) {
        const daysSince = lastAttemptAt ? (Date.now() - lastAttemptAt.getTime()) / 86_400_000 : Infinity;
        if (daysSince > DUE_REVIEW_AFTER_DAYS) {
          bucket = "due_review";
          score = 50 + (POLISHED_THRESHOLD - mastery) * 50 + Math.min(daysSince, 14);
        } else {
          bucket = "polished";
          score = 0;
        }
      } else {
        bucket = "polished";
        score = 0;
      }

      results.push({
        topicId: topic.topicId,
        subject: chapter.subject,
        title: topic.title,
        order: topic.order,
        estimatedMinutes: topic.estimatedMinutes,
        mastery,
        attemptsCount,
        lastAttemptAt,
        bucket,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export interface Recommendation extends TopicPriority {
  rank: number;
}

/** Top actionable topics (excludes already-polished ones) for the "what's next" panel. */
export async function getRecommendations(userId: string, limit = 5): Promise<Recommendation[]> {
  const priorities = await getTopicPriorities(userId);
  return priorities
    .filter((p) => p.bucket !== "polished")
    .slice(0, limit)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}
