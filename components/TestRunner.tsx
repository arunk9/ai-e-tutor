"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard, type AnswerValue, type ClientQuestionView } from "@/components/QuestionCard";

export interface TestItem extends ClientQuestionView {
  subject: string;
}

export function TestRunner({ paperId, items, totalSeconds }: { paperId: string; items: TestItem[]; totalSeconds: number }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [remaining, setRemaining] = useState(totalSeconds);
  const [submitting, setSubmitting] = useState(false);
  const elapsedRef = useRef<Record<string, number>>({});
  const activeSinceRef = useRef<number>(0); // set for real in the mount effect below
  const remainingRef = useRef<number>(totalSeconds);

  useEffect(() => {
    activeSinceRef.current = Date.now();
  }, []);

  const commitElapsed = useCallback(() => {
    const id = items[index].id;
    const now = Date.now();
    elapsedRef.current[id] = (elapsedRef.current[id] ?? 0) + (now - activeSinceRef.current);
    activeSinceRef.current = now;
  }, [index, items]);

  const handleSubmit = useCallback(async () => {
    // submitPaper() is idempotent server-side (a second submit of the same paper is a no-op),
    // so a race between the auto-submit timer and a manual click is harmless.
    setSubmitting(true);
    commitElapsed();
    const timings = { ...elapsedRef.current };
    await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId, answers, timings }),
    });
    router.push("/test");
    router.refresh();
  }, [commitElapsed, paperId, answers, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      setRemaining(remainingRef.current);
      if (remainingRef.current === 0) {
        clearInterval(timer);
        handleSubmit();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [handleSubmit]);

  function goTo(newIndex: number) {
    commitElapsed();
    setIndex(newIndex);
  }

  const item = items[index];
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Weekly Test</h1>
        <div className="rounded-lg bg-foreground px-3 py-1 text-sm font-medium text-background">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_3fr]">
        <div className="space-y-1">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => goTo(i)}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-xs capitalize ${
                i === index ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-800"
              } ${answers[it.id] !== undefined ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
            >
              {i + 1}. {it.subject} &middot; {it.type.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <QuestionCard question={item} value={answers[item.id]} onChange={(v) => setAnswers((a) => ({ ...a, [item.id]: v }))} disabled={submitting} />

          <div className="mt-4 flex justify-between">
            <button
              disabled={index === 0}
              onClick={() => goTo(index - 1)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm disabled:opacity-40 dark:border-zinc-800"
            >
              Previous
            </button>
            {index < items.length - 1 ? (
              <button onClick={() => goTo(index + 1)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Test"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
