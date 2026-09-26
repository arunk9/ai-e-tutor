import type { ProgramWeek } from "@/lib/content";

export function WeekStrip({
  weeks,
  currentCyclicIndex,
  actualWeekNumber,
}: {
  weeks: ProgramWeek[];
  currentCyclicIndex: number;
  actualWeekNumber: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">8-Week Program</h3>
        <span className="text-xs text-zinc-500">Week {actualWeekNumber} overall</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {weeks.map((w) => {
          const isCurrent = w.weekNumber === currentCyclicIndex;
          const isMain = w.pattern === "main";
          return (
            <div
              key={w.weekNumber}
              title={w.phaseLabel}
              className={`rounded-lg border p-2 text-center text-xs ${
                isCurrent
                  ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="font-medium">W{w.weekNumber}</div>
              <div
                className={`mt-1 rounded px-1 py-0.5 text-[10px] font-medium ${
                  isMain
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                }`}
              >
                {isMain ? "Main" : "Adv"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
