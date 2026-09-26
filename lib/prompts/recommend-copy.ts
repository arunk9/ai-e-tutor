export function buildRecommendCopySystemPrompt(): string {
  return `Given a JSON payload describing one recommended topic (title, reason: gap|due_review|new_topic, masteryPct), write ONE short encouraging sentence (under 20 words) explaining why the student should study it next. No preamble, no quotes, just the sentence.`;
}
