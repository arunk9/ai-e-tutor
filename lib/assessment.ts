import { prisma } from "@/lib/db";
import {
  getPaperTemplates,
  getQuestion,
  getQuestionsBySubjectAndType,
  type MarkingRule,
  type Question,
  type QuestionType,
  type Subject,
} from "@/lib/content";
import { recomputeMastery } from "@/lib/mastery";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

// ---------- seeded RNG (deterministic per user+week, so an in-progress paper never changes) ----------

function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick<T>(arr: T[], count: number, rng: () => number): T[] {
  return shuffle(arr, rng).slice(0, count);
}

// ---------- marking rules (looked up by question type, regardless of mode) ----------

function getMarkingRuleForType(type: QuestionType): MarkingRule {
  const templates = getPaperTemplates();
  const rule = templates.main.marking[type] ?? templates.advanced.marking[type];
  if (!rule) throw new Error(`No marking rule found for question type "${type}"`);
  return rule;
}

// ---------- client-safe question shape (never includes correct/solution/tolerance) ----------

export interface OptionView {
  key: string; // display key, always "A".."D" in display order
  text: string;
}

export interface ClientQuestion {
  id: string;
  topicId: string;
  type: QuestionType;
  difficulty: string;
  expectedSeconds: number;
  stem: string;
  options: OptionView[] | null;
  optionOrder: string[] | null; // optionOrder[i] = original key shown at display position i
  matchingKeys: string[] | null; // Column-I labels for "matching" questions — never the mapped values
}

function stripOptionPrefix(raw: string): string {
  return raw.replace(/^[A-D]\.\s*/, "");
}

export function sanitizeQuestion(question: Question, optionOrder: string[] | null): ClientQuestion {
  let options: OptionView[] | null = null;
  if (question.options) {
    const order = optionOrder ?? [...OPTION_KEYS];
    options = order.map((originalKey, i) => {
      const idx = OPTION_KEYS.indexOf(originalKey as (typeof OPTION_KEYS)[number]);
      const raw = question.options![idx] ?? "";
      return { key: OPTION_KEYS[i], text: stripOptionPrefix(raw) };
    });
  }
  return {
    id: question.id,
    topicId: question.topicId,
    type: question.type,
    difficulty: question.difficulty,
    expectedSeconds: question.expectedSeconds,
    stem: question.stem,
    options,
    optionOrder: question.options ? optionOrder ?? [...OPTION_KEYS] : null,
    matchingKeys: question.type === "matching" ? Object.keys(question.correct as Record<string, string>) : null,
  };
}

/** Maps a submitted display key ("A".."D") back to the option's original key using the stored permutation. */
function resolveDisplayKey(displayKey: string, optionOrder: string[] | null): string {
  if (!optionOrder) return displayKey;
  const idx = OPTION_KEYS.indexOf(displayKey as (typeof OPTION_KEYS)[number]);
  return optionOrder[idx] ?? displayKey;
}

// ---------- grading ----------

export type SubmittedAnswer = string | string[] | number | Record<string, string> | null | undefined;

export interface GradeResult {
  correct: boolean;
  patternMarks: number;
  timeAwareMarks: number;
  rushedGuess: boolean;
  unattempted: boolean;
}

function isUnattempted(submitted: SubmittedAnswer): boolean {
  if (submitted === null || submitted === undefined) return true;
  if (Array.isArray(submitted)) return submitted.length === 0;
  if (typeof submitted === "string") return submitted.trim().length === 0;
  if (typeof submitted === "object") return Object.keys(submitted).length === 0;
  return false;
}

function gradeCorrectness(question: Question, submitted: SubmittedAnswer, optionOrder: string[] | null): { correct: boolean; partialMarks: number | null } {
  switch (question.type) {
    case "mcq_single": {
      const resolved = resolveDisplayKey(String(submitted), optionOrder);
      return { correct: resolved === question.correct, partialMarks: null };
    }
    case "mcq_multi": {
      const correctSet = new Set(question.correct as string[]);
      const submittedKeys = Array.isArray(submitted) ? submitted : [];
      const resolvedSet = new Set(submittedKeys.map((k) => resolveDisplayKey(k, optionOrder)));
      const hasWrongSelection = [...resolvedSet].some((k) => !correctSet.has(k));
      const isExact = !hasWrongSelection && resolvedSet.size === correctSet.size;
      if (hasWrongSelection) return { correct: false, partialMarks: -1 }; // signal "wrong selection made"
      if (isExact) return { correct: true, partialMarks: null };
      return { correct: false, partialMarks: resolvedSet.size }; // partial: count of correct options chosen
    }
    case "numerical": {
      const value = Number(submitted);
      const target = question.correct as number;
      const tolerance = question.tolerance ?? 0;
      return { correct: Math.abs(value - target) <= tolerance, partialMarks: null };
    }
    case "integer": {
      return { correct: Number(submitted) === (question.correct as number), partialMarks: null };
    }
    case "matching": {
      const target = question.correct as Record<string, string>;
      const submittedMap = (submitted ?? {}) as Record<string, string>;
      const keys = Object.keys(target);
      const correct = keys.every((k) => submittedMap[k] === target[k]);
      return { correct, partialMarks: null };
    }
  }
}

