import Link from "next/link";
import type { DailyBlock } from "@/lib/planner";
import { DayCloseButton } from "@/components/DayCloseButton";

const REASON_LABEL: Record<DailyBlock["reason"], string> = {
  gap: "Close a gap",
  due_review: "Due for review",
  new_topic: "New topic",
  polished: "Light revision",
};

const REASON_STYLE: Record<DailyBlock["reason"], string> = {
  gap: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  due_review: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  new_topic: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  polished: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function DailyPlan({
  blocks,
  isTestDay,
  plannedMinutes,
  alreadyClosed,
}: {
  blocks: DailyBlock[];
  isTestDay: boolean;
  plannedMinutes: number;
  alreadyClosed: boolean;
}) {
  if (isTestDay) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-1 text-sm font-semibold">Today&apos;s Plan</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          It&apos;s weekly test day. Head to the test instead of a study block.
        </p>
        <Link
          href="/test"
          className="mt-3 inline-block rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Go to weekly test
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Today&apos;s Plan</h3>
        <span className="text-xs text-zinc-500">{plannedMinutes} min budget</span>
      </div>

      <ul className="space-y-2">
        {blocks.map((block) => (
          <li
            key={block.topicId}
            className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
          >
            <div>
              <div className="text-sm font-medium">{block.title}</div>
              <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${REASON_STYLE[block.reason]}`}>
                {REASON_LABEL[block.reason]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">{block.minutes} min</span>
              <Link href={`/study/${block.topicId}`} className="text-xs font-medium underline">
                Start
              </Link>
            </div>
          </li>
        ))}
        {blocks.length === 0 && <li className="text-sm text-zinc-500">Nothing left to schedule today — great work!</li>}
      </ul>

      <div className="mt-4">
        <DayCloseButton alreadyClosed={alreadyClosed} />
      </div>
    </div>
  );
}
