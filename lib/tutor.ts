import { prisma } from "@/lib/db";
import { getTopic } from "@/lib/content";
import { chatCompletion } from "@/lib/groq";
import { getTopicLesson, getMasteryForTopic, getRecentThreadMessages } from "@/lib/tools/registry";
import { buildTutorSystemPrompt } from "@/lib/prompts/tutor";

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export async function getOrCreateThread(userId: string, topicId: string) {
  return prisma.chatThread.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId },
    update: {},
  });
}

export async function getThreadHistory(userId: string, topicId: string): Promise<ThreadMessage[]> {
  const thread = await getOrCreateThread(userId, topicId);
  const messages = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
  });
  return messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content, createdAt: m.createdAt }));
}

/**
 * One Groq call per student message — never a chain of agents. Context is
 * hard-limited to this one topicId via the tool registry: its lesson, this
 * student's mastery on it, and the last few turns of this thread only.
 */
export async function sendTutorMessage(userId: string, topicId: string, userMessage: string): Promise<string> {
  const found = getTopic(topicId);
  if (!found) throw new Error(`Unknown topicId "${topicId}"`);
  const { subject } = found;

  const thread = await getOrCreateThread(userId, topicId);

  const [lesson, masteryInfo, history] = await Promise.all([
    getTopicLesson.run({ topicId }),
    getMasteryForTopic.run({ userId, topicId }),
    getRecentThreadMessages.run({ threadId: thread.id, limit: 8 }),
  ]);
  if (!lesson) throw new Error(`No lesson found for topicId "${topicId}"`);

  const systemPrompt = buildTutorSystemPrompt(lesson, subject, masteryInfo?.mastery ?? 0);

  const reply = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: userMessage },
    ],
    { maxTokens: 500 }
  );

  await prisma.chatMessage.create({ data: { threadId: thread.id, role: "user", content: userMessage } });
  await prisma.chatMessage.create({ data: { threadId: thread.id, role: "assistant", content: reply } });

  return reply;
}