export function gradeAttempt(
  question: Question,
  submitted: SubmittedAnswer,
  timeMs: number,
  optionOrder: string[] | null = null
): GradeResult {
  const rule = getMarkingRuleForType(question.type);
  const unattempted = isUnattempted(submitted);

  if (unattempted) {
    return { correct: false, patternMarks: rule.unattempted, timeAwareMarks: 0, rushedGuess: false, unattempted: true };
  }

  const { correct, partialMarks } = gradeCorrectness(question, submitted, optionOrder);

  let patternMarks: number;
  if (question.type === "mcq_multi" && partialMarks !== null) {
    patternMarks = partialMarks === -1 ? rule.wrong : partialMarks * (rule.partialPerOption ?? 1);
  } else {
    patternMarks = correct ? rule.correct : rule.wrong;
  }

  const timeRatio = timeMs / (question.expectedSeconds * 1000);
  let timeAwareMarks: number;
  let rushedGuess = false;

  if (correct) {
    const speedFactor = timeRatio <= 1 ? 1 : lerp(1, 0.7, clamp(timeRatio - 1, 0, 1));
    timeAwareMarks = Math.max(0, patternMarks) * speedFactor;
  } else {
    timeAwareMarks = patternMarks;
    rushedGuess = timeRatio < 0.35;
  }

  return { correct, patternMarks, timeAwareMarks, rushedGuess, unattempted: false };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Grades one answer, persists the Attempt, and refreshes that topic's mastery. */
export async function recordAttempt(params: {
  userId: string;
  question: Question;
  submitted: SubmittedAnswer;
  timeMs: number;
  startedAt: Date;
  mode: "practice" | "test";
  paperId?: string;
  optionOrder?: string[] | null;
}): Promise<GradeResult> {
  const { userId, question, submitted, timeMs, startedAt, mode, paperId, optionOrder = null } = params;
  const grade = gradeAttempt(question, submitted, timeMs, optionOrder);

  await prisma.attempt.create({
    data: {
      userId,
      questionId: question.id,
      topicId: question.topicId,
      subject: subjectOfTopic(question.topicId),
      mode,
      paperId: paperId ?? null,
      type: question.type,
      correct: grade.correct,
      patternMarks: grade.patternMarks,
      timeAwareMarks: grade.timeAwareMarks,
      timeMs,
      expectedSeconds: question.expectedSeconds,
      rushedGuess: grade.rushedGuess,
      startedAt,
      submittedAt: new Date(),
    },
  });

  await recomputeMastery(userId, question.topicId);
  return grade;
}

function subjectOfTopic(topicId: string): Subject {
  if (topicId.startsWith("maths-")) return "maths";
  if (topicId.startsWith("phy-")) return "physics";
  return "chemistry";
}

// ---------- practice draws (unshuffled options, excludes recently-seen questions) ----------

export async function drawPractice(userId: string, topicId: string, count = 5): Promise<ClientQuestion[]> {
  const { getQuestionsByTopic } = await import("@/lib/content");
  const pool = getQuestionsByTopic(topicId);

  const recentlySeen = await prisma.attempt.findMany({
    where: { userId, topicId, mode: "practice" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { questionId: true },
  });
  const seenIds = new Set(recentlySeen.map((a) => a.questionId));

  const eligible = pool.filter((q) => !seenIds.has(q.id));
  const source = eligible.length >= count ? eligible : pool;

  const rng = mulberry32(hashSeed(`${userId}:${topicId}:${Date.now()}`));
  return pick(source, Math.min(count, source.length), rng).map((q) => sanitizeQuestion(q, null));
}

// ---------- weekly paper assembly (seeded, stable while in-progress, option order stored server-side) ----------

export interface PaperItem {
  questionId: string;
  subject: Subject;
  topicId: string;
  type: QuestionType;
  orderIndex: number;
  optionOrder: string[] | null;
}

async function buildPaperItems(userId: string, weekNumber: number, pattern: "main" | "advanced"): Promise<PaperItem[]> {
  const template = getPaperTemplates()[pattern];
  const rng = mulberry32(hashSeed(`${userId}:${weekNumber}:${pattern}`));
  const subjects: Subject[] = ["maths", "physics", "chemistry"];

  const priorPapers = await prisma.paper.findMany({ where: { userId }, select: { items: true } });
  const previouslySeen = new Set<string>();
  for (const p of priorPapers) {
    for (const item of p.items as unknown as PaperItem[]) previouslySeen.add(item.questionId);
  }

  const items: PaperItem[] = [];
  let orderIndex = 0;

  for (const subject of subjects) {
    for (const [type, requiredCount] of Object.entries(template.perSubject) as [QuestionType, number][]) {
      const pool = getQuestionsBySubjectAndType(subject, type);
      const fresh = pool.filter((q) => !previouslySeen.has(q.id));
      const source = fresh.length >= requiredCount ? fresh : pool;
      const chosen = pick(source, Math.min(requiredCount, source.length), rng);

      for (const q of chosen) {
        const optionOrder = q.options ? shuffle([...OPTION_KEYS], rng) : null;
        items.push({ questionId: q.id, subject, topicId: q.topicId, type, orderIndex: orderIndex++, optionOrder });
      }
    }
  }

  return items;
}

export async function getOrCreatePaper(userId: string, weekNumber: number, pattern: "main" | "advanced") {
  const existing = await prisma.paper.findUnique({ where: { userId_weekNumber: { userId, weekNumber } } });
  if (existing) return existing;

  const items = await buildPaperItems(userId, weekNumber, pattern);
  return prisma.paper.create({
    data: { userId, weekNumber, pattern, seed: `${userId}:${weekNumber}:${pattern}`, items: items as unknown as object },
  });
}

export async function submitPaper(paperId: string, answers: Record<string, SubmittedAnswer>, timings: Record<string, number>) {
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!paper) throw new Error("Paper not found");
  if (paper.status === "submitted") return paper;

  const items = paper.items as unknown as PaperItem[];
  let totalPatternMarks = 0;
  let totalMaxMarks = 0;
  let totalTimeAwareMarks = 0;

  for (const item of items) {
    const question = getQuestion(item.questionId);
    if (!question) continue;
    const rule = getMarkingRuleForType(item.type);
    totalMaxMarks += rule.correct;

    const grade = await recordAttempt({
      userId: paper.userId,
      question,
      submitted: answers[item.questionId],
      timeMs: timings[item.questionId] ?? question.expectedSeconds * 1000,
      startedAt: paper.startedAt,
      mode: "test",
      paperId: paper.id,
      optionOrder: item.optionOrder,
    });

    totalPatternMarks += grade.patternMarks;
    totalTimeAwareMarks += grade.timeAwareMarks;
  }

  return prisma.paper.update({
    where: { id: paperId },
    data: {
      status: "submitted",
      submittedAt: new Date(),
      totalPatternMarks,
      totalMaxMarks,
      totalTimeAwareMarks,
    },
  });
}

/** Client-safe items for an in-progress paper: the stored shuffle permutation is applied, never re-rolled. */
export function buildClientItemsForPaper(items: PaperItem[]): (ClientQuestion & { subject: Subject })[] {
  return items.map((item) => {
    const question = getQuestion(item.questionId);
    if (!question) throw new Error(`Unknown questionId "${item.questionId}" in paper`);
    return { ...sanitizeQuestion(question, item.optionOrder), subject: item.subject };
  });
}

export interface PaperResultItem {
  questionId: string;
  subject: Subject;
  topicId: string;
  type: QuestionType;
  stem: string;
  correct: boolean;
  patternMarks: number;
  timeAwareMarks: number;
  timeMs: number;
  solution: string;
}

export interface PaperResults {
  paperId: string;
  pattern: "main" | "advanced";
  weekNumber: number;
  totalPatternMarks: number;
  totalMaxMarks: number;
  totalTimeAwareMarks: number;
  items: PaperResultItem[];
}

/** Reconstructs a submitted paper's results from its Attempt rows (the source of truth for scores). */
export async function getPaperResults(paperId: string): Promise<PaperResults | null> {
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!paper || paper.status !== "submitted") return null;

  const attempts = await prisma.attempt.findMany({ where: { paperId }, orderBy: { createdAt: "asc" } });
  const items: PaperResultItem[] = attempts.map((a) => {
    const question = getQuestion(a.questionId);
    return {
      questionId: a.questionId,
      subject: a.subject as Subject,
      topicId: a.topicId,
      type: a.type as QuestionType,
      stem: question?.stem ?? "",
      correct: a.correct,
      patternMarks: a.patternMarks,
      timeAwareMarks: a.timeAwareMarks,
      timeMs: a.timeMs,
      solution: question?.solution ?? "",
    };
  });

  return {
    paperId: paper.id,
    pattern: paper.pattern as "main" | "advanced",
    weekNumber: paper.weekNumber,
    totalPatternMarks: paper.totalPatternMarks ?? 0,
    totalMaxMarks: paper.totalMaxMarks ?? 0,
    totalTimeAwareMarks: paper.totalTimeAwareMarks ?? 0,
    items,
  };
}
