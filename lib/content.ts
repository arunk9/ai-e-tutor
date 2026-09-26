import fs from "node:fs";
import path from "node:path";

export type Subject = "maths" | "physics" | "chemistry";
export type QuestionType = "mcq_single" | "mcq_multi" | "numerical" | "integer" | "matching";
export type Difficulty = "easy" | "medium" | "hard";

export interface WorkedExample {
  problem: string;
  solution: string;
}

export interface Lesson {
  objectives: string[];
  content: string;
  workedExample: WorkedExample;
  jeeTraps: string[];
}

export interface Topic {
  topicId: string;
  title: string;
  order: number;
  estimatedMinutes: number;
  prerequisites: string[];
  lesson: Lesson;
}

export type CorrectAnswer = string | string[] | number | Record<string, string>;

export interface Question {
  id: string;
  topicId: string;
  type: QuestionType;
  difficulty: Difficulty;
  expectedSeconds: number;
  stem: string;
  options: string[] | null;
  correct: CorrectAnswer;
  tolerance: number | null;
  solution: string;
}

export interface Chapter {
  chapterId: string;
  subject: Subject;
  title: string;
  topics: Topic[];
  questionPool: Question[];
}

export interface ProgramWeek {
  weekNumber: number;
  pattern: "main" | "advanced";
  phaseLabel: string;
}

export interface Program {
  timezone: string;
  defaultDailyMinutes: number;
  studyDaysOfWeek: string[];
  testDayOfWeek: string;
  subjects: Subject[];
  chapters: Record<Subject, string>;
  weeks: ProgramWeek[];
}

export interface MarkingRule {
  correct: number;
  wrong: number;
  unattempted: number;
  partialPerOption?: number;
}

export interface PaperTemplate {
  label: string;
  durationMinutesPerSubject: number;
  perSubject: Partial<Record<QuestionType, number>>;
  marking: Partial<Record<QuestionType, MarkingRule>>;
}

export interface PaperTemplates {
  main: PaperTemplate;
  advanced: PaperTemplate;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

const CHAPTER_FILES: Record<Subject, string> = {
  maths: "maths/quadratic-equations.json",
  physics: "physics/kinematics.json",
  chemistry: "chemistry/atomic-structure.json",
};

function readJson<T>(relativePath: string): T {
  const fullPath = path.join(CONTENT_DIR, relativePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Everything below is a lazily-built, in-memory index over the frozen content
 * JSON. Content never changes at runtime, so we read+parse each file exactly
 * once per server process and answer every lookup from memory afterwards —
 * this is the "tool registry" cache other lib modules and the tutor packer
 * call into instead of re-reading/re-parsing JSON on every request.
 */
interface ContentIndex {
  program: Program;
  paperTemplates: PaperTemplates;
  chaptersBySubject: Map<Subject, Chapter>;
  topicsById: Map<string, { topic: Topic; subject: Subject; chapterId: string }>;
  questionsById: Map<string, Question>;
  questionsByTopic: Map<string, Question[]>;
}

let index: ContentIndex | null = null;

function buildIndex(): ContentIndex {
  const program = readJson<Program>("program.json");
  const paperTemplates = readJson<PaperTemplates>("paper-templates.json");

  const chaptersBySubject = new Map<Subject, Chapter>();
  const topicsById: ContentIndex["topicsById"] = new Map();
  const questionsById = new Map<string, Question>();
  const questionsByTopic = new Map<string, Question[]>();

  for (const subject of program.subjects) {
    const chapter = readJson<Chapter>(CHAPTER_FILES[subject]);
    chaptersBySubject.set(subject, chapter);

    for (const topic of chapter.topics) {
      topicsById.set(topic.topicId, { topic, subject, chapterId: chapter.chapterId });
      questionsByTopic.set(topic.topicId, []);
    }
    for (const question of chapter.questionPool) {
      questionsById.set(question.id, question);
      const bucket = questionsByTopic.get(question.topicId);
      if (bucket) bucket.push(question);
      else questionsByTopic.set(question.topicId, [question]);
    }
  }

  return { program, paperTemplates, chaptersBySubject, topicsById, questionsById, questionsByTopic };
}

function ensureIndex(): ContentIndex {
  if (!index) index = buildIndex();
  return index;
}

export function getProgram(): Program {
  return ensureIndex().program;
}

export function getPaperTemplates(): PaperTemplates {
  return ensureIndex().paperTemplates;
}

export function getChapter(subject: Subject): Chapter {
  const chapter = ensureIndex().chaptersBySubject.get(subject);
  if (!chapter) throw new Error(`No chapter content for subject "${subject}"`);
  return chapter;
}

export function getAllChapters(): Chapter[] {
  return Array.from(ensureIndex().chaptersBySubject.values());
}

export function getTopic(topicId: string): { topic: Topic; subject: Subject; chapterId: string } | null {
  return ensureIndex().topicsById.get(topicId) ?? null;
}

export function getTopicsForSubject(subject: Subject): Topic[] {
  return getChapter(subject).topics;
}

export function getQuestion(questionId: string): Question | null {
  return ensureIndex().questionsById.get(questionId) ?? null;
}

export function getQuestionsByTopic(topicId: string): Question[] {
  return ensureIndex().questionsByTopic.get(topicId) ?? [];
}

export function getQuestionsBySubjectAndType(subject: Subject, type: QuestionType): Question[] {
  return getChapter(subject).questionPool.filter((q) => q.type === type);
}
