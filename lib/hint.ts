import { chatCompletion } from "@/lib/groq";
import { getQuestionStem, getTopicLesson } from "@/lib/tools/registry";
import { buildHintSystemPrompt } from "@/lib/prompts/hint";

export async function getHintForQuestion(questionId: string): Promise<string> {
  const question = await getQuestionStem.run({ questionId });
  if (!question) throw new Error(`Unknown questionId "${questionId}"`);

  const topic = await getTopicLesson.run({ topicId: question.topicId });
  if (!topic) throw new Error(`No lesson found for topicId "${question.topicId}"`);

  const systemPrompt = buildHintSystemPrompt(topic, question.stem);
  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Give me a hint, please." },
    ],
    { maxTokens: 150 }
  );
}
