"use client";

import { useState } from "react";
import { QuestionCard, type AnswerValue, type ClientQuestionView } from "@/components/QuestionCard";
import { Markdown } from "@/components/Markdown";

interface GradeView {
  correct: boolean;
  patternMarks: number;
  timeAwareMarks: number;
  rushedGuess: boolean;
  unattempted: boolean;
  solution: string;
}

export function PracticePanel({ topicId }: { topicId: string }) {
  const [questions, setQuestions] = useState<ClientQuestionView[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerValue>(undefined);
  const [grade, setGrade] = useState<GradeView | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(Date.now());

  async function startPractice() {
    setLoading(true);
    try {
      const res = await fetch(`/api/practice?topicId=${encodeURIComponent(topicId)}&count=5`);
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setIndex(0);
      setAnswer(undefined);
      setGrade(null);
      setHint(null);
      setStartedAt(Date.now());
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!questions) return;
    const question = questions[index];
    setLoading(true);
    try {
      const timeMs = Date.now() - startedAt;
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          submitted: answer,
          timeMs,
          startedAt: new Date(startedAt).toISOString(),
        }),
      });
      const data = await res.json();
      setGrade(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleHint() {
    if (!questions) return;
    setLoading(true);
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: questions[index].id }),
      });
      const data = await res.json();
      setHint(res.ok ? data.hint : data.error);
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    setIndex((i) => i + 1);
    setAnswer(undefined);
    setGrade(null);
    setHint(null);
    setStartedAt(Date.now());
  }

  if (!questions) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-2 text-sm font-semibold">Practice</h3>
        <p className="mb-3 text-sm text-zinc-500">A short set of questions on this topic, weighted toward what you still need.</p>
        <button onClick={startPractice} disabled={loading} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {loading ? "Loading..." : "Start Practice"}
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">No practice questions available for this topic right now.</p>
      </div>
    );
  }

  if (index >= questions.length) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-medium">Set complete — nice work.</p>
        <button onClick={startPractice} className="mt-3 rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
          Practice another set
        </button>
      </div>
    );
  }

  const question = questions[index];

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Practice</h3>
        <span className="text-xs text-zinc-500">
          {index + 1} / {questions.length}
        </span>
      </div>

      <QuestionCard question={question} value={answer} onChange={setAnswer} disabled={!!grade} />

      {hint && !grade && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Markdown>{hint}</Markdown>
        </div>
      )}

      {grade && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${grade.correct ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950"}`}>
          <div className="font-medium">
            {grade.unattempted ? "Unattempted" : grade.correct ? "Correct" : "Not quite"} &middot; pattern {grade.patternMarks} &middot;
            time-aware {grade.timeAwareMarks.toFixed(1)}
            {grade.rushedGuess && " · looked rushed"}
          </div>
          <div className="mt-2">
            <Markdown>{grade.solution}</Markdown>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {!grade && (
          <>
            <button onClick={handleSubmit} disabled={loading} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              Submit
            </button>
            <button onClick={handleHint} disabled={loading} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
              Hint
            </button>
          </>
        )}
        {grade && (
          <button onClick={handleNext} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
            Next question
          </button>
        )}
      </div>
    </div>
  );
}
