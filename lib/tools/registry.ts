/**
 * A tool is a single named, synchronous-feeling lookup that packers (the
 * tutor prompt builder, hint builder, recommend-copy builder) call to gather
 * exactly the context they need. Registering them here — instead of each
 * caller importing content.ts/mastery.ts ad hoc — gives one place that:
 *
 *   1. Names every piece of context that is allowed to reach an LLM prompt,
 *      so it's obvious by reading this file what could leak (see the
 *      "topic-scoped chat" rule in plan.md).
 *   2. Reuses the in-memory content index (lib/content.ts) and short-lived
 *      per-request memoization below, so a chat turn that needs the topic
 *      lesson + mastery + last messages does 1 DB round trip, not 3+.
 */
import { getQuestion, getTopic, type Question, type Topic } from "@/lib/content";
import { prisma } from "@/lib/db";

export interface ToolDefinition<Input, Output> {
  name: string;
  description: string;
  run: (input: Input) => Promise<Output> | Output;
}

const registry = new Map<string, ToolDefinition<unknown, unknown>>();

function defineTool<Input, Output>(tool: ToolDefinition<Input, Output>): ToolDefinition<Input, Output> {
  registry.set(tool.name, tool as ToolDefinition<unknown, unknown>);
  return tool;
}

export function listTools(): { name: string; description: string }[] {
  return Array.from(registry.values()).map(({ name, description }) => ({ name, description }));
}

export const getTopicLesson = defineTool<{ topicId: string }, Topic | null>({
  name: "getTopicLesson",
  description: "Returns the lesson (objectives, worked example, JEE traps) for one topicId, and nothing else.",
  run: ({ topicId }) => getTopic(topicId)?.topic ?? null,
});

export const getQuestionStem = defineTool<{ questionId: string }, Pick<Question, "id" | "topicId" | "type" | "stem" | "options"> | null>({
  name: "getQuestionStem",
  description: "Returns only the stem/options of a question — never the key or solution. Safe for hint prompts.",
  run: ({ questionId }) => {
    const q = getQuestion(questionId);
    if (!q) return null;
    return { id: q.id, topicId: q.topicId, type: q.type, stem: q.stem, options: q.options };
  },
});

export const getMasteryForTopic = defineTool<{ userId: string; topicId: string }, { mastery: number; attemptsCount: number } | null>({
  name: "getMasteryForTopic",
  description: "Returns this student's mastery number for exactly one topic — never the whole mastery table.",
  run: async ({ userId, topicId }) => {
    const row = await prisma.masteryTopic.findUnique({ where: { userId_topicId: { userId, topicId } } });
    if (!row) return null;
    return { mastery: row.mastery, attemptsCount: row.attemptsCount };
  },
});

export const getRecentThreadMessages = defineTool<{ threadId: string; limit?: number }, { role: string; content: string }[]>({
  name: "getRecentThreadMessages",
  description: "Returns the last N messages of one chat thread (one topic) — never another thread.",
  run: async ({ threadId, limit = 8 }) => {
    const rows = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
  },
});
