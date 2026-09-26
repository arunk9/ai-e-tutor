import { Markdown } from "@/components/Markdown";
import type { PaperResults } from "@/lib/assessment";

export function ResultsView({ results }: { results: PaperResults }) {
  const bySubject = new Map<string, typeof results.items>();
  for (const item of results.items) {
    bySubject.set(item.subject, [...(bySubject.get(item.subject) ?? []), item]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-lg font-semibold">
          Week {results.weekNumber} &middot; {results.pattern === "main" ? "JEE Main" : "JEE Advanced"} Results
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Pattern Score" value={`${results.totalPatternMarks} / ${results.totalMaxMarks}`} />
        <StatTile label="Time-Aware Score" value={results.totalTimeAwareMarks.toFixed(1)} />
        <StatTile label="Questions" value={String(results.items.length)} />
      </div>

      {Array.from(bySubject.entries()).map(([subject, items]) => (
        <div key={subject} className="space-y-3">
          <h2 className="text-sm font-semibold capitalize">{subject}</h2>
          {items.map((it) => (
            <div
              key={it.questionId}
              className={`rounded-xl border p-4 ${it.correct ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900"}`}
            >
              <Markdown>{it.stem}</Markdown>
              <div className={`mt-2 text-sm font-medium ${it.correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                {it.correct ? "Correct" : "Incorrect"} &middot; pattern {it.patternMarks} &middot; time-aware {it.timeAwareMarks.toFixed(1)} &middot;{" "}
                {Math.round(it.timeMs / 1000)}s
              </div>
              <div className="mt-2 text-sm">
                <Markdown>{it.solution}</Markdown>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
