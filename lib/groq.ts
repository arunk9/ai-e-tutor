import Groq from "groq-sdk";

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set. Add it to .env.local to enable live tutoring, hints, and recaps.");
  }
}

let client: Groq | null = null;

function getClient(): Groq {
  if (!process.env.GROQ_API_KEY) throw new GroqNotConfiguredError();
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Every LLM call in this app goes through here — one place to keep prompts
 * lean (small max_tokens, no chain of calls) so latency and token spend
 * stay predictable regardless of which feature (tutor/hint/recap) is asking.
 */
export async function chatCompletion(messages: ChatTurn[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
  const groq = getClient();
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await groq.chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens ?? 400,
    temperature: opts.temperature ?? 0.4,
  });

  return response.choices[0]?.message?.content ?? "";
}
