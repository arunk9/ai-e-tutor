import { chatCompletion } from "@/lib/groq";
import { buildRecapSystemPrompt } from "@/lib/prompts/recap";

export interface RecapStats {
  minutes: number;
  topicsDone: number;
  accuracy: number | null;
  gapsOpen: number;
  tomorrowFirstBlock: string | null;
}

export async function generateRecap(stats: RecapStats): Promise<string> {
  return chatCompletion(
    [
      { role: "system", content: buildRecapSystemPrompt() },
      { role: "user", content: JSON.stringify(stats) },
    ],
    { maxTokens: 150 }
  );
}
