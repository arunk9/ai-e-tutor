import { Markdown } from "@/components/Markdown";
import type { Topic } from "@/lib/content";

export function LessonCard({ topic }: { topic: Topic }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">{topic.title}</h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        {topic.lesson.objectives.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>

      <div className="mt-4">
        <Markdown>{topic.lesson.content}</Markdown>
      </div>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
        <div className="text-xs font-semibold uppercase text-zinc-500">Worked Example</div>
        <div className="mt-1 text-sm font-medium">
          <Markdown>{topic.lesson.workedExample.problem}</Markdown>
        </div>
        <div className="mt-2">
          <Markdown>{topic.lesson.workedExample.solution}</Markdown>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase text-zinc-500">JEE Traps</div>
        <ul className="mt-1 list-disc pl-5 text-sm text-amber-700 dark:text-amber-400">
          {topic.lesson.jeeTraps.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
